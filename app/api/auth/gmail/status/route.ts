import { NextResponse } from "next/server";
import { getGmailConnectionStatus } from "@/lib/email/gmail-connection";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";

// GET /api/auth/gmail/status — polled by the Beállítások page to render
// "Gmail összekapcsolva: <email>" vs. the connect button.
export async function GET() {
  const configured = isGoogleOAuthConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, connected: false, email: null });
  }
  const { connected, email } = await getGmailConnectionStatus();
  return NextResponse.json({ configured: true, connected, email });
}
