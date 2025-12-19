import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { matchEmailLinesToImages } from "../../../lib/emailMatcher";
import type { ImageFile, MatchResult } from "../../../lib/emailMatcher";
import { extractDocId } from "../../../lib/googleDocs";


const BOX_API_BASE = "https://api.box.com/2.0";
const BOX_DEV_TOKEN = process.env.BOX_DEV_TOKEN;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN!;

if (!BOX_DEV_TOKEN) {
  console.warn("BOX_DEV_TOKEN is not set. /api/apply-links will fail for Box.");
}
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  console.warn(
    "Google env vars missing. GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN must be set."
  );
}

function getGoogleAuthClient() {
  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return oAuth2Client;
}

type ParagraphInfo = {
  lineIndex: number;
  text: string;
  startIndex: number; // Google Docs document-level index
};

async function fetchBoxImages(folderId: string): Promise<ImageFile[]> {
  if (!BOX_DEV_TOKEN) {
    throw new Error("BOX_DEV_TOKEN is not configured");
  }

  const res = await fetch(
    `${BOX_API_BASE}/folders/${encodeURIComponent(folderId)}/items?limit=1000`,
    {
      headers: {
        Authorization: `Bearer ${BOX_DEV_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Box API error:", res.status, text);
    throw new Error("Failed to fetch Box folder items");
  }

  const data = await res.json();
  const entries: any[] = data.entries || [];

  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

  const images: ImageFile[] = entries
    .filter((item) => item.type === "file")
    .filter((item) => {
      const lower = item.name.toLowerCase();
      return imageExtensions.some((ext) => lower.endsWith(ext));
    })
    .map((item) => ({
      name: item.name,
      url: `https://app.box.com/file/${item.id}`,
    }));

  return images;
}

async function fetchDocParagraphInfos(
  docId: string
): Promise<ParagraphInfo[]> {
  const auth = getGoogleAuthClient();
  const docs = google.docs({ version: "v1", auth });

  const resp = await docs.documents.get({
    documentId: docId,
  });

  const body = resp.data.body;
  if (!body || !body.content) return [];

  const paragraphs: ParagraphInfo[] = [];
  let lineIndex = 0;

  for (const elem of body.content) {
    if (!elem.paragraph) continue;

    const p = elem.paragraph;
    const startIndex = elem.startIndex ?? 0;

    let text = "";
    for (const child of p.elements || []) {
      if (child.textRun && child.textRun.content) {
        text += child.textRun.content;
      }
    }

    paragraphs.push({
      lineIndex,
      text,
      startIndex,
    });

    lineIndex++;
  }

  return paragraphs;
}

function buildDocTextFromParagraphs(paragraphs: ParagraphInfo[]): string {
  // Use paragraph text as lines; trim trailing newlines so matching is cleaner
  return paragraphs
    .map((p) => p.text.replace(/\n$/, ""))
    .join("\n");
}

type LinkOp = {
  lineIndex: number;
  linkIndexInLine: number;
  url: string;
};

function buildLinkOpsFromMatches(
  matches: MatchResult[]
): LinkOp[] {
  const ops: LinkOp[] = [];

  for (const result of matches) {
    if (result.type !== "single") continue;
    const line = result.line;
    const linkIdx = line.linkIndexInLine ?? 0;
    const url = result.image.url;
    if (!url) continue;

    ops.push({
      lineIndex: line.lineIndex,
      linkIndexInLine: linkIdx,
      url,
    });
  }

  return ops;
}

function buildBatchUpdateRequests(
  paragraphs: ParagraphInfo[],
  linkOps: LinkOp[]
) {
  const LINK_TOKEN = "[LINK]";
  const requests: any[] = [];

  for (const op of linkOps) {
    const p = paragraphs[op.lineIndex];
    if (!p) continue;

    const text = p.text;
    let pos = -1;
    let count = 0;
    let targetOffset: number | null = null;

    while (true) {
      pos = text.indexOf(LINK_TOKEN, pos + 1);
      if (pos === -1) break;
      if (count === op.linkIndexInLine) {
        targetOffset = pos;
        break;
      }
      count++;
    }

    if (targetOffset == null) {
      console.warn(
        `Could not find [LINK] #${op.linkIndexInLine} in lineIndex=${op.lineIndex}`
      );
      continue;
    }

    const startIndex = p.startIndex + targetOffset;
    const endIndex = startIndex + LINK_TOKEN.length;

    requests.push({
      updateTextStyle: {
        range: {
          startIndex,
          endIndex,
        },
        textStyle: {
          link: { url: op.url },
        },
        fields: "link",
      },
    });
  }

  return requests;
}

export async function POST(req: NextRequest) {
  try {
    const { docUrlOrId, folderId } = await req.json();

    if (!docUrlOrId || !folderId) {
      return NextResponse.json(
        { error: "docUrlOrId and folderId are required" },
        { status: 400 }
      );
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
      return NextResponse.json(
        { error: "Google API credentials are not configured" },
        { status: 500 }
      );
    }

    const docId = extractDocId(docUrlOrId);

    // 1) Get images from Box
    const images = await fetchBoxImages(folderId);

    // 2) Get Google Doc paragraphs + build text for matcher
    const paragraphs = await fetchDocParagraphInfos(docId);
    const docText = buildDocTextFromParagraphs(paragraphs);

    // 3) Run matcher
    const matches = matchEmailLinesToImages(docText, images);

    // 4) Build link operations from matches with single image
    const linkOps = buildLinkOpsFromMatches(matches);

    if (linkOps.length === 0) {
      return NextResponse.json({
        updated: 0,
        message:
          "No single matches found to apply. Check matcher results first.",
        matches,
      });
    }

    // 5) Turn linkOps into Google Docs batchUpdate requests
    const requests = buildBatchUpdateRequests(paragraphs, linkOps);

    if (requests.length === 0) {
      return NextResponse.json({
        updated: 0,
        message:
          "No valid [LINK] positions found to update. Check doc formatting.",
        matches,
      });
    }

    const auth = getGoogleAuthClient();
    const docs = google.docs({ version: "v1", auth });

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests,
      },
    });

    return NextResponse.json({
      updated: requests.length,
      totalMatches: matches.length,
      message: `Applied ${requests.length} hyperlink(s) to the document.`,
    });
  } catch (err: any) {
    console.error("apply-links error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to apply links to Google Doc" },
      { status: 500 }
    );
  }
}