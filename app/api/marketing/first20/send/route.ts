import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import { isBrevoConfigured } from "@/lib/brevo";
import { sendFirst20Email, findRecentSend, FIRST20_FOUNDER_TEST_EMAIL } from "@/lib/first20-send";
import type { First20EmailType } from "@/lib/supabase/types";

// POST /api/marketing/first20/send — a jelentkező részletnézetének
// "Küldés" gombja (előnézet + megerősítés után, lásd SignupEmailsTab).
// Reached only from the authenticated Marketing/Kampányok page (behind
// proxy.ts's login redirect), same reasoning as
// /api/marketing/send-campaign for using the service-role client:
// first20_emails RLS has no insert policy for the authenticated role at
// all (deliberately — see supabase/schema.sql), and the browser session
// JWT doesn't carry through to this server route either way.
const VALID_TYPES: First20EmailType[] = ["kit", "reminder", "feedback", "order_confirmation", "custom"];

type Body = {
  signupId?: string;
  type?: string;
  mode?: "real" | "test";
  force?: boolean;
  customSubject?: string;
  customBody?: string;
};

export async function POST(request: Request) {
  if (!isBrevoConfigured()) {
    return NextResponse.json(
      { ok: false, error: "BREVO_API_KEY nincs beállítva a szerveren — kérj egyet a founder-től." },
      { status: 500 }
    );
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const signupId = body?.signupId?.trim();
  const type = body?.type as First20EmailType | undefined;
  const mode = body?.mode === "test" ? "test" : "real";
  if (!signupId || !type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ ok: false, error: "Hiányzó vagy érvénytelen jelentkező/típus." }, { status: 400 });
  }
  if (type === "custom" && !body?.customSubject?.trim()) {
    return NextResponse.json({ ok: false, error: "Saját levélhez tárgy is szükséges." }, { status: 400 });
  }

  const { data: signup, error: signupError } = await supabase
    .from("first20_signups")
    .select("*")
    .eq("id", signupId)
    .maybeSingle();
  if (signupError) return NextResponse.json({ ok: false, error: signupError.message }, { status: 500 });
  if (!signup) return NextResponse.json({ ok: false, error: "A jelentkező nem található." }, { status: 404 });

  if (mode === "test") {
    const result = await sendFirst20Email({
      supabase,
      signup,
      type,
      trigger: "manual",
      sentBy: null,
      testOverrideEmail: FIRST20_FOUNDER_TEST_EMAIL,
      customSubject: body?.customSubject?.trim(),
      customBodyText: body?.customBody,
    });
    return result.ok
      ? NextResponse.json({ ok: true, email: result.email, signup: result.signup })
      : NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  // Valódi küldés — dupla-küldés elleni védelem, hacsak a kliens nem
  // kért explicit megerősített ismétlést (force).
  if (type !== "custom" && !body?.force) {
    const recent = await findRecentSend(supabase, signupId, type);
    if (recent) {
      return NextResponse.json(
        { ok: false, duplicate: true, lastSentAt: recent.sent_at, error: "Ezt a típusú levelet már elküldted 24 órán belül." },
        { status: 409 }
      );
    }
  }

  const result = await sendFirst20Email({
    supabase,
    signup,
    type,
    trigger: "manual",
    sentBy: null,
    customSubject: body?.customSubject?.trim(),
    customBodyText: body?.customBody,
  });

  return result.ok
    ? NextResponse.json({ ok: true, email: result.email, signup: result.signup })
    : NextResponse.json({ ok: false, error: result.error }, { status: 502 });
}
