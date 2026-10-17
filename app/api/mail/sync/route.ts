import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { syncAllActiveAccounts, syncMailAccount } from "@/lib/mail-sync";
import { getMailAccountRaw } from "@/lib/mail-accounts";
import { isMailEncryptionConfigured } from "@/lib/mail-crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/mail/sync — a Postafiók oldal "Frissítés" gombja (minden
// aktív fiók), vagy ?accountId=... egyetlen fiókra. Ugyanezt a logikát
// hívja a napi biztonsági cron (app/api/cron/mail-sync) is, hogy a
// kézi és automata szinkron sose térjen el egymástól.
export async function POST(request: Request) {
  if (!isMailEncryptionConfigured()) {
    return NextResponse.json({ ok: false, error: "MAIL_ENCRYPTION_KEY nincs beállítva a szerveren." }, { status: 500 });
  }
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");

  if (accountId) {
    const account = await getMailAccountRaw(accountId);
    if (!account) return NextResponse.json({ ok: false, error: "A fiók nem található." }, { status: 404 });
    const { data: settings } = await supabase.from("mail_settings").select("sync_lookback_days").maybeSingle();
    const summary = await syncMailAccount(supabase, account, settings?.sync_lookback_days ?? 30);
    return NextResponse.json({ ok: true, summaries: [summary] });
  }

  const summaries = await syncAllActiveAccounts(supabase);
  return NextResponse.json({ ok: true, summaries });
}
