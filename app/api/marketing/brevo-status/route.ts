import { NextResponse } from "next/server";
import { isBrevoConfigured, missingBrevoEnvVars } from "@/lib/brevo";

// GET /api/marketing/brevo-status — polled by EmailCampaignSendForm and
// First20EmailsTab to show "Brevo nincs beállítva" instead of a
// confusing failed-send error when BREVO_API_KEY hasn't been set yet.
// Mirrors /api/auth/gmail/status. `missing` names the exact env var(s)
// still needed — additive, existing callers that only read `configured`
// keep working unchanged.
export async function GET() {
  return NextResponse.json({ configured: isBrevoConfigured(), missing: missingBrevoEnvVars() });
}
