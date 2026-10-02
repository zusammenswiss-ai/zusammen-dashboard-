import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { verifyWebhookRequest, sendTelegramMessage } from "@/lib/telegram";
import { SITE_URL } from "@/lib/site-url";

// Telegram ide küldi a bejövő üzeneteket, miután a founder bekapcsolta
// a webhookot (Beállítások → Telegram → "Bejövő üzenetek bekapcsolása").
// Minden üzenetből gyors Feladat lesz — ez a "gyors rögzítés telefonról"
// funkció v1-je, lásd lib/telegram.ts verifyWebhookRequest kommentjét a
// biztonsági ellenőrzésről (secret_token fejléc + csak a founder saját
// chat_id-ja).
type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    text?: string;
  };
};

export async function POST(request: Request) {
  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  if (!chatId || !text) {
    // Nem szöveges üzenet (pl. kép, csatlakozás-státusz) — nincs mit
    // tennünk vele, de a Telegramnak 200-at kell kapnia, különben
    // újraküldi.
    return NextResponse.json({ ok: true });
  }

  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  const verified = await verifyWebhookRequest(secretHeader, chatId);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.reason }, { status: 403 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase service-role kliens nincs beállítva." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: text.length > 120 ? `${text.slice(0, 117)}…` : text,
      notes: text.length > 120 ? text : null,
      category: "Telegram",
      status: "Teendő",
    })
    .select()
    .single();

  if (error || !data) {
    await sendTelegramMessage("⚠️ Nem sikerült feladatot létrehozni ebből az üzenetből. Próbáld újra később.");
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
  }

  await sendTelegramMessage(`✅ Feladat rögzítve: "${data.title}"\n${SITE_URL}/tasks?open=${data.id}`);
  return NextResponse.json({ ok: true });
}
