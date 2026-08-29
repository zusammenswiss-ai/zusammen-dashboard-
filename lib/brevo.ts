// Brevo (formerly Sendinblue) transactional-email transport, used only by
// the Marketing "Email kampány küldése" feature — see
// app/api/marketing/send-campaign/route.ts. Deliberately NOT built on top
// of lib/email/*'s EmailSender interface: that abstraction is
// single-recipient plain-text (every "Email küldése" button app-wide —
// Beszállítók, Megrendelések, Dokumentumok, Marketing kampányok,
// Megosztások), while a marketing campaign is bulk HTML with
// per-recipient personalization — different enough that stretching
// EmailSender to fit would just be awkward abstraction-bending.
//
// One HTTP call per recipient (not Brevo's messageVersions batching) —
// keeps the contract simple and mirrors this codebase's existing
// single-recipient-per-call senders (Resend/Gmail).
//
// Free Brevo account = 300 emails/day. BREVO_API_KEY is intentionally
// optional here — isBrevoConfigured() lets the UI show "Brevo nincs
// beállítva" instead of failing, so nothing blocks on having the real
// key yet (see README).
const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

export type BrevoSendResult = { ok: true } | { ok: false; error: string };

export async function sendBrevoEmail(params: {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
}): Promise<BrevoSendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY nincs beállítva a szerver környezeti változói között." };
  }

  const res = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: {
        email: process.env.BREVO_FROM_EMAIL || "zusammen.swiss@gmail.com",
        name: process.env.BREVO_FROM_NAME || "Zusammen",
      },
      to: [{ email: params.to, name: params.toName || undefined }],
      subject: params.subject,
      htmlContent: params.html,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = (data && typeof data.message === "string" && data.message) || `Brevo API hiba (${res.status}).`;
    return { ok: false, error: message };
  }
  return { ok: true };
}
