import { NextResponse } from "next/server";
import { getEmailSendConfigStatus, saveEmailSendConfig, type EmailProvider } from "@/lib/email/resend-config";

// Beállítások → "Email küldés" — lets the founder pick Gmail vs Resend
// and, for Resend, set the API key / from-name / from-address / reply-to
// from inside the dashboard. GET never returns the raw/decrypted API
// key — only whether one is configured and where it came from (database
// vs env var) — see resend-config.ts for why.
export async function GET() {
  const status = await getEmailSendConfigStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  let payload: { provider?: string; apiKey?: string; fromName?: string; fromEmail?: string; replyTo?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Érvénytelen kérés." }, { status: 400 });
  }

  const provider: EmailProvider = payload.provider === "resend" ? "resend" : "gmail";
  const fromEmail = (payload.fromEmail ?? "").trim();
  if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    return NextResponse.json({ ok: false, error: "Érvénytelen feladó email cím." }, { status: 400 });
  }
  const replyTo = (payload.replyTo ?? "").trim();
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) {
    return NextResponse.json({ ok: false, error: "Érvénytelen válaszcím." }, { status: 400 });
  }

  const result = await saveEmailSendConfig({
    provider,
    apiKey: payload.apiKey,
    fromName: payload.fromName ?? "",
    fromEmail,
    replyTo,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  const status = await getEmailSendConfigStatus();
  return NextResponse.json({ ok: true, status });
}
