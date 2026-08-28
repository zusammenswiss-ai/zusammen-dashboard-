import { NextResponse } from "next/server";
import { listInboxMessages } from "@/lib/email/gmail-inbox";

// GET /api/gmail/messages?q=...&pageToken=... — Postaláda list view.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? undefined;
  const pageToken = url.searchParams.get("pageToken") ?? undefined;

  const result = await listInboxMessages({ query, pageToken });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: 502 });
  }
  return NextResponse.json(result);
}
