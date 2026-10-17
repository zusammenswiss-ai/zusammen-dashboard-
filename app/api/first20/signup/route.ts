import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { isMailSendConfigured } from "@/lib/mail-accounts";
import { sendAndLogMail } from "@/lib/mail-send";
import { isFirst20Lang, first20T, type First20Lang } from "@/lib/first20-i18n";
import type { First20Language, ServerDatabase } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// POST /api/first20/signup — the only way a row ever lands in
// first20_signups; always goes through the service-role client (see
// supabase/schema.sql's comment on that table for why its RLS has no
// public insert policy at all). Deliberately unauthenticated — this is
// the form endpoint for a logged-out, public campaign page.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

type SignupBody = {
  firstName?: string;
  email?: string;
  partnerFirstName?: string;
  languageChoice?: string;
  howHeard?: string;
  consent?: boolean;
  utmSource?: string;
  utmMedium?: string;
  // Honeypot — a real visitor never fills this in (hidden via CSS on
  // the form); a bot filling every field usually does.
  website?: string;
};

function hashIp(ip: string): string {
  const salt = process.env.TOKEN_ENCRYPTION_KEY || "first20-rate-limit";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

async function sendConfirmationEmail(
  supabase: SupabaseClient<ServerDatabase>,
  lang: First20Lang,
  firstName: string,
  email: string,
  signupId: string
) {
  const mailStatus = await isMailSendConfigured();
  if (!mailStatus.configured) return false;
  const t = first20T[lang];
  const subject =
    lang === "de" ? "Zusammen — deine First-20-Anmeldung" : lang === "en" ? "Zusammen — your First 20 signup" : "Zusammen — a First 20 jelentkezésed";
  const greeting = lang === "de" ? `Hallo ${firstName}!` : lang === "en" ? `Hi ${firstName}!` : `Szia ${firstName}!`;
  const html = `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f3efe7; color:#233328; padding:32px;">
  <div style="max-width:480px; margin:0 auto; background:#fff; border-radius:12px; padding:32px 28px;">
    <p style="font-size:1.1rem; margin:0 0 16px;">${greeting}</p>
    <p style="margin:0; line-height:1.6;">${t.signup.success}</p>
  </div>
</body>
</html>`;
  const result = await sendAndLogMail({
    supabase,
    to: email,
    toName: firstName,
    subject,
    html,
    signupId,
    sentVia: "auto",
    sentBy: null,
  });
  return result.ok;
}

export async function POST(request: Request) {
  let body: SignupBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "generic" }, { status: 400 });
  }

  // Honeypot — pretend success, never reveal the trap to whatever filled it in.
  if (body.website && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "generic" }, { status: 503 });
  }

  const lang: First20Lang = isFirst20Lang(body.languageChoice) ? body.languageChoice : "de";
  const firstName = (body.firstName ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const consent = body.consent === true;

  if (!firstName) {
    return NextResponse.json({ ok: false, error: "firstName" }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "email" }, { status: 400 });
  }
  if (!consent) {
    return NextResponse.json({ ok: false, error: "consent" }, { status: 400 });
  }

  // Rate limit — max RATE_LIMIT_MAX submissions per IP per hour. Logged
  // (and checked) before the duplicate-email check, so retrying the
  // same email repeatedly still counts against the cap.
  const ipHash = hashIp(clientIp(request));
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentCount } = await supabase
    .from("first20_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStart);
  if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json({ ok: false, error: "rateLimited" }, { status: 429 });
  }
  await supabase.from("first20_rate_limits").insert({ ip_hash: ipHash });

  // Same email signing up again isn't an error — just a friendly no-op.
  const { data: existing } = await supabase
    .from("first20_signups")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyRegistered: true });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("first20_signups")
    .insert({
      first_name: firstName,
      email,
      partner_first_name: body.partnerFirstName?.trim() || null,
      language_choice: lang as First20Language,
      how_heard: body.howHeard?.trim() || null,
      consent: true,
      utm_source: body.utmSource?.trim() || null,
      utm_medium: body.utmMedium?.trim() || null,
      // A /first20/feedback/{token} link és a Jelentkezők fül "egyedi
      // visszajelzési link" mezője ettől a pillanattól kezdve működik,
      // nem csak a Készlet-levél kiküldésekor — lásd
      // lib/first20-send.ts ensureSignupToken biztonsági hálóját a
      // már korábban (még token nélkül) felvett sorokhoz.
      token: randomBytes(16).toString("hex"),
    })
    .select("id")
    .single();

  if (insertError) {
    // 23505 = unique_violation — a race against another request with the
    // same email landed between the lookup above and this insert.
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, alreadyRegistered: true });
    }
    return NextResponse.json({ ok: false, error: "generic" }, { status: 500 });
  }

  // Confirmation email is best-effort — see the KÖTELEZŐ SZABÁLYOK spec
  // this route was built against: a Brevo failure (e.g. domain auth not
  // finished yet) must never fail the signup itself.
  try {
    if (inserted) {
      const sent = await sendConfirmationEmail(supabase, lang, firstName, email, inserted.id);
      if (sent) {
        await supabase.from("first20_signups").update({ confirmation_email_sent: true }).eq("id", inserted.id);
      }
    }
  } catch {
    // Swallow — the signup already succeeded.
  }

  return NextResponse.json({ ok: true });
}
