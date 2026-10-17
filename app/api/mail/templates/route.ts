import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import type { MailTemplateType } from "@/lib/supabase/types";

export async function GET() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  const { data, error } = await supabase.from("mail_templates").select("*").order("name");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, templates: data });
}

type Body = { name?: string; area?: string | null; type?: MailTemplateType; subject?: string; body?: string };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.name?.trim()) return NextResponse.json({ ok: false, error: "Sablon neve kötelező." }, { status: 400 });
  if (!body.body?.trim()) return NextResponse.json({ ok: false, error: "Sablon szövege kötelező." }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const { data, error } = await supabase
    .from("mail_templates")
    .insert({ name: body.name.trim(), area: body.area || null, type: body.type ?? "standard", subject: body.subject?.trim() || null, body: body.body })
    .select()
    .single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "Nem sikerült létrehozni." }, { status: 500 });
  return NextResponse.json({ ok: true, template: data });
}
