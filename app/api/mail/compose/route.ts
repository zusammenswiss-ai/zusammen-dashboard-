import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { sendAndLogMail } from "@/lib/mail-send";

type Body = {
  accountId?: string;
  to?: string;
  toName?: string;
  subject?: string;
  html?: string;
  signupId?: string;
  authorName?: string;
};

// POST /api/mail/compose — "Új levél írása" a Postaládából (feladat 4.
// pont): fiók, címzett (jelentkező-választóból vagy szabad cím), tárgy,
// szöveg. Mindig ÚJ szálat nyit (signupId esetén a jelentkező folyamatos
// szálába, lásd findOrCreateSignupThread a sendAndLogMail-en belül).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.to?.trim()) return NextResponse.json({ ok: false, error: "Címzett megadása kötelező." }, { status: 400 });
  if (!body.subject?.trim()) return NextResponse.json({ ok: false, error: "Tárgy megadása kötelező." }, { status: 400 });
  if (!body.html?.trim()) return NextResponse.json({ ok: false, error: "A levél szövege nem lehet üres." }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const result = await sendAndLogMail({
    supabase,
    accountId: body.accountId || undefined,
    to: body.to.trim(),
    toName: body.toName?.trim() || null,
    subject: body.subject.trim(),
    html: body.html,
    signupId: body.signupId || null,
    sentVia: "manual",
    sentBy: body.authorName?.trim() || null,
  });

  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, messageId: result.messageId, threadId: result.threadId });
}
