import { NextResponse } from "next/server";
import { getUnreadInboxCount } from "@/lib/email/gmail-inbox";

// GET /api/gmail/unread-count — powers the Áttekintés stat card and the
// daily reminder email's "X olvasatlan levél" line.
export async function GET() {
  const result = await getUnreadInboxCount();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: 502 });
  }
  return NextResponse.json(result);
}
