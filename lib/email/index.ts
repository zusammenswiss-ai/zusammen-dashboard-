// Picks the active email transport. Every "Email küldése" button in the
// app (Beszállítók, Megrendelések, Dokumentumok, Marketing, Megosztások)
// goes through this same /api/send-email → getEmailSender() path — none
// of them talk to Resend or Gmail directly — so switching providers
// later is a one-line change here, not a rewrite across every page. The
// provider choice itself comes from Beállítások → "Email küldés" (see
// lib/email/resend-config.ts), falling back to the EMAIL_PROVIDER env
// var if that menu was never touched — see the README.
import { GmailSender } from "./gmail-sender";
import { ResendSender } from "./resend-sender";
import { getActiveEmailProvider } from "./resend-config";
import type { EmailSender } from "./types";

export async function getEmailSender(): Promise<EmailSender> {
  const provider = await getActiveEmailProvider();
  if (provider === "resend") return new ResendSender();
  return new GmailSender();
}

export type { EmailSendParams, EmailSendResult, EmailSender } from "./types";
