import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { verifyWebhookRequest, sendTelegramMessage } from "@/lib/telegram";
import { SITE_URL } from "@/lib/site-url";

// Telegram ide küldi a bejövő üzeneteket, miután a founder bekapcsolta
// a webhookot (Beállítások → Telegram → "Bejövő üzenetek bekapcsolása").
// Két parancs: sima szöveg → gyors Feladat (lásd handleTask), "/ugyfel
// <szöveg>" → gyors Megkeresés az Ügyfélszolgálat modulban (lásd
// handleSupportTicket) — ez utóbbi a founder saját gyors rögzítésére
// való (pl. telefonon hívott egy ügyfél), NEM arra, hogy ügyfelek
// közvetlenül ennek a botnak írjanak: a webhook csak a founder saját
// chat_id-jából fogad el bármit, lásd lib/telegram.ts
// verifyWebhookRequest kommentjét a biztonsági ellenőrzésről.
type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    text?: string;
  };
};

const UGYFEL_COMMAND = /^\/ugyfel(@\w+)?\s+([\s\S]+)$/i;

async function handleTask(text: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { ok: false as const, error: "Supabase service-role kliens nincs beállítva." };
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
  if (error || !data) return { ok: false as const, error: error?.message };

  await sendTelegramMessage(`✅ Feladat rögzítve: "${data.title}"\n${SITE_URL}/tasks?open=${data.id}`);
  return { ok: true as const };
}

/** "/ugyfel Kovács Anna | kérdezte, mikor érkezik a rendelése" — a "|"
 * elé eső rész lesz az ügyfél neve, utána minden a jegyzet. Pipe nélkül
 * az egész szöveg a jegyzet, az ügyfél neve egy helykitöltő marad —
 * a founder utólag, a dashboardon kiegészítheti. */
async function handleSupportTicket(raw: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { ok: false as const, error: "Supabase service-role kliens nincs beállítva." };
  }
  const [first, ...rest] = raw.split("|");
  const hasName = rest.length > 0 && first.trim();
  const customerName = hasName ? first.trim() : "Telegramból rögzítve";
  const notes = hasName ? rest.join("|").trim() : raw.trim();

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      customer_name: customerName,
      channel: "Telegram",
      notes: notes || null,
    })
    .select()
    .single();
  if (error || !data) return { ok: false as const, error: error?.message };

  await sendTelegramMessage(`✅ Megkeresés rögzítve: "${data.customer_name}"\n${SITE_URL}/support`);
  return { ok: true as const };
}

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

  const ugyfelMatch = text.match(UGYFEL_COMMAND);
  const result = ugyfelMatch ? await handleSupportTicket(ugyfelMatch[2]) : await handleTask(text);

  if (!result.ok) {
    const label = ugyfelMatch ? "megkeresést" : "feladatot";
    await sendTelegramMessage(`⚠️ Nem sikerült ${label} létrehozni ebből az üzenetből. Próbáld újra később.`);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
