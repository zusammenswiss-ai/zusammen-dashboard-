// Shared by app/api/marketing/send-campaign/route.ts (the real send) and
// EmailCampaignSendForm's "Előnézet" button (a client-side dry run) — so
// the preview the founder sees is guaranteed to match what actually goes
// out, not a hand-maintained approximation of it.
import { SITE_URL } from "@/lib/site-url";

export type CampaignRecipient = {
  email: string;
  name: string | null;
};

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

export function unsubscribeUrlFor(email: string): string {
  return `${SITE_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
}

/**
 * Fills in {{first_name}} and the unsubscribe link on a raw HTML
 * template. A template may include an explicit {{unsubscribe_url}}
 * placeholder to control exactly where the link goes; if it doesn't, a
 * standard footer line is appended so every campaign stays
 * unsubscribable regardless of what the uploaded template contains.
 */
export function personalizeTemplate(html: string, params: { firstName: string; unsubscribeUrl: string }): string {
  let out = html.replace(/\{\{\s*first_name\s*\}\}/gi, params.firstName);
  if (/\{\{\s*unsubscribe_url\s*\}\}/i.test(out)) {
    out = out.replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, params.unsubscribeUrl);
  } else {
    const footer = `<p style="margin-top:24px;font-size:12px;color:#888888;">Ha nem szeretnél több emailt kapni: <a href="${params.unsubscribeUrl}">leiratkozás</a>.</p>`;
    out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, `${footer}</body>`) : `${out}\n${footer}`;
  }
  return out;
}
