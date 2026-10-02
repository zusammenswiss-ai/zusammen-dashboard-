import { NextResponse } from "next/server";
import { enableTelegramWebhook, disableTelegramWebhook, getTelegramConfigStatus } from "@/lib/telegram";

// "Bejövő üzenetek bekapcsolása/kikapcsolása" a Beállítások → Telegram
// menüben — regisztrálja/törli a webhook URL-t a Telegram API-nál.
export async function POST() {
  const result = await enableTelegramWebhook();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  const status = await getTelegramConfigStatus();
  return NextResponse.json({ ok: true, status });
}

export async function DELETE() {
  const result = await disableTelegramWebhook();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  const status = await getTelegramConfigStatus();
  return NextResponse.json({ ok: true, status });
}
