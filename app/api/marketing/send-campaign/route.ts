import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isBrevoConfigured, sendBrevoEmail } from "@/lib/brevo";
import {
  firstNameFor,
  personalizeSubject,
  personalizeTemplate,
  privacyLink,
  resolveCampaignRecipients,
  ritualLinkFor,
  type CampaignAudience,
} from "@/lib/email-campaign";

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
  audiences?: CampaignAudience[];
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

  const { recipients, error: recipientsError } = await resolveCampaignRecipients(supabase, audiences);
  if (recipientsError) return NextResponse.json({ ok: false, error: recipientsError }, { status: 500 });
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "Nincs kiküldhető címzett a kiválasztott kör(ök)ben." }, { status: 400 });
  }

  const ritualLink = await ritualLinkFor(supabase);
  const privacy = privacyLink();

  let sent = 0;
  const errors: string[] = [];
  for (const recipient of recipients) {
    const firstName = firstNameFor(recipient);
    const html = personalizeTemplate(template.html_content, { firstName, ritualLink, privacyLink: privacy });
    const result = await sendBrevoEmail({
      to: recipient.email,
      toName: recipient.name,
      subject: personalizeSubject(subject, firstName),
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
