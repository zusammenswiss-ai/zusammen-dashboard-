// Postafiók — IMAP-szinkron: bejövő (INBOX) és elküldött (Sent) levelek
// behozatala, UID alapon inkrementálisan. Szerver-only (imapflow,
// mailparser, service-role kliens) — csak API route-okból (app/api/mail/
// sync, app/api/cron/mail-sync) importálható.
//
// Vercel szerver nélküli függvényben fut: egy futás MINDIG rövid IMAP-
// kapcsolattal ér véget (connect → fetch néhány üzenetet → logout),
// nincs tartós kapcsolat (lásd a feladat 3. pontjának "KALAPOS"
// megjegyzését). Egy futás legfeljebb ~20 másodpercet célzunk — ezért
// fiókonkénti/mappánkénti MAX_MESSAGES_PER_RUN-nal korlátozzuk az
// egyszerre feldolgozott üzenetek számát; egy nagy hátralék több
// "Frissítés"-kattintás/cron-futás alatt fogy el, mert a last_uid csak
// a ténylegesen feldolgozott üzenetekig lép előre.
import { randomUUID } from "crypto";
import { simpleParser } from "mailparser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createImapClient } from "@/lib/mail-transport";
import { sanitizeInboundHtml } from "@/lib/mail-sanitize";
import { findOrCreateSignupThread } from "@/lib/mail-threads";
import type { MailAccount, ServerDatabase } from "@/lib/supabase/types";

const MAX_MESSAGES_PER_RUN = 50;
const DEFAULT_LOOKBACK_DAYS = 30;
const FOLDERS: { key: "INBOX" | "Sent"; specialUse: string | null }[] = [
  { key: "INBOX", specialUse: null },
  { key: "Sent", specialUse: "\\Sent" },
];

function addressList(addr: { value?: { address?: string; name?: string }[] } | undefined): string[] {
  return (addr?.value ?? []).map((a) => a.address).filter((a): a is string => Boolean(a));
}

function firstAddress(addr: { value?: { address?: string; name?: string }[] } | undefined): { address: string | null; name: string | null } {
  const first = addr?.value?.[0];
  return { address: first?.address ?? null, name: first?.name ?? null };
}

function normalizeReferences(ref: string[] | string | undefined): string | null {
  if (!ref) return null;
  return Array.isArray(ref) ? ref.join(" ") : ref;
}

async function resolveSignupId(supabase: SupabaseClient<ServerDatabase>, emails: string[]): Promise<string | null> {
  if (emails.length === 0) return null;
  const lowered = emails.map((e) => e.toLowerCase());
  const { data } = await supabase.from("first20_signups").select("id, email").in("email", lowered).limit(1);
  return data?.[0]?.id ?? null;
}

/** A szál feloldása egy beérkezett/felfedezett üzenethez: elsőként a
 * fejlécek (In-Reply-To/References) alapján egy már ismert
 * message_id-hoz láncoljuk — ez működik attól függetlenül is, hogy a
 * levél kapcsolódik-e egy First 20 jelentkezőhöz. Ha nincs fejléc-
 * egyezés, de ismert a feladó/címzett (signup_id), a jelentkező
 * folyamatos szálába kerül (ugyanaz, mint a kimenő küldésnél). Ha egyik
 * sem, új "Besorolatlan" szál jön létre — ez felel meg az "Ismeretlen
 * feladó" nézetnek (nincs külön oszlop rá, a UI a signup_id IS NULL +
 * nincs mail_thread_links sor alapján dönti el). */
async function resolveThreadId(
  supabase: SupabaseClient<ServerDatabase>,
  params: { messageId: string | null; inReplyTo: string | null; referencesHeader: string | null; signupId: string | null; subject: string }
): Promise<string> {
  const candidateIds = [params.inReplyTo, ...(params.referencesHeader ? params.referencesHeader.split(/\s+/) : [])].filter(
    (v): v is string => Boolean(v)
  );
  if (candidateIds.length > 0) {
    const { data: match } = await supabase.from("mail_messages").select("thread_id").in("message_id", candidateIds).limit(1).maybeSingle();
    if (match?.thread_id) {
      await reopenIfDone(supabase, match.thread_id);
      return match.thread_id;
    }
  }

  if (params.signupId) {
    const result = await findOrCreateSignupThread(supabase, params.signupId, params.subject);
    if (result.ok) return result.threadId;
  }

  const { data: newThread, error } = await supabase
    .from("mail_threads")
    .insert({ subject: params.subject, area: "unsorted", area_is_manual: false, status: "new" })
    .select("id")
    .single();
  if (error || !newThread) throw new Error(error?.message || "Nem sikerült szálat létrehozni.");
  await supabase.from("mail_activity").insert({ thread_id: newThread.id, actor: "system", action: "created", detail: { source: "imap_sync" } });
  return newThread.id;
}

async function reopenIfDone(supabase: SupabaseClient<ServerDatabase>, threadId: string): Promise<void> {
  const { data: thread } = await supabase.from("mail_threads").select("status").eq("id", threadId).maybeSingle();
  if (thread?.status === "done") {
    await supabase.from("mail_threads").update({ status: "in_progress", closed_at: null, closed_by: null }).eq("id", threadId);
    await supabase.from("mail_activity").insert({ thread_id: threadId, actor: "system", action: "reopened", detail: { reason: "imap_sync" } });
  }
}

type FolderSyncResult = { folder: string; processed: number; error: string | null };

async function syncAccountFolder(
  supabase: SupabaseClient<ServerDatabase>,
  account: MailAccount,
  folder: { key: "INBOX" | "Sent"; specialUse: string | null },
  lookbackDays: number
): Promise<FolderSyncResult> {
  const client = createImapClient(account);
  let processed = 0;
  try {
    await client.connect();

    let path = folder.key as string;
    if (folder.specialUse) {
      const mailboxes = await client.list();
      const found = mailboxes.find((m) => m.specialUse === folder.specialUse);
      if (found) path = found.path;
      else return { folder: folder.key, processed: 0, error: null }; // nincs Sent mappa — nincs mit szinkronizálni
    }

    const { data: syncState } = await supabase
      .from("mail_sync_state")
      .select("*")
      .eq("account_id", account.id)
      .eq("folder", folder.key)
      .maybeSingle();
    const lastUid = syncState?.last_uid ?? 0;

    const lock = await client.getMailboxLock(path);
    let highestUidSeen = lastUid;
    try {
      let uidsToFetch: number[];
      if (lastUid === 0) {
        const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
        const found = await client.search({ since }, { uid: true });
        uidsToFetch = (found || []).sort((a, b) => a - b).slice(0, MAX_MESSAGES_PER_RUN);
      } else {
        // UID FETCH lastUid+1:* — imapflow range-stringet vár.
        const found = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
        uidsToFetch = (found || [])
          .filter((uid) => uid > lastUid)
          .sort((a, b) => a - b)
          .slice(0, MAX_MESSAGES_PER_RUN);
      }

      for (const uid of uidsToFetch) {
        const message = await client.fetchOne(String(uid), { uid: true, envelope: true, internalDate: true, source: true }, { uid: true });
        if (!message || !message.source) {
          highestUidSeen = Math.max(highestUidSeen, uid);
          continue;
        }
        try {
          const internalDate = message.internalDate ? new Date(message.internalDate) : new Date();
          await processMessage(supabase, account, folder.key, message.uid, message.source, internalDate);
          processed += 1;
        } catch (err) {
          console.error(`[mail-sync] Üzenet feldolgozása sikertelen (${account.email}, ${folder.key}, UID ${uid}): ${err instanceof Error ? err.message : err}`);
        }
        highestUidSeen = Math.max(highestUidSeen, uid);
      }
    } finally {
      lock.release();
    }

    await supabase
      .from("mail_sync_state")
      .upsert({ account_id: account.id, folder: folder.key, last_uid: highestUidSeen, last_synced_at: new Date().toISOString() }, { onConflict: "account_id,folder" });

    return { folder: folder.key, processed, error: null };
  } catch (err) {
    return { folder: folder.key, processed, error: err instanceof Error ? err.message : String(err) };
  } finally {
    try {
      client.close();
    } catch {
      // A szinkron már lezajlott (vagy hibára futott) — a lezárási hiba nem releváns.
    }
  }
}

async function processMessage(
  supabase: SupabaseClient<ServerDatabase>,
  account: MailAccount,
  folder: "INBOX" | "Sent",
  imapUid: number,
  source: Buffer,
  internalDate: Date
): Promise<void> {
  const parsed = await simpleParser(source);
  const messageId = parsed.messageId || `<${randomUUID()}@${account.email.split("@")[1] || "unknown"}>`;

  // Sent mappa: ha ezt a levelet MI küldtük a Dashboardból (lib/mail-send.ts
  // már beírta mail_messages-be küldéskor), ne duplikáljuk — csak az
  // UID-ot/mappát egészítjük ki rajta, hogy a dedup-index véd a jövőben.
  if (folder === "Sent") {
    const { data: existing } = await supabase.from("mail_messages").select("id, imap_uid").eq("account_id", account.id).eq("message_id", messageId).maybeSingle();
    if (existing) {
      if (!existing.imap_uid) {
        await supabase.from("mail_messages").update({ imap_uid: imapUid, folder }).eq("id", existing.id);
      }
      return;
    }
  } else {
    // INBOX: a dedup unique indexe (account_id, folder, imap_uid) úgyis
    // védene, de egy explicit ellenőrzéssel elkerüljük a felesleges
    // szál-/kapcsolat-feloldást egy már feldolgozott üzenetnél (pl. ha
    // egy korábbi futás a sync_state írása előtt szakadt meg).
    const { data: existing } = await supabase.from("mail_messages").select("id").eq("account_id", account.id).eq("folder", folder).eq("imap_uid", imapUid).maybeSingle();
    if (existing) return;
  }

  const direction = folder === "INBOX" ? "in" : "out";
  const { address: fromAddr, name: fromName } = firstAddress(parsed.from);
  const toAddrs = addressList(Array.isArray(parsed.to) ? { value: parsed.to.flatMap((t) => t.value) } : parsed.to);
  const ccAddrs = addressList(Array.isArray(parsed.cc) ? { value: parsed.cc.flatMap((c) => c.value) } : parsed.cc);

  // Jelentkező-társítás: bejövőnél a FELADÓ, egy (a Dashboardon kívül,
  // pl. webmailből) küldött Sent-levélnél a CÍMZETT címe alapján —
  // lásd a feladat 3. pontját ("a feladó e-mail cím egyezik egy
  // first20_signups.email címmel").
  const matchAddrs = direction === "in" ? (fromAddr ? [fromAddr] : []) : toAddrs;
  const signupId = await resolveSignupId(supabase, matchAddrs);

  const subject = parsed.subject || "(nincs tárgy)";
  const inReplyTo = parsed.inReplyTo || null;
  const referencesHeader = normalizeReferences(parsed.references);

  const threadId = await resolveThreadId(supabase, { messageId, inReplyTo, referencesHeader, signupId, subject });

  const bodyHtml = parsed.html ? sanitizeInboundHtml(parsed.html) : null;
  const attachments = (parsed.attachments || []).filter((a) => !a.related || a.contentDisposition === "attachment");

  await supabase.from("mail_messages").insert({
    thread_id: threadId,
    account_id: account.id,
    direction,
    folder,
    imap_uid: imapUid,
    message_id: messageId,
    in_reply_to: inReplyTo,
    references_header: referencesHeader,
    from_addr: fromAddr,
    from_name: fromName,
    to_addrs: toAddrs,
    cc_addrs: ccAddrs,
    subject,
    body_text: parsed.text || null,
    body_html_sanitized: bodyHtml,
    received_at: (parsed.date || internalDate).toISOString(),
    signup_id: signupId,
    has_attachments: attachments.length > 0,
    attachments_meta: attachments.map((a) => ({
      name: a.filename || "melléklet",
      size: a.size,
      contentType: a.contentType,
      partId: a.partId || "",
    })),
    status: "sent",
    sent_via: direction === "out" ? "manual" : null,
  });

  const now = new Date().toISOString();
  await supabase
    .from("mail_threads")
    .update({ last_message_at: now, ...(direction === "in" ? { last_inbound_at: now } : {}), subject })
    .eq("id", threadId);
}

export type MailSyncSummary = {
  accountId: string;
  accountName: string;
  folders: FolderSyncResult[];
};

export async function syncMailAccount(supabase: SupabaseClient<ServerDatabase>, account: MailAccount, lookbackDays: number): Promise<MailSyncSummary> {
  const folders: FolderSyncResult[] = [];
  for (const folder of FOLDERS) {
    folders.push(await syncAccountFolder(supabase, account, folder, lookbackDays));
  }
  return { accountId: account.id, accountName: account.name, folders };
}

export async function syncAllActiveAccounts(supabase: SupabaseClient<ServerDatabase>): Promise<MailSyncSummary[]> {
  const { data: settings } = await supabase.from("mail_settings").select("sync_lookback_days").maybeSingle();
  const lookbackDays = settings?.sync_lookback_days ?? DEFAULT_LOOKBACK_DAYS;

  const { data: accounts } = await supabase.from("mail_accounts").select("*").eq("is_active", true);
  const summaries: MailSyncSummary[] = [];
  for (const account of accounts ?? []) {
    summaries.push(await syncMailAccount(supabase, account, lookbackDays));
  }
  return summaries;
}
