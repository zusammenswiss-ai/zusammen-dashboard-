import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// GET /api/newsletter/unsubscribe?email=... — the link every campaign
// email ends with (see lib/email-campaign.ts's personalizeTemplate).
// Deliberately unauthenticated (a person clicking this from their inbox
// has no dashboard session) and works for BOTH recipient sources: it
// always records the address in the global email_unsubscribes
// suppression list checked by every future send (see the comment on
// that table in supabase/schema.sql), and additionally flips
// newsletter_subscribers.unsubscribed when a matching row exists.
//
// Builds its own anon client inline — same pattern as /api/calendar/ics
// and /api/send-email.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return new NextResponse("A Supabase nincs beállítva.", { status: 503 });
  }
  if (!email) {
    return new NextResponse("Hiányzó email cím.", { status: 400 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  await supabase.from("email_unsubscribes").upsert({ email });
  await supabase.from("newsletter_subscribers").update({ unsubscribed: true }).eq("email", email);

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Unsubscribed — Zusammen</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f4ee; color: #2b3a2f;
         display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
  .card { max-width: 420px; text-align: center; background: #fff; border-radius: 12px; padding: 32px 28px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  h1 { font-size: 1.25rem; margin: 0 0 8px; }
  p { font-size: .95rem; color: #5b6b5e; margin: 0; }
</style>
</head>
<body>
  <div class="card">
    <h1>You've been unsubscribed.</h1>
    <p>Du wurdest von der Zusammen Mailingliste abgemeldet — ${email} erhält keine weiteren Kampagnen-Emails mehr.</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
