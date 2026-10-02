import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST() {
  const result = await sendTelegramMessage("✅ Teszt üzenet a Zusammen Dashboardból — a Telegram-összekapcsolás működik!");
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
