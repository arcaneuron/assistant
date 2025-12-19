// app/api/test-matcher/route.ts
import { NextRequest, NextResponse } from "next/server";
import { matchEmailLinesToImages } from "../../../lib/emailMatcher";
import type { ImageFile } from "../../../lib/emailMatcher";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const docText: string =
      body.docText ??
      `
Intro stuff, not relevant.

Email Comp: EOY URGENCY 12/30 7a MASS

Some text in between...

Email Comp: EOY FINAL STRETCH 12/30 9a MONTHLY

Another paragraph...

Email Comp: EOY FINAL STRETCH 12/30 7p LEADERSHIPHP

More random content...

Email Comp: EOY FINAL STRETCH 12/31 8a MAJOR
`;

    const images: ImageFile[] =
      body.images ?? [
        { name: "EOY_FS_Mass_12_30_7am.png", url: "https://box.com/file/mass-7am" },
        { name: "EOY_FS_Monthly_12_30_9am.png", url: "https://box.com/file/monthly-9am" },
        { name: "EOY_FS_LeadershipHP_12_30_7pm.png", url: "https://box.com/file/leadershiphp-7pm" },
        { name: "EOY_FS_Major_12_31_8am.png", url: "https://box.com/file/major-8am" },
      ];

    const results = matchEmailLinesToImages(docText, images);

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error("test-matcher error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
