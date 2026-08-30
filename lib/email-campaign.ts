// Shared by app/api/marketing/send-campaign/route.ts (the real send),
// app/api/marketing/preview-campaign/route.ts (the "Előnézet" dry run),
// and app/api/newsletter's own tables — so both the preview the founder
// sees and the recipient list actually used to send are built from the
// exact same code, not two hand-maintained approximations of each other.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { SITE_URL } from "@/lib/site-url";

export type CampaignAudience = "demand" | "newsletter";

export type CampaignRecipient = {
  email: string;
  name: string | null;
};

/**
 * Resolves the deduped, suppression-filtered recipient list for one or
 * both audiences. Names only ever come from newsletter_subscribers —
 * landing_responses (demand-test) has no name field, just an email.
 *
 * email_unsubscribes is checked regardless of source (see the comment on
 * that table in supabase/schema.sql) — this is OUR OWN db-side
 * suppression, kept for founder-driven exclusions. It's a separate
 * concern from the {unsubscribe} tag in personalizeTemplate: once a
 * recipient clicks that link, Brevo itself refuses to deliver to them on
 * every future send through this account (transactional or campaign),
 * account-wide — so there's no need for a webhook to sync a Brevo-side
 * unsubscribe back into this table for suppression to keep working.
 */
export async function resolveCampaignRecipients(
  supabase: SupabaseClient<Database>,
  audiences: CampaignAudience[]
): Promise<{ recipients: CampaignRecipient[]; error?: string }> {
  const recipients = new Map<string, CampaignRecipient>();

  if (audiences.includes("demand")) {
    const demandRes = await supabase.from("landing_responses").select("email").not("email", "is", null);
    if (demandRes.error) return { recipients: [], error: demandRes.error.message };
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
    if (newsletterRes.error) return { recipients: [], error: newsletterRes.error.message };
    const rows: { name: string | null; email: string }[] = newsletterRes.data ?? [];
    for (const row of rows) {
      const email = row.email.trim().toLowerCase();
      recipients.set(email, { email, name: row.name });
    }
  }

  const unsubRes = await supabase.from("email_unsubscribes").select("email");
  if (unsubRes.error) return { recipients: [], error: unsubRes.error.message };
  const unsubscribed = new Set((unsubRes.data ?? []).map((row: { email: string }) => row.email.toLowerCase()));
  for (const email of unsubscribed) recipients.delete(email);

  return { recipients: Array.from(recipients.values()) };
}

/**
 * First name to substitute for {{first_name}}. newsletter_subscribers has
 * a real name field; demand-test subscribers (landing_responses) only
 * ever gave an email address, so this falls back to a capitalized guess
 * from the local part of the address rather than leaving the greeting
 * blank.
 */
export function firstNameFor(recipient: CampaignRecipient): string {
  const fromName = recipient.name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = recipient.email.split("@")[0] ?? "";
  const guess = local.replace(/[._+-]+/g, " ").trim().split(" ")[0] ?? "";
  return guess ? guess[0].toUpperCase() + guess.slice(1) : "ott";
}

/** {{ritual_link}} — the shareable /together (Közös tér) link, same
 * `?code=` format Beállítások generates. together_settings may not have
 * a row yet (never generated) — falls back to the bare /together URL,
 * which still resolves (it just prompts for the code there instead). */
export async function ritualLinkFor(supabase: SupabaseClient<Database>): Promise<string> {
  const { data } = await supabase.from("together_settings").select("access_code").maybeSingle();
  return data?.access_code ? `${SITE_URL}/together?code=${data.access_code}` : `${SITE_URL}/together`;
}

/** {{privacy_link}} — the existing public Datenschutz page from the
 * /landing funnel (app/landing/datenschutz), reused as-is rather than
 * standing up a second, redundant privacy page just for campaign emails. */
export function privacyLink(): string {
  return `${SITE_URL}/landing/datenschutz`;
}

/**
 * Fills in every known placeholder on a raw HTML template (and, for
 * {{first_name}}, the subject line too — see personalizeSubject):
 *
 *   {{first_name}}       → params.firstName
 *   {{ritual_link}}       → params.ritualLink
 *   {{privacy_link}}      → params.privacyLink
 *   {{unsubscribe_link}}  → the literal Brevo merge tag "{unsubscribe}"
 *     (accepts the older {{unsubscribe_url}} name too, for templates
 *     uploaded before this changed). Deliberately NOT a URL we build
 *     ourselves — Brevo replaces {unsubscribe} with a real, working
 *     unsubscribe link at send time, and enforces it account-wide on
 *     every later send once clicked (see resolveCampaignRecipients).
 *     If a template has no unsubscribe placeholder at all, a standard
 *     footer line with the same Brevo tag is appended so every campaign
 *     stays unsubscribable regardless of what was uploaded.
 */
export function personalizeTemplate(
  html: string,
  params: { firstName: string; ritualLink: string; privacyLink: string }
): string {
  let out = html
    .replace(/\{\{\s*first_name\s*\}\}/gi, params.firstName)
    .replace(/\{\{\s*ritual_link\s*\}\}/gi, params.ritualLink)
    .replace(/\{\{\s*privacy_link\s*\}\}/gi, params.privacyLink);

  if (/\{\{\s*unsubscribe_(link|url)\s*\}\}/i.test(out)) {
    out = out.replace(/\{\{\s*unsubscribe_(link|url)\s*\}\}/gi, "{unsubscribe}");
  } else {
    const footer = `<p style="margin-top:24px;font-size:12px;color:#888888;">Ha nem szeretnél több emailt kapni: <a href="{unsubscribe}">leiratkozás</a>.</p>`;
    out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${footer}</body>`) : `${out}\n${footer}`;
  }
  return out;
}

/** Same {{first_name}} substitution as personalizeTemplate, for the
 * subject line — kept separate since a subject is plain text, not HTML
 * (no ritual/privacy/unsubscribe links belong in a subject line). */
export function personalizeSubject(subject: string, firstName: string): string {
  return subject.replace(/\{\{\s*first_name\s*\}\}/gi, firstName);
}
