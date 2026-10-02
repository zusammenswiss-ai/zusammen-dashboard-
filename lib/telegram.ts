// Telegram összekapcsolás — kimenő (napi emlékeztetők is Telegramon,
// lásd app/api/reminder-email és app/api/cron/check-date-digest) és
// bejövő (a founder saját botjának küldött bármilyen üzenetből gyors
// Feladat lesz, lásd app/api/telegram-webhook). Mirrors
// lib/email/resend-config.ts: a bot token egy valódi secret, a
// telegram_config tábla RLS-sel védett, policy nélkül — csak a
// service-role kliens éri el, és a token titkosítva van tárolva.
//
// NEVER import this from a "use client" file — see serverClient.ts.
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { encryptToken, decryptToken } from "@/lib/token-crypto";
import { SITE_URL } from "@/lib/site-url";
import type { TelegramConfig, TelegramTrustedUser, TelegramInviteCode } from "@/lib/supabase/types";

const TELEGRAM_API = "https://api.telegram.org";

async function loadRow(): Promise<TelegramConfig | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("telegram_config")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

function decryptedToken(row: TelegramConfig | null): string | null {
  if (!row?.bot_token_encrypted) return null;
  try {
    return decryptToken(row.bot_token_encrypted);
  } catch {
    return null;
  }
}

export type TelegramConfigStatus = {
  botTokenConfigured: boolean;
  chatId: string | null;
  notificationsEnabled: boolean;
  webhookActive: boolean;
};

/** Non-secret status for the Settings UI — never returns the raw/decrypted token. */
export async function getTelegramConfigStatus(): Promise<TelegramConfigStatus> {
  const row = await loadRow();
  return {
    botTokenConfigured: Boolean(row?.bot_token_encrypted),
    chatId: row?.chat_id ?? null,
    notificationsEnabled: row?.notifications_enabled ?? true,
    webhookActive: row?.webhook_active ?? false,
  };
}

export async function saveTelegramConfig(params: {
  botToken?: string;
  chatId?: string;
  notificationsEnabled?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { ok: false, error: "Supabase service-role kliens nincs beállítva (SUPABASE_SERVICE_ROLE_KEY hiányzik)." };
  }
  const row = await loadRow();
  const update: Record<string, unknown> = {};
  if (params.botToken && params.botToken.trim()) {
    update.bot_token_encrypted = encryptToken(params.botToken.trim());
  }
  if (params.chatId !== undefined) update.chat_id = params.chatId.trim() || null;
  if (params.notificationsEnabled !== undefined) update.notifications_enabled = params.notificationsEnabled;

  const { error } = row
    ? await supabase.from("telegram_config").update(update).eq("id", row.id)
    : await supabase.from("telegram_config").insert(update);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function clearTelegramBotToken(): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;
  const row = await loadRow();
  if (!row) return;
  // A token törlése a webhookot is érvényteleníti — nincs már kulcs,
  // amivel a Telegram API-t hívni lehetne, hogy leállítsuk, úgyhogy csak
  // a saját állapotunkat takarítjuk.
  await supabase
    .from("telegram_config")
    .update({ bot_token_encrypted: null, webhook_active: false, webhook_secret: null })
    .eq("id", row.id);
}

export type TelegramSendResult = { ok: true } | { ok: false; error: string };

/** Küld egy szöveges üzenetet a mentett chat_id-nak. Best-effort hívóknak
 * (napi emlékeztetők) szánva — a hívó eldönti, hogy egy sikertelen küldés
 * megszakítsa-e a teljes route-ot, vagy csak elnyelje a hibát. */
export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
  const row = await loadRow();
  const token = decryptedToken(row);
  if (!token) return { ok: false, error: "Nincs beállítva Telegram bot token." };
  if (!row?.chat_id) return { ok: false, error: "Nincs beállítva Telegram chat ID." };

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: row.chat_id, text }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description || `Telegram API hiba (${res.status}).` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Hálózati hiba a Telegram API hívásakor." };
  }
}

/** Csak akkor küld, ha a founder be is kapcsolta az értesítéseket és van
 * mentett chat_id — a napi emlékeztető cron route-ok ezt hívják, nem
 * közvetlenül a sendTelegramMessage-et, hogy a kikapcsolt állapot
 * némán, hiba nélkül kihagyja a küldést. */
export async function sendTelegramNotification(text: string): Promise<TelegramSendResult> {
  const status = await getTelegramConfigStatus();
  if (!status.notificationsEnabled || !status.botTokenConfigured || !status.chatId) {
    return { ok: false, error: "Telegram értesítések nincsenek beállítva vagy ki vannak kapcsolva." };
  }
  return sendTelegramMessage(text);
}

/**
 * Beállítás-folyamat 2. lépése — miután a founder elküldött egy üzenetet
 * a saját botjának, ez lekéri a legutóbbi beszélgetés chat_id-ját a
 * Telegram getUpdates API-jával, és elmenti, hogy ne kelljen neki kézzel
 * numerikus ID-kat keresgélnie.
 */
export async function fetchAndSaveLatestChatId(): Promise<{ ok: true; chatId: string } | { ok: false; error: string }> {
  const row = await loadRow();
  const token = decryptedToken(row);
  if (!token) return { ok: false, error: "Nincs beállítva Telegram bot token." };

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/getUpdates?limit=1&offset=-1`);
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description || `Telegram API hiba (${res.status}).` };
    const update = (data.result as unknown[])[data.result.length - 1] as
      | { message?: { chat?: { id?: number } } }
      | undefined;
    const chatId = update?.message?.chat?.id;
    if (!chatId) {
      return {
        ok: false,
        error: "Nem találtam üzenetet a botnak — előbb küldj neki egy üzenetet Telegramban, aztán próbáld újra.",
      };
    }
    const saved = await saveTelegramConfig({ chatId: String(chatId) });
    if (!saved.ok) return saved;
    return { ok: true, chatId: String(chatId) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Hálózati hiba a Telegram API hívásakor." };
  }
}

function generateWebhookSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Bekapcsolja a bejövő üzenet-fogadást: regisztrálja a webhook URL-t a
 * Telegramnál, egy saját, véletlen titokkal — lásd a schema.sql
 * webhook_secret kommentjét arról, miért kell ez. */
export async function enableTelegramWebhook(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase service-role kliens nincs beállítva." };
  const row = await loadRow();
  const token = decryptedToken(row);
  if (!token) return { ok: false, error: "Nincs beállítva Telegram bot token." };
  if (!row?.id) return { ok: false, error: "Előbb mentsd el a bot tokent." };

  const secret = generateWebhookSecret();
  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: `${SITE_URL}/api/telegram-webhook`,
        secret_token: secret,
        allowed_updates: ["message"],
      }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description || `Telegram API hiba (${res.status}).` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Hálózati hiba a Telegram API hívásakor." };
  }

  const { error } = await supabase
    .from("telegram_config")
    .update({ webhook_secret: secret, webhook_active: true })
    .eq("id", row.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function disableTelegramWebhook(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase service-role kliens nincs beállítva." };
  const row = await loadRow();
  const token = decryptedToken(row);
  if (token) {
    try {
      await fetch(`${TELEGRAM_API}/bot${token}/deleteWebhook`, { method: "POST" });
    } catch {
      // Best-effort — ha a Telegram API hívás elbukik, a saját
      // webhook_active=false állapotunk akkor is megakadályozza, hogy a
      // webhook route bármit feldolgozzon.
    }
  }
  if (!row?.id) return { ok: true };
  const { error } = await supabase
    .from("telegram_config")
    .update({ webhook_active: false, webhook_secret: null })
    .eq("id", row.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type TelegramSenderRole = "owner" | "trusted" | "public";

/**
 * A webhook route maga hívja — először ellenőrzi, hogy a bejövő kérés
 * tényleg a Telegramtól jött-e (a saját, mentett webhook_secret-tel
 * egyezik-e a fejléc), aztán besorolja a küldőt:
 *   - "owner": a telegram_config.chat_id (a founder saját fiókja)
 *   - "trusted": szerepel a telegram_trusted_users táblában (meghívó
 *     kóddal csatlakozott csapattag)
 *   - "public": ismeretlen chat — a webhook route ezt mindig
 *     Megkeresésként kezeli, soha nem Feladatként, lásd a schema.sql
 *     telegram_trusted_users kommentjét.
 * A secret_token-ellenőrzés mindhárom esetben kötelező — csak az dönti
 * el, hogy a kérés egyáltalán a Telegramtól jött-e, nem azt, kitől.
 */
export async function classifyTelegramSender(
  secretHeader: string | null,
  chatId: number
): Promise<{ ok: true; role: TelegramSenderRole } | { ok: false; reason: string }> {
  const row = await loadRow();
  if (!row?.webhook_active || !row.webhook_secret) return { ok: false, reason: "A webhook nincs aktiválva." };
  if (secretHeader !== row.webhook_secret) return { ok: false, reason: "Érvénytelen webhook secret." };

  if (String(chatId) === row.chat_id) return { ok: true, role: "owner" };

  const supabase = getSupabaseServiceClient();
  if (supabase) {
    const { data } = await supabase
      .from("telegram_trusted_users")
      .select("id")
      .eq("chat_id", String(chatId))
      .maybeSingle();
    if (data) return { ok: true, role: "trusted" };
  }

  return { ok: true, role: "public" };
}

function generateInviteCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("").toUpperCase();
}

export async function listTrustedUsers(): Promise<TelegramTrustedUser[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];
  const { data } = await supabase.from("telegram_trusted_users").select("*").order("created_at", { ascending: false });
  return data ?? [];
}

export async function removeTrustedUser(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase service-role kliens nincs beállítva." };
  const { error } = await supabase.from("telegram_trusted_users").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** "Csapattag meghívása" — egy 24 órán belül lejáró, egyszer felhasználható
 * kódot generál. A founder ezt küldi el a csapattagnak egy külső
 * csatornán (pl. WhatsApp); a csapattag a "/csatlakozas KÓD" üzenettel
 * váltja be a botban, lásd redeemInviteCode. */
export async function createInviteCode(label: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase service-role kliens nincs beállítva." };
  if (!label.trim()) return { ok: false, error: "Adj meg egy nevet a csapattagnak." };
  const code = generateInviteCode();
  const { error } = await supabase.from("telegram_invite_codes").insert({ code, label: label.trim() });
  if (error) return { ok: false, error: error.message };
  return { ok: true, code };
}

export async function listInviteCodes(): Promise<TelegramInviteCode[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("telegram_invite_codes")
    .select("*")
    .is("used_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function deleteInviteCode(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase service-role kliens nincs beállítva." };
  const { error } = await supabase.from("telegram_invite_codes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** A webhook route hívja "/csatlakozas KÓD" üzenetnél — lásd
 * app/api/telegram-webhook. Érvényes, még fel nem használt, le nem járt
 * kód esetén felveszi a küldőt a telegram_trusted_users táblába. */
export async function redeemInviteCode(
  code: string,
  chatId: number
): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase service-role kliens nincs beállítva." };

  const { data: invite } = await supabase
    .from("telegram_invite_codes")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .is("used_at", null)
    .maybeSingle();

  if (!invite) return { ok: false, error: "Érvénytelen vagy már felhasznált kód." };
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "Ez a kód már lejárt — kérj egy újat." };
  }

  const { error: trustedError } = await supabase
    .from("telegram_trusted_users")
    .upsert({ chat_id: String(chatId), label: invite.label }, { onConflict: "chat_id" });
  if (trustedError) return { ok: false, error: trustedError.message };

  await supabase
    .from("telegram_invite_codes")
    .update({ used_at: new Date().toISOString(), used_by_chat_id: String(chatId) })
    .eq("id", invite.id);

  return { ok: true, label: invite.label };
}
