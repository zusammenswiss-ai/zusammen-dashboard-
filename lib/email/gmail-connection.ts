// Gmail connection management + access-token refresh — shared by
// gmail-sender.ts (sending) and gmail-inbox.ts (reading the Postaláda).
// Split out from gmail-sender.ts once a second feature needed the same
// token-refresh logic, so neither has to import the other.
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { encryptToken, decryptToken } from "@/lib/token-crypto";
import { refreshAccessToken } from "@/lib/google-oauth";

// Refresh a bit before the token's real expiry so a request never races a
// token that goes stale mid-flight.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

/**
 * Returns a valid access token for the connected Gmail account, refreshing
 * it first if it's expired or about to expire. Returns null if nothing is
 * connected. Throws if the stored refresh_token is invalid/revoked — every
 * caller treats that the same as "not connected" (prompts a reconnect).
 */
export async function getValidGmailAccessToken(): Promise<string | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const { data: connection } = await supabase.from("gmail_connection").select("*").maybeSingle();
  if (!connection) return null;

  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  const stillValid = connection.access_token && expiresAt - Date.now() > EXPIRY_SAFETY_MARGIN_MS;
  if (stillValid) return connection.access_token;

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
  // previous one (e.g. reconnecting to grant a newly-added scope) before
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
