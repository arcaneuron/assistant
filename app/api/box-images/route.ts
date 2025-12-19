import { NextRequest, NextResponse } from "next/server";

const BOX_API_BASE = "https://api.box.com/2.0";
const BOX_DEV_TOKEN = process.env.BOX_DEV_TOKEN;

if (!BOX_DEV_TOKEN) {
  console.warn(
    "BOX_DEV_TOKEN is not set. /api/box-images will not work until you add it to .env.local."
  );
}

type BoxItem = {
  id: string;
  type: string;
  name: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!BOX_DEV_TOKEN) {
      return NextResponse.json(
        { error: "BOX_DEV_TOKEN not configured on server" },
        { status: 500 }
      );
    }

    const { folderId } = await req.json();

    if (!folderId) {
      return NextResponse.json(
        { error: "folderId is required" },
        { status: 400 }
      );
    }

    const url = `${BOX_API_BASE}/folders/${encodeURIComponent(
      folderId
    )}/items?limit=1000`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${BOX_DEV_TOKEN}`,
      },
    });

    const raw = await res.text();

    if (!res.ok) {
      let details: any = raw;
      try {
        details = JSON.parse(raw);
      } catch {
        // not JSON, leave as string
      }

      console.error("Box API error:", res.status, details);

      return NextResponse.json(
        {
          error: `Box API error ${res.status}`,
          details,
        },
        { status: res.status }
      );
    }

    const data = JSON.parse(raw);
    const entries: BoxItem[] = data.entries || [];

    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

    const images = entries
      .filter((item) => item.type === "file")
      .filter((item) => {
        const lower = item.name.toLowerCase();
        return imageExtensions.some((ext) => lower.endsWith(ext));
      })
      .map((item) => ({
        id: item.id,
        name: item.name,
        url: `https://app.box.com/file/${item.id}`,
      }));

    return NextResponse.json({ images });
  } catch (err: any) {
    console.error("box-images route error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
