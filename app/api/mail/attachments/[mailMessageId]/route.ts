import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { getMailAccountRaw } from "@/lib/mail-accounts";
import { createImapClient } from "@/lib/mail-transport";

export const runtime = "nodejs";
export const maxDuration = 20;

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB — a feladat 4. pontja explicit limitet kér.

// GET /api/mail/attachments/[mailMessageId]?part=<partId> — csatolmány
// letöltése KATTINTÁSRA, szerveroldalon, méretkorláttal (feladat 4.
// pont: "A csatolmányokat csak kattintásra, szerveroldalon tölti le").
// Nincs eltárolva bináris tartalom szinkronkor (lásd lib/mail-sync.ts
// attachments_meta — csak metaadat) — ez a route él, IMAP-on tölti le a
// kért partId-t a levél eredeti fiókjából/mappájából/UID-jéből.
export async function GET(request: Request, { params }: { params: Promise<{ mailMessageId: string }> }) {
  const { mailMessageId } = await params;
  const url = new URL(request.url);
  const partId = url.searchParams.get("part");
  if (!partId) return NextResponse.json({ ok: false, error: "Hiányzó partId." }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const { data: message } = await supabase.from("mail_messages").select("*").eq("id", mailMessageId).maybeSingle();
  if (!message) return NextResponse.json({ ok: false, error: "A levél nem található." }, { status: 404 });
  if (!message.imap_uid) return NextResponse.json({ ok: false, error: "Ennek a levélnek nincs IMAP-forrása (nem szinkronizált)." }, { status: 404 });

  const attachment = (message.attachments_meta ?? []).find((a: { partId: string }) => a.partId === partId);
  if (!attachment) return NextResponse.json({ ok: false, error: "A melléklet nem található." }, { status: 404 });
  if (attachment.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ ok: false, error: `A melléklet túl nagy (${Math.round(attachment.size / 1024 / 1024)} MB) — a letöltési limit 10 MB.` }, { status: 413 });
  }

  const account = await getMailAccountRaw(message.account_id);
  if (!account) return NextResponse.json({ ok: false, error: "A postafiók nem található." }, { status: 404 });

  const client = createImapClient(account);
  try {
    await client.connect();
    const lock = await client.getMailboxLock(message.folder);
    try {
      const result = await client.download(String(message.imap_uid), partId, { uid: true, maxBytes: MAX_ATTACHMENT_BYTES });
      if (!result.content) {
        return NextResponse.json({ ok: false, error: "A melléklet letöltése sikertelen." }, { status: 502 });
      }

      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of result.content) {
        total += chunk.length;
        if (total > MAX_ATTACHMENT_BYTES) {
          result.content.destroy();
          return NextResponse.json({ ok: false, error: "A melléklet túl nagy — a letöltési limit 10 MB." }, { status: 413 });
        }
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": attachment.contentType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.name)}"`,
          "Content-Length": String(buffer.length),
        },
      });
    } finally {
      lock.release();
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Nem sikerült letölteni a mellékletet." }, { status: 502 });
  } finally {
    try {
      client.close();
    } catch {
      // A letöltés már lezajlott (vagy hibára futott) — a lezárási hiba nem releváns.
    }
  }
}
