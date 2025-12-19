// app/api/process-transcript/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "process-transcript endpoint is not used in this deployment." },
    { status: 501 }
  );
}
