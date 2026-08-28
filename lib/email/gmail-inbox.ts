// Read-only Gmail inbox access for the Postaláda page — plain REST
// against the Gmail API, same approach as gmail-sender.ts. Requires the
// gmail.readonly scope (see lib/google-oauth.ts); a connection made
// before that scope existed won't have inbox access until reconnected.
import { getValidGmailAccessToken } from "./gmail-connection";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const DEFAULT_PAGE_SIZE = 20;

export type InboxMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
};

export type InboxMessageDetail = InboxMessage & { bodyText: string };

type NotConnected = { ok: false; error: string; code: "gmail_not_connected" };
type OtherFailure = { ok: false; error: string; code?: undefined };
type GmailFailure = NotConnected | OtherFailure;

export type InboxListResult =
  | { ok: true; messages: InboxMessage[]; nextPageToken: string | null }
  | GmailFailure;

export type InboxDetailResult = { ok: true; message: InboxMessageDetail } | GmailFailure;

const NOT_CONNECTED: NotConnected = {
  ok: false,
  code: "gmail_not_connected",
  error: "Gmail nincs összekapcsolva — kattints ide az engedélyezéshez.",
};

type GmailHeader = { name: string; value: string };
type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
};

function headerValue(headers: GmailHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function resolveAccessToken(): Promise<string | GmailFailure> {
  try {
    const token = await getValidGmailAccessToken();
    return token ?? NOT_CONNECTED;
  } catch {
    // Most likely invalid_grant — the stored refresh token was revoked.
    return NOT_CONNECTED;
  }
}

export async function listInboxMessages(opts: {
  query?: string;
  pageToken?: string;
  maxResults?: number;
}): Promise<InboxListResult> {
  const accessToken = await resolveAccessToken();
  if (typeof accessToken !== "string") return accessToken;

  const params = new URLSearchParams({
    maxResults: String(opts.maxResults ?? DEFAULT_PAGE_SIZE),
    q: opts.query?.trim() || "in:inbox",
  });
  if (opts.pageToken) params.set("pageToken", opts.pageToken);

  const listRes = await fetch(`${GMAIL_BASE}/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.status === 401 || listRes.status === 403) return NOT_CONNECTED;
  if (!listRes.ok) {
    const data = await listRes.json().catch(() => null);
    return { ok: false, error: data?.error?.message || `Gmail API hiba (${listRes.status}).` };
  }
  const listData = (await listRes.json()) as {
    messages?: { id: string; threadId: string }[];
    nextPageToken?: string;
  };
  const refs = listData.messages ?? [];
  if (refs.length === 0) {
    return { ok: true, messages: [], nextPageToken: listData.nextPageToken ?? null };
  }

  const fetched = await Promise.all(
    refs.map(async ({ id, threadId }) => {
      const res = await fetch(
        `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        payload?: { headers?: GmailHeader[] };
        internalDate?: string;
        snippet?: string;
        labelIds?: string[];
      };
      const headers = data.payload?.headers;
      const message: InboxMessage = {
        id,
        threadId,
        from: headerValue(headers, "From"),
        subject: headerValue(headers, "Subject") || "(nincs tárgy)",
        date: data.internalDate ? new Date(Number(data.internalDate)).toISOString() : headerValue(headers, "Date"),
        snippet: data.snippet ?? "",
        unread: (data.labelIds ?? []).includes("UNREAD"),
      };
      return message;
    })
  );

  return {
    ok: true,
    messages: fetched.filter((m): m is InboxMessage => m !== null),
    nextPageToken: listData.nextPageToken ?? null,
  };
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Walks the (possibly nested, multipart) message body for a text/plain part, falling back to a stripped text/html part. */
function extractBodyText(part: GmailMessagePart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return base64UrlDecode(part.body.data);
  if (part.parts) {
    const plain = part.parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
    if (plain?.body?.data) return base64UrlDecode(plain.body.data);
    for (const nested of part.parts) {
      const found = extractBodyText(nested);
      if (found) return found;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) return stripHtml(base64UrlDecode(part.body.data));
  return "";
}

export async function getInboxMessage(id: string): Promise<InboxDetailResult> {
  const accessToken = await resolveAccessToken();
  if (typeof accessToken !== "string") return accessToken;

  const res = await fetch(`${GMAIL_BASE}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 || res.status === 403) return NOT_CONNECTED;
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { ok: false, error: data?.error?.message || `Gmail API hiba (${res.status}).` };
  }
  const data = (await res.json()) as {
    id: string;
    threadId: string;
    payload?: GmailMessagePart & { headers?: GmailHeader[] };
    internalDate?: string;
    snippet?: string;
    labelIds?: string[];
  };
  const headers = data.payload?.headers;
  return {
    ok: true,
    message: {
      id: data.id,
      threadId: data.threadId,
      from: headerValue(headers, "From"),
      subject: headerValue(headers, "Subject") || "(nincs tárgy)",
      date: data.internalDate ? new Date(Number(data.internalDate)).toISOString() : headerValue(headers, "Date"),
      snippet: data.snippet ?? "",
      unread: (data.labelIds ?? []).includes("UNREAD"),
      bodyText: extractBodyText(data.payload) || data.snippet || "",
    },
  };
}

export type UnreadCountResult = { ok: true; count: number } | GmailFailure;

/** Exact unread count from the INBOX label's own metadata — cheaper and more reliable than listing+counting unread messages. Used by the Áttekintés stat card and the daily reminder email. */
export async function getUnreadInboxCount(): Promise<UnreadCountResult> {
  const accessToken = await resolveAccessToken();
  if (typeof accessToken !== "string") return accessToken;

  const res = await fetch(`${GMAIL_BASE}/labels/INBOX`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401 || res.status === 403) return NOT_CONNECTED;
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { ok: false, error: data?.error?.message || `Gmail API hiba (${res.status}).` };
  }
  const data = (await res.json()) as { messagesUnread?: number };
  return { ok: true, count: data.messagesUnread ?? 0 };
}
