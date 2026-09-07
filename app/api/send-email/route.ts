import { NextResponse } from "next/server";
import { getEmailSender } from "@/lib/email";
import { getCompanySettings, DEFAULT_EMAIL_SIGNATURE } from "@/lib/company-settings";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";

// Sends an email via whichever provider is active (see lib/email/index.ts
// — Gmail by default, Resend if EMAIL_PROVIDER=resend). Runs server-side
// only, same as before: real secrets (Google/Resend credentials) must
// never reach the browser, which is why this stays behind an API route
// instead of being called directly from the dashboard pages.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// This is the one chokepoint every "Email küldése" button across the app
// already goes through, so it's also the one place to append the
// Beállítások → Email-aláírás text — no need to touch every caller of
// EmailComposeModal individually.
async function resolveSignature(): Promise<string> {
  // Service-role client — company_settings now requires auth.uid(),
  // which this server-to-server call (reached behind proxy.ts's login
  // redirect, but without the browser's session JWT) could never
  // satisfy through the old anon-key client.
  const supabase = getSupabaseServiceClient();
  if (!supabase) return DEFAULT_EMAIL_SIGNATURE;
  try {
    const settings = await getCompanySettings(supabase);
    return settings?.email_signature?.trim() || DEFAULT_EMAIL_SIGNATURE;
  } catch {
    return DEFAULT_EMAIL_SIGNATURE;
  }
}

export async function POST(request: Request) {
  let payload: { to?: string; subject?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Érvénytelen kérés." }, { status: 400 });
  }

  const to = payload.to?.trim() ?? "";
  const subject = payload.subject?.trim() ?? "";
  const rawBody = payload.body ?? "";

  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ ok: false, error: "Adj meg egy érvényes címzett email címet." }, { status: 400 });
  }
  if (!subject) {
    return NextResponse.json({ ok: false, error: "A tárgy mező nem lehet üres." }, { status: 400 });
  }
  if (!rawBody.trim()) {
    return NextResponse.json({ ok: false, error: "Az üzenet nem lehet üres." }, { status: 400 });
  }

  const signature = await resolveSignature();
  // Idempotent: a caller composing multiple times (edit, re-send) never
  // ends up with the signature duplicated at the end of the body.
  const body = rawBody.trim().endsWith(signature) ? rawBody : `${rawBody}\n\n${signature}`;

  const result = await getEmailSender().send({ to, subject, body });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
