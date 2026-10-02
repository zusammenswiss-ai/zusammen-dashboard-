import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { classifyTelegramSender, redeemInviteCode, sendTelegramMessage } from "@/lib/telegram";
import { SITE_URL } from "@/lib/site-url";

// Telegram ide küldi a bejövő üzeneteket, miután a founder bekapcsolta
// a webhookot (Beállítások → Telegram → "Bejövő üzenetek bekapcsolása").
// Három féle küldő, lásd lib/telegram.ts classifyTelegramSender kommentjét:
//   - "owner" / "trusted" (a founder, ill. meghívó kóddal csatlakozott
//     csapattag): sima szöveg → gyors Feladat, "/ugyfel <szöveg>" →
//     gyors Megkeresés, "/csatlakozas <kód>" → csapattag felvétele.
//   - "public" (bárki más, pl. egy ügyfél): MINDEN üzenete automatikusan
//     Megkeresés lesz — soha nem Feladat, hogy egy véletlen járókelő
//     üzenete ne piszkálhassa a belső Feladatok-táblát — kivéve a
//     "/csatlakozas" parancsot, amivel meghívó kóddal csapattaggá válhat.
// Nincs külön rate-limit a nyilvános ágon (lásd a Beállítások oldal
// figyelmeztető szövegét) — ugyanaz a kitettség, mint egy nyilvános
// kapcsolatfelvételi űrlapé, a legrosszabb eset törölhető félregépelt
// Megkeresés-bejegyzés.
type TelegramUpdate = {
  message?: {
    chat?: { id?: number };
    text?: string;
    from?: { first_name?: string; last_name?: string; username?: string };
  };
};

const UGYFEL_COMMAND = /^\/ugyfel(@\w+)?\s+([\s\S]+)$/i;
const JOIN_COMMAND = /^\/csatlakozas(@\w+)?\s+(\S+)$/i;

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
 * a founder/csapattag utólag, a dashboardon kiegészítheti. */
async function handleSupportTicket(raw: string, channel: "Telegram" = "Telegram", contact: string | null = null) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return { ok: false as const, error: "Supabase service-role kliens nincs beállítva." };
  }
  const [first, ...rest] = raw.split("|");
  const hasName = rest.length > 0 && first.trim();
  const customerName = hasName ? first.trim() : "Telegramból rögzítve";
  const notes = (hasName ? rest.join("|").trim() : raw.trim()).slice(0, 4000);

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({ customer_name: customerName, channel, contact, notes: notes || null })
    .select()
    .single();
  if (error || !data) return { ok: false as const, error: error?.message };

  return { ok: true as const, data };
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
  const classified = await classifyTelegramSender(secretHeader, chatId);
  if (!classified.ok) {
    return NextResponse.json({ ok: false, error: classified.reason }, { status: 403 });
  }

  const joinMatch = text.match(JOIN_COMMAND);
  if (joinMatch) {
    if (classified.role !== "public") {
      await sendTelegramMessage("ℹ️ Már van hozzáférésed a bothoz.");
      return NextResponse.json({ ok: true });
    }
    const result = await redeemInviteCode(joinMatch[2], chatId);
    await sendTelegramMessage(
      result.ok
        ? `✅ Sikeresen csatlakoztál „${result.label}” néven — mostantól sima üzenettel Feladatot, „/ugyfel” paranccsal Megkeresést hozhatsz létre.`
        : `⚠️ ${result.error}`
    );
    return NextResponse.json({ ok: true });
  }

  if (classified.role === "public") {
    const from = update.message?.from;
    const name = [from?.first_name, from?.last_name].filter(Boolean).join(" ").trim() || null;
    const contact = from?.username ? `@${from.username}` : null;
    const result = await handleSupportTicket(name ? `${name} | ${text}` : text, "Telegram", contact);

    await sendTelegramMessage(
      result.ok
        ? "✅ Köszönjük az üzeneted! Hamarosan válaszolunk."
        : "⚠️ Nem sikerült rögzíteni az üzeneted. Próbáld újra később."
    );
    return NextResponse.json(result.ok ? { ok: true } : { ok: false, error: result.error }, {
      status: result.ok ? 200 : 500,
    });
  }

  const ugyfelMatch = text.match(UGYFEL_COMMAND);
  if (ugyfelMatch) {
    const result = await handleSupportTicket(ugyfelMatch[2]);
    if (!result.ok) {
      await sendTelegramMessage("⚠️ Nem sikerült megkeresést létrehozni ebből az üzenetből. Próbáld újra később.");
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }
    await sendTelegramMessage(`✅ Megkeresés rögzítve: "${result.data.customer_name}"\n${SITE_URL}/support`);
    return NextResponse.json({ ok: true });
  }

  const taskResult = await handleTask(text);
  if (!taskResult.ok) {
    await sendTelegramMessage("⚠️ Nem sikerült feladatot létrehozni ebből az üzenetből. Próbáld újra később.");
    return NextResponse.json({ ok: false, error: taskResult.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
