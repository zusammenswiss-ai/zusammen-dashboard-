// Picks the active email transport. Every "Email küldése" button in the
// app (Beszállítók, Megrendelések, Dokumentumok, Marketing, Megosztások)
// goes through this same /api/send-email → getEmailSender() path — none
// of them talk to Resend or Gmail directly — so switching providers
// later (e.g. back to Resend once a verified custom domain exists) is a
// one-line change here, not a rewrite across every page. See the README
// for how EMAIL_PROVIDER is set.
import { GmailSender } from "./gmail-sender";
import { ResendSender } from "./resend-sender";
import type { EmailSender } from "./types";

export function getEmailSender(): EmailSender {
  const provider = (process.env.EMAIL_PROVIDER || "gmail").trim().toLowerCase();
  if (provider === "resend") return new ResendSender();
  return new GmailSender();
}

export type { EmailSendParams, EmailSendResult, EmailSender } from "./types";
