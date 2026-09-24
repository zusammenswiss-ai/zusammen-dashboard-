// Resend implementation of EmailSender — this is the entire original
// /api/send-email logic, moved here unchanged so it sits behind the same
// interface as gmail-sender.ts. The API key / from-address / reply-to
// come from Beállítások → "Email küldés" when set there (see
// resend-config.ts), falling back field-by-field to the RESEND_* env
// vars otherwise, so a Vercel-only setup keeps working untouched.
import { Resend } from "resend";
import type { EmailSendParams, EmailSendResult, EmailSender } from "./types";
import { getResolvedResendConfig } from "./resend-config";

export class ResendSender implements EmailSender {
  async send({ to, subject, body }: EmailSendParams): Promise<EmailSendResult> {
    const { apiKey, from, replyTo } = await getResolvedResendConfig();
    if (!apiKey) {
      return {
        ok: false,
        error: "Nincs beállítva Resend API-kulcs — add meg a Beállítások → Email küldés menüben, vagy a RESEND_API_KEY környezeti változóban.",
      };
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: [to],
      replyTo,
      subject,
      text: body,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}
