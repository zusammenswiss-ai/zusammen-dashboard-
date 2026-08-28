// Gmail API implementation of EmailSender — sends as whatever Google
// account was connected via "Gmail összekapcsolása" on Beállítások (see
// app/api/auth/gmail/). Plain REST against the Gmail API, no `googleapis`
// dependency.
import { getValidGmailAccessToken } from "./gmail-connection";
import type { EmailSendParams, EmailSendResult, EmailSender } from "./types";

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

const NOT_CONNECTED_RESULT: EmailSendResult = {
  ok: false,
  code: "gmail_not_connected",
  error: "Gmail nincs összekapcsolva — kattints ide az engedélyezéshez.",
};

/** MIME "encoded-word" for a UTF-8 subject line (Hungarian accented characters aren't safe as raw header bytes). */
function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

/** Base64, line-wrapped at 76 chars per MIME convention. */
function wrapBase64(base64: string): string {
  return base64.match(/.{1,76}/g)?.join("\r\n") ?? base64;
}

function buildRawMessage({ to, subject, body }: EmailSendParams): string {
  const message = [
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(body, "utf-8").toString("base64")),
  ].join("\r\n");

  // Gmail API wants the whole RFC 2822 message base64url-encoded.
  return Buffer.from(message, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export class GmailSender implements EmailSender {
  async send(params: EmailSendParams): Promise<EmailSendResult> {
    let accessToken: string | null;
    try {
      accessToken = await getValidGmailAccessToken();
    } catch {
      // refreshAccessToken threw — most likely invalid_grant (revoked).
      return NOT_CONNECTED_RESULT;
    }
    if (!accessToken) return NOT_CONNECTED_RESULT;

    const res = await fetch(GMAIL_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: buildRawMessage(params) }),
    });

    if (res.status === 401 || res.status === 403) {
      return NOT_CONNECTED_RESULT;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const message = data?.error?.message || `Gmail API hiba (${res.status}).`;
      return { ok: false, error: message };
    }
    return { ok: true };
  }
}
