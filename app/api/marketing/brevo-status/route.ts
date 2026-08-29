import { NextResponse } from "next/server";
import { isBrevoConfigured } from "@/lib/brevo";

// GET /api/marketing/brevo-status — polled by EmailCampaignSendForm to
// show "Brevo nincs beállítva" instead of a confusing failed-send error
// when BREVO_API_KEY hasn't been set yet. Mirrors /api/auth/gmail/status.
export async function GET() {
  return NextResponse.json({ configured: isBrevoConfigured() });
}
