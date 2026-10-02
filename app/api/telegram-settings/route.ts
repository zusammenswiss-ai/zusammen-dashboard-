import { NextResponse } from "next/server";
import { getTelegramConfigStatus, saveTelegramConfig } from "@/lib/telegram";

// Beállítások → "Telegram" — lásd lib/telegram.ts. GET soha nem adja
// vissza a nyers/visszafejtett bot tokent, csak hogy be van-e állítva.
export async function GET() {
  const status = await getTelegramConfigStatus();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  let payload: { botToken?: string; chatId?: string; notificationsEnabled?: boolean };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Érvénytelen kérés." }, { status: 400 });
  }

  const result = await saveTelegramConfig(payload);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  const status = await getTelegramConfigStatus();
  return NextResponse.json({ ok: true, status });
}
