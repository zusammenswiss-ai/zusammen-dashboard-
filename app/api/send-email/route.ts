import { NextResponse } from "next/server";
import { Resend } from "resend";

// Sends an email via Resend. Runs server-side only — RESEND_API_KEY must
// never be exposed to the browser (unlike the Supabase anon key, this one
// is a genuine secret), which is why this lives behind an API route
// instead of being called directly from the dashboard pages.
//
// RESEND_FROM_EMAIL / RESEND_REPLY_TO are optional overrides — see the
// README for how to move off the shared onboarding@resend.dev sender once
// a custom domain is verified in Resend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_FROM = "Zusammen <onboarding@resend.dev>";
const DEFAULT_REPLY_TO = "zusammen.swiss@gmail.com";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "RESEND_API_KEY nincs beállítva a szerver környezeti változói között." },
      { status: 500 }
    );
  }

  let payload: { to?: string; subject?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Érvénytelen kérés." }, { status: 400 });
  }

  const to = payload.to?.trim() ?? "";
  const subject = payload.subject?.trim() ?? "";
  const body = payload.body ?? "";

  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ ok: false, error: "Adj meg egy érvényes címzett email címet." }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ ok: false, error: "A tárgy mező nem lehet üres." }, { status: 400 });
  }
  if (!body.trim()) {
    return NextResponse.json({ ok: false, error: "Az üzenet nem lehet üres." }, { status: 400 });
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
    to: [to],
    replyTo: process.env.RESEND_REPLY_TO || DEFAULT_REPLY_TO,
    subject,
    text: body,
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
