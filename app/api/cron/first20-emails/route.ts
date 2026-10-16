import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { isBrevoConfigured } from "@/lib/brevo";
import { sendFirst20Email } from "@/lib/first20-send";
import { errorMessage } from "@/lib/errors";

// Fired daily by Vercel Cron (see vercel.json) — csak az emlékeztetőt
// (+3 nap a Készlet-levél óta) és a visszajelzés-kérést (+7 nap) küldi
// automatikusan, a Készlet-levelet SOHA (az mindig kézi küldés — lásd a
// feladat specifikációját: "A napi Vercel Cron ... (+3 nap emlékeztető,
// +7 nap visszajelzés kérése)"). Gated by CRON_SECRET, same pattern as
// app/api/cron/check-date-digest. Csak akkor csinál bármit, ha legalább
// egy "First 20" típusú kampányon be van kapcsolva az "Automatikus
// küldés" (campaigns.first20_auto_send) — alapértelmezetten ki van
// kapcsolva, lásd supabase/schema.sql.
//
// first20_signups nincs campaign_id-vel scope-olva (lásd a tábla
// kommentjét) — egyetlen globális "First 20" jelentkező-halmaz van, ezért
// a kapcsoló ellenőrzése is globális: ha BÁRMELYIK First 20 kampányon be
// van kapcsolva, az összes eligible jelentkezőt feldolgozza.
const REMINDER_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const FEEDBACK_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const NOT_YET_PROGRESSED = ["Jelentkezett", "Kit elküldve"];

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET nincs beállítva — a First 20 automata küldés nincs bekapcsolva." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  }

  const { data: autoCampaigns, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("type", "First 20")
    .eq("first20_auto_send", true)
    .limit(1);
  if (campaignError) {
    return NextResponse.json({ ok: false, error: errorMessage(campaignError, "Nem sikerült lekérdezni a kampányt.") }, { status: 500 });
  }
  if (!autoCampaigns || autoCampaigns.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Automatikus küldés kikapcsolva minden First 20 kampányon." });
  }

  if (!isBrevoConfigured()) {
    return NextResponse.json({ ok: false, error: "BREVO_API_KEY nincs beállítva a szerveren." }, { status: 500 });
  }

  const reminderCutoff = new Date(Date.now() - REMINDER_AFTER_MS).toISOString();
  const feedbackCutoff = new Date(Date.now() - FEEDBACK_AFTER_MS).toISOString();

  const [reminderDue, feedbackDue] = await Promise.all([
    supabase
      .from("first20_signups")
      .select("*")
      .not("kit_sent_at", "is", null)
      .lte("kit_sent_at", reminderCutoff)
      .is("reminder_sent_at", null)
      .in("status", NOT_YET_PROGRESSED),
    supabase
      .from("first20_signups")
      .select("*")
      .not("kit_sent_at", "is", null)
      .lte("kit_sent_at", feedbackCutoff)
      .is("feedback_mail_sent_at", null)
      .is("feedback_received_at", null)
      .in("status", NOT_YET_PROGRESSED),
  ]);

  if (reminderDue.error) return NextResponse.json({ ok: false, error: reminderDue.error.message }, { status: 500 });
  if (feedbackDue.error) return NextResponse.json({ ok: false, error: feedbackDue.error.message }, { status: 500 });

  let remindersSent = 0;
  let feedbackRequestsSent = 0;
  const failed: string[] = [];

  for (const signup of reminderDue.data ?? []) {
    const result = await sendFirst20Email({ supabase, signup, type: "reminder", trigger: "auto", sentBy: null });
    if (result.ok) remindersSent += 1;
    else failed.push(`${signup.email} (emlékeztető): ${result.error}`);
  }

  for (const signup of feedbackDue.data ?? []) {
    const result = await sendFirst20Email({ supabase, signup, type: "feedback", trigger: "auto", sentBy: null });
    if (result.ok) feedbackRequestsSent += 1;
    else failed.push(`${signup.email} (visszajelzés kérése): ${result.error}`);
  }

  return NextResponse.json({ ok: true, remindersSent, feedbackRequestsSent, failed });
}
