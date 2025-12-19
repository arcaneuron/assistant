// lib/googleDocs.ts
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN!;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.warn(
    "Google OAuth env vars are missing. GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN must be set."
  );
}

function getAuthClient() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    throw new Error("Google OAuth env vars are not configured.");
  }

  const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
  oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
  return oAuth2Client;
}

/**
 * Extracts the docId from a full Google Docs URL or returns the raw id.
 */
export function extractDocId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Empty doc URL/ID");
  }

  // If it's already just an ID (no http), just return it
  if (!trimmed.startsWith("http")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/document\/d\/([^/]+)/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (e) {
    // Not a valid URL, fall through to error below
  }

  throw new Error(`Could not extract docId from URL: ${trimmed}`);
}

/**
 * Fetches the Google Doc content as plain text using Drive API export.
 */
export async function getGoogleDocText(docId: string): Promise<string> {
  const auth = getAuthClient();
  const drive = google.drive({ version: "v3", auth });

  try {
    const res = await drive.files.export(
      {
        fileId: docId,
        mimeType: "text/plain",
      },
      { responseType: "text" as any }
    );

    // googleapis returns raw text in res.data for this mimeType
    if (!res.data) {
      throw new Error("Empty response from Google Drive export");
    }

    return typeof res.data === "string" ? res.data : String(res.data);
  } catch (err: any) {
    // Log the full response from Google if present
    console.error("Google Drive export error:", err?.response?.data || err);

    const msg =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Google Drive export failed";

    throw new Error(msg);
  }
}
