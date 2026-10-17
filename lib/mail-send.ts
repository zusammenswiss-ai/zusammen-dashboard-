// Postafiók — a tényleges küldés + "Elküldött" mappába másolás + napló
// egyetlen helyen. Szerver-only (service-role kliens, nodemailer,
// imapflow) — csak API route-okból/lib-ekből importálható.
//
// Vercel szerver nélküli függvényben fut: minden hívás egy rövid
// SMTP-kapcsolatot (nodemailer) és egy rövid IMAP-kapcsolatot
// (imapflow, csak az append-hez) nyit és zár — nincs tartós kapcsolat.
import { randomUUID } from "crypto";
import MailComposer from "nodemailer/lib/mail-composer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createImapClient, createSmtpTransport } from "@/lib/mail-transport";
import { getDefaultMailAccountRaw, getMailAccountRaw } from "@/lib/mail-accounts";
import { findOrCreateSignupThread } from "@/lib/mail-threads";
import type { MailAccount, MailMessageSentVia, ServerDatabase } from "@/lib/supabase/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_HOURLY_LIMIT = 20;

/** Óránkénti küldési limit — a feladat 2. pontja kéri, "hogy hiba esetén
 * se menjen ki tömeg". Globális (nem fiókonkénti) számláló, a
 * mail_messages direction='out' sorokon az elmúlt órában — a
 * mail_settings.hourly_send_limit sor állítja, 20 az alapértelmezett,
 * ha még nincs mentve beállítás. */
async function checkHourlySendLimit(supabase: SupabaseClient<ServerDatabase>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: settings } = await supabase.from("mail_settings").select("hourly_send_limit").maybeSingle();
  const limit = settings?.hourly_send_limit ?? DEFAULT_HOURLY_LIMIT;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("mail_messages")
    .select("id", { count: "exact", head: true })
    .eq("direction", "out")
    .gte("created_at", since);
  if (error) return { ok: false, error: error.message };
  if ((count ?? 0) >= limit) {
    return { ok: false, error: `Elérted az óránkénti küldési limitet (${limit} levél/óra) — próbáld újra később.` };
  }
  return { ok: true };
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fromDomain(email: string): string {
  return email.split("@")[1] || "das-zusammen.ch";
}

/** A tényleges IMAP APPEND az "Elküldött" mappába — a mappa nevét nem
 * hardcode-oljuk ("Sent"), hanem a SPECIAL-USE IMAP-kiterjesztéssel (ha
 * a szerver támogatja) vagy az imapflow beépített, lokalizált
 * név-egyeztetésével (pl. német "Gesendet") derítjük ki, "Sent"
 * tartalékkal, ha egyik sem talál. Ha az append meghiúsul, a küldés
 * MÁR megtörtént — ezt a hibát csak naplózzuk, nem buktatjuk el miatta
 * az egész műveletet (a levél a címzetthez mindenképpen megérkezett). */
async function appendToSentFolder(account: MailAccount, raw: Buffer, date: Date): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = createImapClient(account);
  try {
    await client.connect();
    const mailboxes = await client.list();
    const sentBox = mailboxes.find((m) => m.specialUse === "\\Sent");
    const path = sentBox?.path || "Sent";
    const result = await client.append(path, raw, ["\\Seen"], date);
    if (!result) return { ok: false, error: "Az IMAP szerver nem erősítette meg a mentést." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    try {
      client.close();
    } catch {
      // A küldés már megtörtént — a lezárási hiba nem releváns a hívónak.
    }
  }
}

export type SendMailInput = {
  supabase: SupabaseClient<ServerDatabase>;
  accountId?: string | null;
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text?: string;
  inReplyToMessageId?: string | null;
  referencesHeader?: string | null;
  /** Ha meg van adva, ehhez a jelentkezőhöz kötött (meglévő vagy új)
   * szálba kerül a levél — lásd lib/mail-threads.ts. */
  signupId?: string | null;
  /** Explicit szál — ha meg van adva, signupId-t felülírja (pl. egy már
   * ismert szálba írt válasznál). */
  threadId?: string | null;
  sentVia: MailMessageSentVia;
  sentBy?: string | null;
  /** Teszt küldésnél true — ekkor a válasz tartalmaz messageId-t, de
   * SEM szál, SEM mail_messages sor nem jön létre (a jelentkező/szál
   * rekordját szándékosan nem érinti egy teszt). */
  skipLogging?: boolean;
};

export type SendMailResult =
  | { ok: true; messageId: string; mailMessageId: string | null; threadId: string | null }
  | { ok: false; error: string };

/** A Postafiók modul egyetlen küldő belépési pontja — SMTP-n küld,
 * "Elküldött" mappába másol, és (ha nem teszt) mail_messages +
 * mail_threads sort ír. Minden jövőbeli küldő felület (First 20,
 * Postaláda compose/válasz, Ügyfélszolgálat sablonválasz) ezt hívja,
 * hogy a küldés/naplózás logikája egyetlen helyen éljen. */
export async function sendAndLogMail(input: SendMailInput): Promise<SendMailResult> {
  const { supabase } = input;

  if (!input.to || !EMAIL_RE.test(input.to.trim())) {
    return { ok: false, error: "Érvénytelen címzett e-mail cím." };
  }

  if (!input.skipLogging) {
    const limitCheck = await checkHourlySendLimit(supabase);
    if (!limitCheck.ok) return limitCheck;
  }

  const account = input.accountId ? await getMailAccountRaw(input.accountId) : await getDefaultMailAccountRaw();
  if (!account) return { ok: false, error: "Nincs beállítva küldő postafiók — vedd fel az elsőt a Postafiók → Fiókok fülön." };
  if (!account.is_active) return { ok: false, error: `A(z) "${account.name}" postafiók inaktív.` };

  const messageId = `<${randomUUID()}@${fromDomain(account.email)}>`;
  const date = new Date();
  const fromHeader = account.from_name ? `"${account.from_name.replace(/"/g, "")}" <${account.email}>` : account.email;

  const mailOptions = {
    from: fromHeader,
    to: input.toName ? `"${input.toName.replace(/"/g, "")}" <${input.to}>` : input.to,
    subject: input.subject,
    html: input.html,
    text: input.text || htmlToText(input.html),
    messageId,
    date,
    ...(input.inReplyToMessageId ? { inReplyTo: input.inReplyToMessageId } : {}),
    ...(input.referencesHeader ? { references: input.referencesHeader } : {}),
  };

  const transport = createSmtpTransport(account);
  try {
    await transport.sendMail(mailOptions);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `SMTP: ${err.message}` : "Nem sikerült elküldeni a levelet." };
  } finally {
    transport.close();
  }

  // Elküldve — az IMAP-másolás/naplózás hibája már nem teszi
  // sikertelenné magát a küldést, csak jelezzük, ha nem sikerült.
  const composer = new MailComposer(mailOptions);
  let appendError: string | null = null;
  try {
    const raw = await new Promise<Buffer>((resolve, reject) => {
      composer.compile().build((err: Error | null, message: Buffer) => (err ? reject(err) : resolve(message)));
    });
    const appendResult = await appendToSentFolder(account, raw, date);
    if (!appendResult.ok) appendError = appendResult.error;
  } catch (err) {
    appendError = err instanceof Error ? err.message : String(err);
  }
  if (appendError) {
    console.error(`[mail] Elküldött mappába másolás sikertelen (${account.email}): ${appendError}`);
  }

  if (input.skipLogging) {
    return { ok: true, messageId, mailMessageId: null, threadId: null };
  }

  let threadId = input.threadId ?? null;
  if (!threadId && input.signupId) {
    const threadResult = await findOrCreateSignupThread(supabase, input.signupId, input.subject);
    if (!threadResult.ok) {
      console.error(`[mail] Szál feloldása sikertelen: ${threadResult.error}`);
    } else {
      threadId = threadResult.threadId;
    }
  }

  let mailMessageId: string | null = null;
  if (threadId) {
    const { data: row, error: insertError } = await supabase
      .from("mail_messages")
      .insert({
        thread_id: threadId,
        account_id: account.id,
        direction: "out",
        folder: "Sent",
        message_id: messageId,
        in_reply_to: input.inReplyToMessageId ?? null,
        references_header: input.referencesHeader ?? null,
        from_addr: account.email,
        from_name: account.from_name,
        to_addrs: [input.to],
        subject: input.subject,
        body_text: mailOptions.text,
        body_html_sanitized: input.html,
        received_at: date.toISOString(),
        read_at: date.toISOString(),
        signup_id: input.signupId ?? null,
        status: "sent",
        sent_via: input.sentVia,
        sent_by: input.sentBy ?? null,
      })
      .select("id")
      .single();
    if (insertError) console.error(`[mail] mail_messages napló sikertelen: ${insertError.message}`);
    else mailMessageId = row?.id ?? null;

    await supabase.from("mail_threads").update({ last_message_at: date.toISOString(), subject: input.subject }).eq("id", threadId);
  }

  return { ok: true, messageId, mailMessageId, threadId };
}
