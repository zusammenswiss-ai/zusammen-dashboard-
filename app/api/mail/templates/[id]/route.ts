import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import type { MailTemplateType } from "@/lib/supabase/types";

type Body = { name?: string; area?: string | null; type?: MailTemplateType; subject?: string | null; body?: string };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "Érvénytelen kérés." }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const { data, error } = await supabase.from("mail_templates").update(body).eq("id", id).select().single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "Nem sikerült menteni." }, { status: 500 });
  return NextResponse.json({ ok: true, template: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  const { error } = await supabase.from("mail_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
