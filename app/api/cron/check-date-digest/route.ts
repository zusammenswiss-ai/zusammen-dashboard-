import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { getResolvedResendConfig } from "@/lib/email/resend-config";
import { SITE_URL } from "@/lib/site-url";
import { errorMessage } from "@/lib/errors";

// Fired daily by Vercel Cron (see vercel.json) — a dedicated digest, kept
// separate from the general /api/reminder-email summary, for just the
// "Várakozás" tasks whose check_date has arrived or passed (see
// tasks.check_date in supabase/schema.sql). Sends nothing at all when
// there's nothing due, unlike the general reminder, which always sends —
// this one is opt-in-quiet by design (see the feature request: "ne legyen
// felesleges zaj"). Gated by CRON_SECRET, same as /api/reminder-email.
// Always sends via Resend regardless of the Beállítások → Email küldés
// provider choice (unattended cron job, no OAuth session) — reads the
// API key/from-address from that same menu when set, else RESEND_*_CHECK_DATE/RESEND_*.
const DEFAULT_FROM = "Zusammen Dashboard <connect@das-zusammen.ch>";
const DEFAULT_TO = "zusammen.swiss@gmail.com";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET nincs beállítva — az ellenőrzés-emlékeztető nincs bekapcsolva." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const resendConfig = await getResolvedResendConfig();
  if (!resendConfig.apiKey) {
    return NextResponse.json(
      { ok: false, error: "Nincs beállítva Resend API-kulcs (Beállítások → Email küldés, vagy RESEND_API_KEY)." },
      { status: 500 }
    );
  }

  // Service-role client — an unattended cron job has no Supabase Auth
  // session, so the anon-key client (which every table now requires
  // auth.uid() for) could never read this.
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  }

  const todayStr = isoDate(new Date());

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "Várakozás")
    .is("archived_at", null)
    .not("check_date", "is", null)
    .lte("check_date", todayStr)
    .order("check_date", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, "Nem sikerült lekérdezni az esedékes tételeket.") },
      { status: 500 }
    );
  }

  const dueTasks = data ?? [];
  if (dueTasks.length === 0) {
    return NextResponse.json({ ok: true, sent: false, count: 0 });
  }

  const lines: string[] = [
    `${dueTasks.length} esedékes ellenőrzés vár rád ma (${todayStr}):`,
    "",
    ...dueTasks.flatMap((t) => [`- ${t.title} (${t.check_date})`, `  ${SITE_URL}/tasks?open=${t.id}`]),
    "",
    "— A Zusammen dashboard automatikus emlékeztetője.",
  ];

  const resend = new Resend(resendConfig.apiKey);
  const { error: sendError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL_CHECK_DATE || resendConfig.from || DEFAULT_FROM,
    to: [process.env.REMINDER_EMAIL_TO || DEFAULT_TO],
    subject: `${dueTasks.length} esedékes ellenőrzés vár rád ma — Zusammen Dashboard`,
    text: lines.join("\n"),
  });

  if (sendError) {
    return NextResponse.json({ ok: false, error: sendError.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent: true, count: dueTasks.length });
}
