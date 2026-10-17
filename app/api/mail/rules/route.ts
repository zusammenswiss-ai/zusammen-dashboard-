import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import type { MailRuleCondition, MailRuleAction } from "@/lib/supabase/types";

// GET /api/mail/rules — Postafiók → Szabályok lista, sorrend szerint.
export async function GET() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  const { data, error } = await supabase.from("mail_rules").select("*").order("sort_order");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rules: data });
}

type Body = { name?: string; conditions?: MailRuleCondition[]; actions?: MailRuleAction[]; enabled?: boolean };

// POST /api/mail/rules — új szabály, a lista végére (legnagyobb
// sort_order + 10).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.name?.trim()) return NextResponse.json({ ok: false, error: "Szabály neve kötelező." }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const { data: maxRow } = await supabase.from("mail_rules").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const sortOrder = (maxRow?.sort_order ?? 0) + 10;

  const { data, error } = await supabase
    .from("mail_rules")
    .insert({ name: body.name.trim(), conditions: body.conditions ?? [], actions: body.actions ?? [], enabled: body.enabled ?? true, sort_order: sortOrder })
    .select()
    .single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "Nem sikerült létrehozni." }, { status: 500 });
  return NextResponse.json({ ok: true, rule: data });
}
