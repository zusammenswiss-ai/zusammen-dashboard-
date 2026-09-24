// Server-only store for Beállítások → "Email küldés" (the "egyszerű
// e-mail menü" — lets the founder pick the active provider and, for
// Resend, set the API key / from-name / from-address / reply-to from
// inside the dashboard instead of hand-editing Vercel environment
// variables). Mirrors gmail-connection.ts: the real secret (the Resend
// API key) lives in its own table with RLS enabled and zero policies
// (see supabase/schema.sql), so only the service-role client ever reads
// it, and it's encrypted at rest with lib/token-crypto.ts, same as the
// Gmail refresh token. Every lookup falls back to the RESEND_*/
// EMAIL_PROVIDER env vars wherever the DB has nothing set, so an
// existing Vercel-env-var setup keeps working untouched until the
// founder actually fills this in.
//
// NEVER import this from a "use client" file — see serverClient.ts.
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { encryptToken, decryptToken } from "@/lib/token-crypto";
import type { EmailSendConfig } from "@/lib/supabase/types";

export type EmailProvider = "gmail" | "resend";

const ENV_DEFAULT_FROM = "Zusammen <onboarding@resend.dev>";
const ENV_DEFAULT_REPLY_TO = "zusammen.swiss@gmail.com";

function envProvider(): EmailProvider {
  return (process.env.EMAIL_PROVIDER || "gmail").trim().toLowerCase() === "resend" ? "resend" : "gmail";
}

async function loadRow(): Promise<EmailSendConfig | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("email_send_config")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getActiveEmailProvider(): Promise<EmailProvider> {
  const row = await loadRow();
  return row?.provider ?? envProvider();
}

export type ResolvedResendConfig = {
  apiKey: string | null;
  from: string;
  replyTo: string;
};

/** Decrypts the stored key (if any) and fills in the from-address/reply-to, falling back field-by-field to env vars/defaults. */
export async function getResolvedResendConfig(): Promise<ResolvedResendConfig> {
  const row = await loadRow();

  let apiKey: string | null = null;
  if (row?.resend_api_key_encrypted) {
    try {
      apiKey = decryptToken(row.resend_api_key_encrypted);
    } catch {
      // TOKEN_ENCRYPTION_KEY rotated/missing since the key was stored — fall through to the env var below.
      apiKey = null;
    }
  }
  if (!apiKey) apiKey = process.env.RESEND_API_KEY || null;

  const dbFrom = row?.resend_from_email
    ? row.resend_from_name
      ? `${row.resend_from_name} <${row.resend_from_email}>`
      : row.resend_from_email
    : null;
  const from = dbFrom || process.env.RESEND_FROM_EMAIL || ENV_DEFAULT_FROM;
  const replyTo = row?.resend_reply_to || process.env.RESEND_REPLY_TO || ENV_DEFAULT_REPLY_TO;

  return { apiKey, from, replyTo };
}

export type EmailSendConfigStatus = {
  provider: EmailProvider;
  apiKeyConfigured: boolean;
  apiKeySource: "database" | "env" | "none";
  fromName: string;
  fromEmail: string;
  replyTo: string;
};

/** Non-secret status for the Settings UI — never returns the raw/decrypted key. */
export async function getEmailSendConfigStatus(): Promise<EmailSendConfigStatus> {
  const row = await loadRow();
  const apiKeySource: EmailSendConfigStatus["apiKeySource"] = row?.resend_api_key_encrypted
    ? "database"
    : process.env.RESEND_API_KEY
      ? "env"
      : "none";
  return {
    provider: row?.provider ?? envProvider(),
    apiKeyConfigured: apiKeySource !== "none",
    apiKeySource,
    fromName: row?.resend_from_name ?? "",
    fromEmail: row?.resend_from_email ?? "",
    replyTo: row?.resend_reply_to ?? "",
  };
}

export async function saveEmailSendConfig(params: {
  provider: EmailProvider;
  apiKey?: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { ok: false, error: "Supabase service-role kliens nincs beállítva (SUPABASE_SERVICE_ROLE_KEY hiányzik)." };
  }
  const row = await loadRow();
  const update: Record<string, unknown> = {
    provider: params.provider,
    resend_from_name: params.fromName.trim() || null,
    resend_from_email: params.fromEmail.trim() || null,
    resend_reply_to: params.replyTo.trim() || null,
  };
  if (params.apiKey && params.apiKey.trim()) {
    update.resend_api_key_encrypted = encryptToken(params.apiKey.trim());
  }
  const { error } = row
    ? await supabase.from("email_send_config").update(update).eq("id", row.id)
    : await supabase.from("email_send_config").insert(update);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function clearResendApiKey(): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  const row = await loadRow();
  if (!row) return;
  await supabase.from("email_send_config").update({ resend_api_key_encrypted: null }).eq("id", row.id);
}
