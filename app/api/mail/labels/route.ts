import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";

export async function GET() {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  const { data, error } = await supabase.from("mail_labels").select("*").order("name");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, labels: data });
}

type Body = { name?: string; color?: string };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.name?.trim()) return NextResponse.json({ ok: false, error: "Címke neve kötelező." }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const { data, error } = await supabase
    .from("mail_labels")
    .insert({ name: body.name.trim(), color: body.color || "#9a6a39" })
    .select()
    .single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "Nem sikerült létrehozni." }, { status: 500 });
  return NextResponse.json({ ok: true, label: data });
}
