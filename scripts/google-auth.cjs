// scripts/google-auth.js
// One-time script to get a Google OAuth refresh token

const { google } = require("googleapis");
const readline = require("readline");

// Read from env instead of hardcoding
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3005/oauth2callback";

const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive.readonly",
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables."
  );
  process.exit(1);
}


function getOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

function getNewToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("Authorize this app by visiting this url:\n");
  console.log(authUrl + "\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter the code from that page here: ", (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        console.error("Error retrieving access token", err);
        return;
      }
      console.log("\nTokens received:\n");
      console.log(JSON.stringify(token, null, 2));
      console.log(
        "\nCopy the refresh_token above and put it into your .env.local file."
      );
    });
  });
}

function main() {
  const oAuth2Client = getOAuthClient();
  getNewToken(oAuth2Client);
}

main();
