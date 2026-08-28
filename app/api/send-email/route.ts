import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getEmailSender } from "@/lib/email";
import { getCompanySettings, DEFAULT_EMAIL_SIGNATURE } from "@/lib/company-settings";
import type { Database } from "@/lib/supabase/types";

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return DEFAULT_EMAIL_SIGNATURE;
  try {
    const supabase = createClient<Database>(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
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
