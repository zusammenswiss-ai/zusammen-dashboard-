// Shared contract every email transport implements — see index.ts for
// how the active one is picked. Keeping this abstract is what makes
// "swap Gmail for Resend later" a one-line env var change instead of a
// rewrite (see EMAIL_PROVIDER in README).
export type EmailSendParams = {
  to: string;
  subject: string;
  body: string;
};

export type EmailSendResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /**
       * Machine-readable reason, so the UI can react specifically
       * instead of showing a generic error banner — currently only used
       * for "the Gmail connection is missing/expired", which the
       * Beszállítók/Megosztások/etc. email modal turns into a "Gmail
       * nincs összekapcsolva — kattints ide az engedélyezéshez" link
       * rather than a plain failure message.
       */
      code?: "gmail_not_connected";
    };

export interface EmailSender {
  send(params: EmailSendParams): Promise<EmailSendResult>;
}
