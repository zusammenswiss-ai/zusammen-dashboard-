// Resend implementation of EmailSender — this is the entire original
// /api/send-email logic, moved here unchanged so it sits behind the same
// interface as gmail-sender.ts. Kept ready to flip back to (see
// EMAIL_PROVIDER in README) once a verified custom domain makes Resend's
// deliverability the better choice again.
import { Resend } from "resend";
import type { EmailSendParams, EmailSendResult, EmailSender } from "./types";

const DEFAULT_FROM = "Zusammen <onboarding@resend.dev>";
const DEFAULT_REPLY_TO = "zusammen.swiss@gmail.com";

export class ResendSender implements EmailSender {
  async send({ to, subject, body }: EmailSendParams): Promise<EmailSendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "RESEND_API_KEY nincs beállítva a szerver környezeti változói között." };
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
      to: [to],
      replyTo: process.env.RESEND_REPLY_TO || DEFAULT_REPLY_TO,
      subject,
      text: body,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }
}
