import { NextResponse } from "next/server";
import { listInboxMessages } from "@/lib/email/gmail-inbox";

// GET /api/gmail/messages?q=...&pageToken=...&maxResults=... — Postaláda
// list view, and also reused by ContactCorrespondence (a from:/to: query
// with a small maxResults) to preview a single contact's thread history.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;
  const pageToken = url.searchParams.get("pageToken") ?? undefined;
  const maxResultsParam = url.searchParams.get("maxResults");
  const maxResults = maxResultsParam ? Number(maxResultsParam) : undefined;

  const result = await listInboxMessages({ query, pageToken, maxResults });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: 502 });
  }
  return NextResponse.json(result);
}
