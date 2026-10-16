import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import type { First20WouldBuy } from "@/lib/supabase/types";

// GET/POST /api/first20/feedback/[token] — the public, unauthenticated
// backend for app/first20/feedback/[token]/page.tsx (the {{feedback_url}}
// link sent by the "Visszajelzés kérése" email). Deliberately
// token-gated rather than Supabase-Auth-gated, same reasoning as
// /api/first20/signup: a real visitor's browser carries no founder
// session. The token itself (32 random hex chars, see
// lib/first20-send.ts) is the only thing that proves "this is the right
// signup" — never exposed anywhere except in the email sent to that
// exact recipient.
const WOULD_BUY_VALUES: First20WouldBuy[] = ["igen", "talan", "nem"];
const NOT_YET_PROGRESSED = ["Jelentkezett", "Kit elküldve"];

type RouteParams = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "generic" }, { status: 503 });

  const { data } = await supabase
    .from("first20_signups")
    .select("first_name, partner_first_name, language_choice, feedback_received_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return NextResponse.json({ ok: false, error: "notFound" }, { status: 404 });

  return NextResponse.json({ ok: true, signup: data });
}

type FeedbackBody = {
  eveningDone?: boolean;
  bestCardOrChange?: string;
  wouldBuy?: string;
  wouldBuyWhy?: string;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "generic" }, { status: 503 });

  let body: FeedbackBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "generic" }, { status: 400 });
  }

  if (body.wouldBuy && !WOULD_BUY_VALUES.includes(body.wouldBuy as First20WouldBuy)) {
    return NextResponse.json({ ok: false, error: "generic" }, { status: 400 });
  }

  const { data: signup } = await supabase.from("first20_signups").select("id, status").eq("token", token).maybeSingle();
  if (!signup) return NextResponse.json({ ok: false, error: "notFound" }, { status: 404 });

  const { error } = await supabase
    .from("first20_signups")
    .update({
      evening_done: body.eveningDone === true,
      best_card_or_change: body.bestCardOrChange?.trim() || null,
      would_buy: (body.wouldBuy as First20WouldBuy) ?? null,
      would_buy_why: body.wouldBuyWhy?.trim() || null,
      feedback_received_at: new Date().toISOString(),
      ...(NOT_YET_PROGRESSED.includes(signup.status) ? { status: "Visszajelzett" as const } : {}),
    })
    .eq("id", signup.id);

  if (error) return NextResponse.json({ ok: false, error: "generic" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
