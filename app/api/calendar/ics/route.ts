import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { fetchAllCalendarEvents } from "@/lib/calendar-events";
import { buildICS } from "@/lib/ics";

// Naptár .ics subscription feed — pasted into Google Calendar/Apple
// Naptár/a phone's calendar app as "Subscribe by URL", so every business
// + personal-ritual date the dashboard already tracks shows up (and gets
// native reminders) in the founder's actual calendar app. Gated by
// ?token= against company_settings.ics_token (see Beállítások → "Naptár
// feliratkozás") rather than the dashboard's own Basic Auth — see the
// comment on proxy.ts's matcher for why: calendar apps polling this URL
// generally can't supply Basic Auth credentials.
//
// Builds its own anon client inline (not lib/supabase/client.ts, which
// is a "use client" module) — same pattern as /api/send-email and the
// reminder-email cron route.
export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return new NextResponse("A Supabase nincs beállítva.", { status: 503 });
  }
  const supabase = createClient<Database>(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const { data: settings } = await supabase.from("company_settings").select("ics_token").maybeSingle();
  if (!settings?.ics_token || token !== settings.ics_token) {
    return new NextResponse("Érvénytelen vagy hiányzó token — generálj egyet a Beállításokban.", { status: 401 });
  }

  const events = await fetchAllCalendarEvents(supabase);
  const ics = buildICS("Zusammen Naptár", events);

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "inline; filename=zusammen-naptar.ics",
      // Calendar apps poll on their own schedule (typically hourly or
      // slower) — no point letting an intermediary cache a stale feed
      // in between and delay picking up new events.
      "Cache-Control": "no-store",
    },
  });
}
