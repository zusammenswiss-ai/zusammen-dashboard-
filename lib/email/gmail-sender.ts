// Gmail API implementation of EmailSender — sends as whatever Google
// account was connected via "Gmail összekapcsolása" on Beállítások (see
// app/api/auth/gmail/). Plain REST against the Gmail API, no `googleapis`
// dependency.
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { encryptToken, decryptToken } from "@/lib/token-crypto";
import { refreshAccessToken } from "@/lib/google-oauth";
import type { EmailSendParams, EmailSendResult, EmailSender } from "./types";

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
// Refresh a bit before the token's real expiry so a send never races a
// token that goes stale mid-request.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

const NOT_CONNECTED_RESULT: EmailSendResult = {
  ok: false,
  code: "gmail_not_connected",
  error: "Gmail nincs összekapcsolva — kattints ide az engedélyezéshez.",
};

/** Returns a valid access token for the connected Gmail account, refreshing it first if it's expired or about to expire. Returns null if nothing is connected. */
async function getValidAccessToken(): Promise<string | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data: connection } = await supabase.from("gmail_connection").select("*").maybeSingle();
  if (!connection) return null;

  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  const stillValid = connection.access_token && expiresAt - Date.now() > EXPIRY_SAFETY_MARGIN_MS;
  if (stillValid) return connection.access_token;

  // Expired (or never fetched) — refresh using the stored refresh_token.
  // A revoked/invalid refresh token throws here, which the caller treats
  // as "not connected" so the UI prompts a reconnect.
  const refreshToken = decryptToken(connection.encrypted_refresh_token);
  const { accessToken, expiresInSeconds } = await refreshAccessToken(refreshToken);
  await supabase
    .from("gmail_connection")
    .update({
      access_token: accessToken,
      access_token_expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
    })
    .eq("id", connection.id);
  return accessToken;
}

/** MIME "encoded-word" for a UTF-8 subject line (Hungarian accented characters aren't safe as raw header bytes). */
function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

/** Base64, line-wrapped at 76 chars per MIME convention. */
function wrapBase64(base64: string): string {
  return base64.match(/.{1,76}/g)?.join("\r\n") ?? base64;
}

function buildRawMessage({ to, subject, body }: EmailSendParams): string {
  const message = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(body, "utf-8").toString("base64")),
  ].join("\r\n");

  // Gmail API wants the whole RFC 2822 message base64url-encoded.
  return Buffer.from(message, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class GmailSender implements EmailSender {
  async send(params: EmailSendParams): Promise<EmailSendResult> {
    let accessToken: string | null;
    try {
      accessToken = await getValidAccessToken();
    } catch {
      // refreshAccessToken threw — most likely invalid_grant (revoked).
      return NOT_CONNECTED_RESULT;
    }
    if (!accessToken) return NOT_CONNECTED_RESULT;

    const res = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: buildRawMessage(params) }),
    });

    if (res.status === 401 || res.status === 403) {
      return NOT_CONNECTED_RESULT;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const message = data?.error?.message || `Gmail API hiba (${res.status}).`;
      return { ok: false, error: message };
    }
    return { ok: true };
  }
}

/** Used by the OAuth callback route to store a freshly-connected account. */
export async function saveGmailConnection(params: {
  googleEmail: string | null;
  refreshToken: string;
  accessToken: string;
  expiresInSeconds: number;
}): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    throw new Error("Supabase service-role kliens nincs beállítva (SUPABASE_SERVICE_ROLE_KEY hiányzik).");
  }
  // Single-user app — at most one connection row ever exists. Clear any
  // previous one (e.g. reconnecting a different Google account) before
  // inserting the new one.
  await supabase.from("gmail_connection").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("gmail_connection").insert({
    google_email: params.googleEmail,
    encrypted_refresh_token: encryptToken(params.refreshToken),
    access_token: params.accessToken,
    access_token_expires_at: new Date(Date.now() + params.expiresInSeconds * 1000).toISOString(),
  });
}

export async function getGmailConnectionStatus(): Promise<{ connected: boolean; email: string | null }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { connected: false, email: null };
  const { data } = await supabase.from("gmail_connection").select("google_email").maybeSingle();
  return { connected: Boolean(data), email: data?.google_email ?? null };
}

export async function disconnectGmail(): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  await supabase.from("gmail_connection").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
