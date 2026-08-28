import { NextResponse } from "next/server";
import { disconnectGmail } from "@/lib/email/gmail-connection";

// POST /api/auth/gmail/disconnect — "Kapcsolat bontása" on Beállítások.
export async function POST() {
  await disconnectGmail();
  return NextResponse.json({ ok: true });
}
