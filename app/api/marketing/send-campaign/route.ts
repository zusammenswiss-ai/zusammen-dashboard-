import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isBrevoConfigured, sendBrevoEmail } from "@/lib/brevo";
import { firstNameFor, personalizeTemplate, unsubscribeUrlFor, type CampaignRecipient } from "@/lib/email-campaign";

// POST /api/marketing/send-campaign — the "Küldés" button on
// EmailCampaignSendForm (Marketing → Email sablonok). Sends one Brevo
// call per recipient (see lib/brevo.ts for why), personalized via
// lib/email-campaign.ts, and — only if at least one email actually went
// out — records the campaign in marketing_content with status
// "Kiküldve" so it shows up on the Tartalom-naptár like any other piece
// of marketing content.
//
// Builds its own anon client inline — same pattern as /api/send-email,
// /api/reminder-email, and /api/calendar/ics.
type SendCampaignBody = {
  templateId?: string;
  subject?: string;
  audiences?: ("demand" | "newsletter")[];
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  if (!isBrevoConfigured()) {
    return NextResponse.json(
      { ok: false, error: "BREVO_API_KEY nincs beállítva a szerveren — kérj egyet a founder-től." },
      { status: 500 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  }
  const supabase = createClient<Database>(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const body = (await request.json().catch(() => null)) as SendCampaignBody | null;
  const templateId = body?.templateId?.trim();
  const subject = body?.subject?.trim();
  const audiences = body?.audiences ?? [];
  if (!templateId || !subject || audiences.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Hiányzó sablon, tárgy, vagy nincs kiválasztva címzett-kör." },
      { status: 400 }
    );
  }

  const { data: template, error: templateError } = await supabase
    .from("email_templates")
    .select("html_content")
    .eq("id", templateId)
    .maybeSingle();
  if (templateError) return NextResponse.json({ ok: false, error: templateError.message }, { status: 500 });
  if (!template) return NextResponse.json({ ok: false, error: "A sablon nem található." }, { status: 404 });

  // Merge the two possible sources into one deduped-by-email list. Names
  // only ever come from newsletter_subscribers — landing_responses
  // (demand-test) has no name field, just an email.
  const recipients = new Map<string, CampaignRecipient>();

  if (audiences.includes("demand")) {
    const demandRes = await supabase.from("landing_responses").select("email").not("email", "is", null);
    if (demandRes.error) return NextResponse.json({ ok: false, error: demandRes.error.message }, { status: 500 });
    const rows: { email: string | null }[] = demandRes.data ?? [];
    for (const row of rows) {
      const email = row.email?.trim().toLowerCase();
      if (email) recipients.set(email, { email, name: null });
    }
  }

  if (audiences.includes("newsletter")) {
    const newsletterRes = await supabase
      .from("newsletter_subscribers")
      .select("name, email")
      .eq("unsubscribed", false);
    if (newsletterRes.error)
      return NextResponse.json({ ok: false, error: newsletterRes.error.message }, { status: 500 });
    const rows: { name: string | null; email: string }[] = newsletterRes.data ?? [];
    for (const row of rows) {
      const email = row.email.trim().toLowerCase();
      recipients.set(email, { email, name: row.name });
    }
  }

  // Global suppression list — checked regardless of which list(s) the
  // address came from (see the comment on email_unsubscribes in
  // supabase/schema.sql).
  const unsubRes = await supabase.from("email_unsubscribes").select("email");
  const unsubscribed = new Set((unsubRes.data ?? []).map((row: { email: string }) => row.email.toLowerCase()));
  for (const email of unsubscribed) recipients.delete(email);

  if (recipients.size === 0) {
    return NextResponse.json({ ok: false, error: "Nincs kiküldhető címzett a kiválasztott kör(ök)ben." }, { status: 400 });
  }

  let sent = 0;
  const errors: string[] = [];
  for (const recipient of recipients.values()) {
    const html = personalizeTemplate(template.html_content, {
      firstName: firstNameFor(recipient),
      unsubscribeUrl: unsubscribeUrlFor(recipient.email),
    });
    const result = await sendBrevoEmail({
      to: recipient.email,
      toName: recipient.name,
      subject,
      html,
    });
    if (result.ok) sent += 1;
    else errors.push(`${recipient.email}: ${result.error}`);
  }

  let contentItem = null;
  if (sent > 0) {
    const { data } = await supabase
      .from("marketing_content")
      .insert({
        title: subject,
        content_type: "Email",
        scheduled_date: todayISO(),
        copy_text: `Email kampány kiküldve ${sent} címzettnek (${audiences.join(", ")}).`,
        status: "Kiküldve",
      })
      .select()
      .single();
    contentItem = data ?? null;
  }

  return NextResponse.json({
    ok: sent > 0,
    sent,
    failed: errors.length,
    errors: errors.slice(0, 20),
    contentItem,
  });
}
