import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  firstNameFor,
  personalizeSubject,
  personalizeTemplate,
  privacyLink,
  resolveCampaignRecipients,
  ritualLinkFor,
  type CampaignAudience,
  type CampaignRecipient,
} from "@/lib/email-campaign";

// POST /api/marketing/preview-campaign — the "Előnézet" button on
// EmailCampaignSendForm. Resolves the exact same recipient list
// send-campaign would use (same lib/email-campaign.ts helper) and
// personalizes the template for the first real one, so what the founder
// sees before clicking "Küldés" is what an actual recipient gets — not a
// hand-typed stand-in name. Doesn't touch Brevo at all (no send), so it
// works even before BREVO_API_KEY is configured.
type PreviewBody = {
  templateId?: string;
  subject?: string;
  audiences?: CampaignAudience[];
};

const SAMPLE_RECIPIENT: CampaignRecipient = { email: "minta@zusammen.ch", name: "Éva" };

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  }
  const supabase = createClient<Database>(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const body = (await request.json().catch(() => null)) as PreviewBody | null;
  const templateId = body?.templateId?.trim();
  const subject = body?.subject?.trim() ?? "";
  const audiences = body?.audiences ?? [];
  if (!templateId) {
    return NextResponse.json({ ok: false, error: "Hiányzó sablon." }, { status: 400 });
  }

  const { data: template, error: templateError } = await supabase
    .from("email_templates")
    .select("html_content")
    .eq("id", templateId)
    .maybeSingle();
  if (templateError) return NextResponse.json({ ok: false, error: templateError.message }, { status: 500 });
  if (!template) return NextResponse.json({ ok: false, error: "A sablon nem található." }, { status: 404 });

  let recipient = SAMPLE_RECIPIENT;
  let isSample = true;
  if (audiences.length > 0) {
    const { recipients, error: recipientsError } = await resolveCampaignRecipients(supabase, audiences);
    if (recipientsError) return NextResponse.json({ ok: false, error: recipientsError }, { status: 500 });
    if (recipients.length > 0) {
      recipient = recipients[0];
      isSample = false;
    }
  }

  const ritualLink = await ritualLinkFor(supabase);
  const privacy = privacyLink();
  const firstName = firstNameFor(recipient);
  const html = personalizeTemplate(template.html_content, { firstName, ritualLink, privacyLink: privacy });

  return NextResponse.json({
    ok: true,
    recipient: { email: recipient.email, name: recipient.name },
    isSample,
    subject: personalizeSubject(subject, firstName),
    html,
  });
}
