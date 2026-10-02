import { NextResponse } from "next/server";
import { fetchAndSaveLatestChatId, getTelegramConfigStatus } from "@/lib/telegram";

// "Chat ID lekérése" gomb — a founder előbb küld egy üzenetet a saját
// botjának Telegramban, aztán ez a route megkeresi azt a getUpdates
// API-val, és elmenti a chat_id-t, hogy ne kelljen numerikus ID-kat
// kézzel keresgélnie.
export async function POST() {
  const result = await fetchAndSaveLatestChatId();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  const status = await getTelegramConfigStatus();
  return NextResponse.json({ ok: true, status });
}
