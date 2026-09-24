import { NextResponse } from "next/server";
import { clearResendApiKey, getEmailSendConfigStatus } from "@/lib/email/resend-config";

// "Kulcs törlése" on Beállítások → Email küldés — removes only the
// stored Resend API key (provider/from-address stay as-is), same shape
// as Gmail's "Kapcsolat bontása".
export async function POST() {
  await clearResendApiKey();
  const status = await getEmailSendConfigStatus();
  return NextResponse.json({ ok: true, status });
}
