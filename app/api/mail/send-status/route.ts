import { NextResponse } from "next/server";
import { isMailSendConfigured } from "@/lib/mail-accounts";

// GET /api/mail/send-status — polled by SignupEmailsTab/First20SignupsSection
// to show "Nincs postafiók beállítva" instead of a confusing failed-send
// error. Felváltja a korábbi /api/marketing/brevo-status-hívásukat (a
// feladat kéri: a First 20 fülön nincs több Brevo) — az a route
// változatlanul megmarad a tömeges marketing-kampány küldésnek
// (EmailCampaignSendForm), ami szándékosan kívül esik ezen a feladaton.
export async function GET() {
  const status = await isMailSendConfigured();
  return NextResponse.json(status);
}
