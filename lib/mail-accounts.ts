// Postafiók — mail_accounts CRUD, szerver-only (service-role kliens, lásd
// supabase/schema.sql: a tábla RLS-sel védett, policy nélkül). A jelszó
// lib/mail-crypto.ts-sel titkosítva kerül tárolásra, és SOHA nem kerül
// vissza a böngészőnek — lásd toAccountSummary lent, ami kihagyja
// password_encrypted-et a válaszból.
//
// Csak API route-okból importálható (app/api/mail/accounts/...), soha
// "use client" komponensből.
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { encryptMailSecret, isMailEncryptionConfigured } from "@/lib/mail-crypto";
import type { MailAccount, MailAccountInsert, MailAccountSummary, MailAccountUpdate } from "@/lib/supabase/types";

export const MAIL_ENCRYPTION_MISSING_ERROR =
  "MAIL_ENCRYPTION_KEY nincs beállítva a szerveren — kérd meg a founder-t, hogy állítsa be Vercelen (lásd a feladat elfogadási feltételeit).";

export function toAccountSummary(account: MailAccount): MailAccountSummary {
  const summary: MailAccountSummary = { ...account, has_password: Boolean(account.password_encrypted) };
  delete (summary as Partial<MailAccount>).password_encrypted;
  return summary;
}

/** "Küldésre kész?" — ugyanaz a szerepe, mint lib/brevo.ts
 * isBrevoConfigured()-jának volt a First 20 fülön, FELVÁLTVA azt (a
 * feladat "nem használunk Brevót" kérése): nincs MAIL_ENCRYPTION_KEY
 * vagy egyetlen aktív postafiók sincs felvéve → a küldés UI-k ("Brevo
 * nincs beállítva" helyett) ezt a magyarázó üzenetet mutatják, az
 * Előnézet viszont attól is működik. app/api/mail/send-status olvassa
 * ki ezt a GET route-on át. */
export async function isMailSendConfigured(): Promise<{ configured: boolean; missing: string[] }> {
  const missing: string[] = [];
  if (!isMailEncryptionConfigured()) missing.push("MAIL_ENCRYPTION_KEY");
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    missing.push("Supabase");
    return { configured: false, missing };
  }
  const { count } = await supabase.from("mail_accounts").select("id", { count: "exact", head: true }).eq("is_active", true);
  if (!count) missing.push("postafiók (Postafiók → Fiókok)");
  return { configured: missing.length === 0, missing };
}

export async function listMailAccounts(): Promise<
  { ok: true; accounts: MailAccountSummary[] } | { ok: false; error: string }
> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase nincs konfigurálva." };
  const { data, error } = await supabase.from("mail_accounts").select("*").order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, accounts: (data ?? []).map(toAccountSummary) };
}

/** Belső használatra (küldés/szinkron route-ok) — a VALÓDI sort adja
 * vissza, titkosított jelszóval. Soha ne adjuk tovább a válaszban a
 * böngészőnek. */
export async function getMailAccountRaw(id: string): Promise<MailAccount | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const { data } = await supabase.from("mail_accounts").select("*").eq("id", id).maybeSingle();
  return data ?? null;
}

export async function getDefaultMailAccountRaw(): Promise<MailAccount | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("mail_accounts")
    .select("*")
    .eq("is_default", true)
    .eq("is_active", true)
    .maybeSingle();
  if (data) return data;
  // Nincs kijelölt alapértelmezett — az első aktív fiók a fallback, hogy
  // a küldés route sose akadjon el egyetlen fiók esetén, ha valaki
  // elfelejtette bejelölni "alapértelmezettnek".
  const { data: fallback } = await supabase
    .from("mail_accounts")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return fallback ?? null;
}

type CreateInput = Omit<MailAccountInsert, "password_encrypted"> & { name: string; email: string; username: string; password: string };

export async function createMailAccount(input: CreateInput): Promise<{ ok: true; account: MailAccountSummary } | { ok: false; error: string }> {
  if (!isMailEncryptionConfigured()) return { ok: false, error: MAIL_ENCRYPTION_MISSING_ERROR };
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase nincs konfigurálva." };
  const { password, ...rest } = input;
  if (!password.trim()) return { ok: false, error: "Jelszó megadása kötelező." };

  const insert: MailAccountInsert = { ...rest, password_encrypted: encryptMailSecret(password) };
  if (insert.is_default) {
    await supabase.from("mail_accounts").update({ is_default: false }).eq("is_default", true);
  }
  const { data, error } = await supabase.from("mail_accounts").insert(insert).select().single();
  if (error || !data) return { ok: false, error: error?.message || "Nem sikerült létrehozni a fiókot." };
  return { ok: true, account: toAccountSummary(data) };
}

type UpdateInput = Omit<MailAccountUpdate, "password_encrypted"> & { password?: string };

export async function updateMailAccount(
  id: string,
  input: UpdateInput
): Promise<{ ok: true; account: MailAccountSummary } | { ok: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase nincs konfigurálva." };
  const { password, ...rest } = input;
  const update: MailAccountUpdate = { ...rest };
  if (password && password.trim()) {
    if (!isMailEncryptionConfigured()) return { ok: false, error: MAIL_ENCRYPTION_MISSING_ERROR };
    update.password_encrypted = encryptMailSecret(password);
  }
  if (update.is_default) {
    await supabase.from("mail_accounts").update({ is_default: false }).eq("is_default", true).neq("id", id);
  }
  const { data, error } = await supabase.from("mail_accounts").update(update).eq("id", id).select().single();
  if (error || !data) return { ok: false, error: error?.message || "Nem sikerült menteni a fiókot." };
  return { ok: true, account: toAccountSummary(data) };
}

/** `deleteMessages=true` esetén a fiókhoz tartozó mail_messages sorok is
 * törlődnek (a feladat 1. pontja explicit kéri ezt a választási
 * lehetőséget) — alapértelmezetten megmaradnak, csak a fiók hitelesítő
 * adatai törlődnek (a mail_messages.account_id FK "on delete cascade",
 * ezért enélkül ELŐSZÖR le kell választani a sorokat egy NULL-azható
 * kapcsolatra — mivel account_id not null, a gyakorlatban ez azt
 * jelenti, hogy "megtartás" esetén a fiók sorát NEM töröljük fizikailag,
 * csak inaktívvá és "archivált" névvel jelöljük, hogy a levelek
 * olvashatók maradjanak anélkül, hogy egy törölt idegen kulcsra
 * mutatnának. */
export async function deleteMailAccount(id: string, deleteMessages: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return { ok: false, error: "Supabase nincs konfigurálva." };

  if (deleteMessages) {
    const { error: deleteError } = await supabase.from("mail_accounts").delete().eq("id", id);
    if (deleteError) return { ok: false, error: deleteError.message };
    return { ok: true };
  }

  // Megtartjuk a leveleket — a fiókot nem töröljük fizikailag (az
  // account_id FK not null-ja miatt), hanem inaktiváljuk és a
  // hitelesítő adatait kiürítjük, hogy ne lehessen vele tovább
  // IMAP/SMTP-t hívni. A törölt fiók így "archivált forrásként" marad
  // látható a levelek mellett.
  const { error } = await supabase
    .from("mail_accounts")
    .update({
      is_active: false,
      is_default: false,
      username: "(törölt fiók)",
      password_encrypted: "",
      last_test_ok: null,
      last_test_error: "A fiók törölve — a hitelesítő adatok eltávolítva.",
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
