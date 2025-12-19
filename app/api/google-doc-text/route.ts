import { NextRequest, NextResponse } from "next/server";
import { extractDocId, getGoogleDocText } from "../../../lib/googleDocs";

export async function POST(req: NextRequest) {
  try {
    const { docUrlOrId } = await req.json();

    if (!docUrlOrId) {
      return NextResponse.json(
        { error: "docUrlOrId is required" },
        { status: 400 }
      );
    }

    const docId = extractDocId(docUrlOrId);
    const text = await getGoogleDocText(docId);

    return NextResponse.json({ docId, text });
  } catch (err: any) {
    console.error("google-doc-text error:", err);

    return NextResponse.json(
      { error: err?.message || "Failed to fetch Google Doc text" },
      { status: 500 }
    );
  }
}
