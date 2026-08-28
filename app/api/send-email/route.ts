import { NextResponse } from "next/server";
import { getEmailSender } from "@/lib/email";

// Sends an email via whichever provider is active (see lib/email/index.ts
// — Gmail by default, Resend if EMAIL_PROVIDER=resend). Runs server-side
// only, same as before: real secrets (Google/Resend credentials) must
// never reach the browser, which is why this stays behind an API route
// instead of being called directly from the dashboard pages.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
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

  const result = await getEmailSender().send({ to, subject, body });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
