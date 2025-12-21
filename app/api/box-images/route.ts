// app/api/box-images/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getBoxAccessToken } from "../../../lib/boxTokens";

export async function POST(req: NextRequest) {
  try {
    const { folderId } = await req.json();

    if (!folderId) {
      return NextResponse.json(
        { error: "Missing folderId in request body" },
        { status: 400 }
      );
    }

    const accessToken = await getBoxAccessToken();

    const res = await fetch(
      `https://api.box.com/2.0/folders/${encodeURIComponent(
        folderId
      )}/items?limit=1000`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.error("[Box] API error:", errJson);
      return NextResponse.json(
        {
          error: "Failed to load images from Box",
          details: errJson,
        },
        { status: 500 }
      );
    }

    const data = await res.json();
    const items = data.entries || [];

    const images = items.filter((item: any) => {
      if (item.type !== "file") return false;
      const name: string = item.name || "";
      return name.toLowerCase().match(/\.(png|jpe?g|gif|webp)$/);
    });

    return NextResponse.json({ images });
  } catch (err: any) {
    console.error("[Box] /api/box-images error:", err);
    return NextResponse.json(
      { error: err.message || "Unexpected error while loading Box images" },
      { status: 500 }
    );
  }
}
