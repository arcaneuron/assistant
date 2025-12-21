// app/api/box-oauth/callback/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { saveBoxTokensFromOAuthResponse } from "../../../../lib/boxTokens";

const BOX_TOKEN_ENDPOINT = "https://api.box.com/oauth2/token";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return v;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  if (error) {
    return NextResponse.text(
      `Box auth error: ${error} - ${errorDesc || ""}`,
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.text("Missing 'code' from Box OAuth callback.", {
      status: 400,
    });
  }

  const clientId = requireEnv("BOX_CLIENT_ID");
  const clientSecret = requireEnv("BOX_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const tokenRes = await fetch(BOX_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = await tokenRes.json();

  if (!tokenRes.ok) {
    console.error("[Box] OAuth code exchange failed:", json);
    return NextResponse.text(
      `Failed to exchange Box auth code: ${
        json.error_description || json.error || tokenRes.status
      }`,
      { status: 500 }
    );
  }

  try {
    await saveBoxTokensFromOAuthResponse(json);
  } catch (err: any) {
    console.error("[Box] Failed to save tokens:", err);
    return NextResponse.text(
      `Box auth succeeded but saving tokens failed: ${String(
        err?.message || err
      )}`,
      { status: 500 }
    );
  }

  // Simple HTML page to confirm
  const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>PM Twin · Box Auth</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 24px;
        background: #f9fafb;
        color: #111827;
      }
      .card {
        max-width: 520px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
        padding: 18px 20px;
        box-shadow: 0 10px 24px rgba(15,23,42,0.08);
      }
      h1 {
        font-size: 18px;
        margin: 0 0 8px;
      }
      p {
        margin: 4px 0;
        font-size: 14px;
        color: #4b5563;
      }
      code {
        background: #e5e7eb;
        border-radius: 4px;
        padding: 2px 4px;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Box connected ✅</h1>
      <p>Your Box access & refresh tokens were stored on the PM Twin server.</p>
      <p>You can now close this tab and go back to the PM Twin app.</p>
      <p style="margin-top:12px;font-size:12px;color:#6b7280;">
        Tokens are saved to <code>.box-tokens.json</code> on the server. 
        PM Twin will automatically refresh them as needed.
      </p>
    </div>
  </body>
</html>
  `.trim();

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}