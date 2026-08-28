import { NextResponse } from "next/server";
import { getInboxMessage } from "@/lib/email/gmail-inbox";

// GET /api/gmail/messages/[id] — full message body for the Postaláda
// detail view.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getInboxMessage(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: 502 });
  }
  return NextResponse.json(result);
}
