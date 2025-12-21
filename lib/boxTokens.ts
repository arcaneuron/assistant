// lib/boxTokens.ts
import fs from "fs/promises";
import path from "path";

const TOKENS_FILE = path.join(process.cwd(), ".box-tokens.json");

type BoxTokenFile = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  obtained_at: number; // ms since epoch
};

const BOX_TOKEN_ENDPOINT = "https://api.box.com/oauth2/token";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return v;
}

// Save tokens to local file (used in local dev / self-hosted).
// On Vercel (read-only FS), we just log a warning and NO-OP.
export async function saveBoxTokensFromOAuthResponse(body: any) {
  if (!body.access_token || !body.refresh_token || !body.expires_in) {
    throw new Error("Invalid Box token response");
  }

  const tokens: BoxTokenFile = {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_in: body.expires_in,
    obtained_at: Date.now(),
  };

  // If we're running on Vercel, the FS is read-only. Don't throw.
  if (process.env.VERCEL === "1") {
    console.warn(
      "[Box] Skipping token file write on Vercel (read-only FS). " +
        "Box OAuth auto-refresh is only supported in local/self-hosted environments."
    );
    return;
  }

  try {
    await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf8");
    console.log("[Box] Tokens saved to", TOKENS_FILE);
  } catch (err: any) {
    console.error("[Box] Failed to write tokens file:", err);
    throw err;
  }
}

async function loadBoxTokens(): Promise<BoxTokenFile | null> {
  try {
    const raw = await fs.readFile(TOKENS_FILE, "utf8");
    const parsed = JSON.parse(raw) as BoxTokenFile;
    if (!parsed.access_token || !parsed.refresh_token) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Get a valid access token.
// Priority:
// 1) Tokens file (local dev / self-hosted) with refresh)
// 2) BOX_DEVELOPER_TOKEN env var (e.g. on Vercel)
// 3) Throw with a clear message
export async function getBoxAccessToken(): Promise<string> {
  const clientId = requireEnv("BOX_CLIENT_ID");
  const clientSecret = requireEnv("BOX_CLIENT_SECRET");

  // 1) Try tokens file (local dev / self-hosted)
  let tokens = await loadBoxTokens();

  if (!tokens) {
    // 2) Fallback to BOX_DEVELOPER_TOKEN (works on Vercel)
    const devToken = process.env.BOX_DEVELOPER_TOKEN;
    if (devToken) {
      console.warn(
        "[Box] Using BOX_DEVELOPER_TOKEN fallback. " +
          "This token expires every ~60 minutes; refresh it in your env vars when needed."
      );
      return devToken;
    }

    throw new Error(
      "Box tokens not found. " +
        "In local dev, run the Box OAuth flow. " +
        "In production, set BOX_DEVELOPER_TOKEN env var if you want Box access."
    );
  }

  // Tokens file exists → check expiry
  const now = Date.now();
  const expiresAt = tokens.obtained_at + (tokens.expires_in - 60) * 1000; // 60s safety

  if (now < expiresAt) {
    return tokens.access_token;
  }

  // Refresh using refresh_token
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokens.refresh_token,
  });

  const res = await fetch(BOX_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("[Box] Refresh error response:", json);
    throw new Error(
      `Failed to refresh Box token: ${
        json.error_description || json.error || res.status
      }`
    );
  }

  // Try to save updated tokens (this will NO-OP on Vercel)
  try {
    await saveBoxTokensFromOAuthResponse(json);
  } catch (err) {
    console.error("[Box] Failed to save refreshed tokens:", err);
  }

  return json.access_token as string;
}
