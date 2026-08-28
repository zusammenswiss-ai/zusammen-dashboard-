// Minimal Google OAuth 2.0 client for Gmail send + read access — plain
// fetch calls against Google's endpoints, no `googleapis` dependency
// (keeps this in line with the rest of the app's lean dependency list).
// Server-only: never import this from a "use client" file.
import { SITE_URL } from "./site-url";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
// gmail.send powers every "Email küldése" button; gmail.readonly powers
// the Postaláda (inbox) page — view-only, no modify/delete access.
// Anyone who connected before gmail.readonly existed only granted
// gmail.send, so their stored refresh_token won't have inbox access —
// they need to Kapcsolat bontása + reconnect once to pick up the new
// scope (Google requires re-consent for incremental scopes; connect
// always passes prompt=consent so reconnecting re-shows the screen).
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
].join(" ");

export function getRedirectUri(): string {
  return `${SITE_URL}/api/auth/gmail/callback`;
}

function getClientCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleOAuthConfigured(): boolean {
  return getClientCredentials() !== null;
}

/** Builds the URL to send the browser to for the Google consent screen. */
export function buildAuthorizeUrl(state: string): string {
  const creds = getClientCredentials();
  if (!creds) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET nincs beállítva.");
  }
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    // Forces Google to return a refresh_token every time (not just on the
    // very first authorization) — needed so a reconnect after revoking
    // access still gets a fresh one.
    prompt: "consent",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

/** Exchanges an authorization `code` (from the OAuth callback) for tokens. */
export async function exchangeCodeForTokens(
  code: string
): Promise<{ accessToken: string; refreshToken: string; expiresInSeconds: number }> {
  const creds = getClientCredentials();
  if (!creds) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET nincs beállítva.");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error(data.error_description || data.error || "Nem sikerült a Google token cserét elvégezni.");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresInSeconds: data.expires_in,
  };
}

/** Exchanges a stored refresh_token for a fresh access_token. */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const creds = getClientCredentials();
  if (!creds) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET nincs beállítva.");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    // invalid_grant means the refresh token was revoked/expired — the
    // caller (gmail-sender.ts) turns this into the gmail_not_connected
    // error code so the UI can prompt a reconnect instead of showing a
    // generic failure.
    throw new Error(data.error_description || data.error || "Nem sikerült frissíteni a Google access tokent.");
  }
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
}

/** Looks up the connected account's email address for display purposes. */
export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}
