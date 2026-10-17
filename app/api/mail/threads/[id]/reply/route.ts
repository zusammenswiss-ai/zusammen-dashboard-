import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { sendAndLogMail } from "@/lib/mail-send";

type Body = {
  accountId?: string;
  to?: string;
  subject?: string;
  html?: string;
  authorName?: string;
};

// POST /api/mail/threads/[id]/reply — válasz a szálba, "Re:" tárggyal,
// In-Reply-To/References fejlécekkel a szál utolsó üzenetéhez láncolva
// (feladat 3. pont). A válasz-küldés automatikusan "válaszra vár"
// állapotból kimozdítja a szálat (closed → reopened logika a
// sendAndLogMail/findOrCreateSignupThread-ben csak kimenő levélnél fut,
// ide explicit: ha a szál "done" volt, itt is újranyitjuk).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.html?.trim()) return NextResponse.json({ ok: false, error: "A levél szövege nem lehet üres." }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const { data: thread, error: threadError } = await supabase.from("mail_threads").select("*").eq("id", id).maybeSingle();
  if (threadError) return NextResponse.json({ ok: false, error: threadError.message }, { status: 500 });
  if (!thread) return NextResponse.json({ ok: false, error: "A szál nem található." }, { status: 404 });

  const { data: lastMessage } = await supabase
    .from("mail_messages")
    .select("*")
    .eq("thread_id", id)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const to = body.to?.trim() || (lastMessage ? (lastMessage.direction === "in" ? lastMessage.from_addr : lastMessage.to_addrs?.[0]) : null);
  if (!to) return NextResponse.json({ ok: false, error: "Nincs címzett — add meg kézzel." }, { status: 400 });

  const subject = body.subject?.trim() || (thread.subject.toLowerCase().startsWith("re:") ? thread.subject : `Re: ${thread.subject}`);
  const referencesHeader = lastMessage
    ? [lastMessage.references_header, lastMessage.message_id].filter(Boolean).join(" ")
    : null;

  const signupId = lastMessage?.signup_id ?? null;

  const result = await sendAndLogMail({
    supabase,
    accountId: body.accountId || undefined,
    to,
    subject,
    html: body.html,
    inReplyToMessageId: lastMessage?.message_id ?? null,
    referencesHeader,
    threadId: id,
    signupId,
    sentVia: "manual",
    sentBy: body.authorName?.trim() || null,
  });

  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, messageId: result.messageId });
}
