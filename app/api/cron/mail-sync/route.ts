import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { syncAllActiveAccounts } from "@/lib/mail-sync";
import { isMailEncryptionConfigured } from "@/lib/mail-crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

// Napi biztonsági szinkron (vercel.json) — a feladat 3. pontja explicit
// kéri: "napi Vercel Cron biztonsági szinkronként", mivel a Hobby
// csomagnál a Cron csak naponta egyszer futhat, a tényleges frissítés
// elsősorban a Postafiók oldal "Frissítés" gombjából és az oldal-
// megnyitáskori (ha 5 percnél régebbi) automata szinkronból jön. Gated
// by CRON_SECRET, ugyanaz a minta, mint app/api/cron/first20-emails.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET nincs beállítva." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isMailEncryptionConfigured()) {
    return NextResponse.json({ ok: false, error: "MAIL_ENCRYPTION_KEY nincs beállítva." }, { status: 500 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  }

  const summaries = await syncAllActiveAccounts(supabase);

  const { data: settingsRow } = await supabase.from("mail_settings").select("id").maybeSingle();
  if (settingsRow) {
    await supabase.from("mail_settings").update({ last_cron_sync_at: new Date().toISOString() }).eq("id", settingsRow.id);
  } else {
    await supabase.from("mail_settings").insert({ last_cron_sync_at: new Date().toISOString() });
  }

  return NextResponse.json({ ok: true, summaries });
}
