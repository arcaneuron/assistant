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

// Save tokens to local file (for local dev / Node runtime)
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

  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2), "utf8");
  console.log("[Box] Tokens saved to", TOKENS_FILE);
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

// Get a valid access token, refreshing if needed
export async function getBoxAccessToken(): Promise<string> {
  const clientId = requireEnv("BOX_CLIENT_ID");
  const clientSecret = requireEnv("BOX_CLIENT_SECRET");

  let tokens = await loadBoxTokens();
  if (!tokens) {
    throw new Error(
      "Box tokens not found. Run the Box OAuth setup first (visit the Box authorize URL)."
    );
  }

  const now = Date.now();
  // expiry time in ms, subtract 60s for safety margin
  const expiresAt = tokens.obtained_at + (tokens.expires_in - 60) * 1000;

  if (now < expiresAt) {
    // still valid
    return tokens.access_token;
  }

  // Need to refresh using refresh_token
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
      `Failed to refresh Box token: ${json.error_description || json.error || res.status}`
    );
  }

  await saveBoxTokensFromOAuthResponse(json);

  return json.access_token as string;
}
