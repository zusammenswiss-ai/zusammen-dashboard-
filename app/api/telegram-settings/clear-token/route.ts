import { NextResponse } from "next/server";
import { clearTelegramBotToken, getTelegramConfigStatus } from "@/lib/telegram";

export async function POST() {
  await clearTelegramBotToken();
  const status = await getTelegramConfigStatus();
  return NextResponse.json({ ok: true, status });
}
