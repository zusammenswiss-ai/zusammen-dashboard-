import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";

// POST /api/mail/rules/reorder — body: { ids: string[] } az új
// sorrendben; a feladat 5/B/e pontja kéri, hogy "a szabályok sorrendje
// állítható" legyen.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { ids?: string[] } | null;
  if (!body?.ids?.length) return NextResponse.json({ ok: false, error: "Hiányzó sorrend." }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  for (let i = 0; i < body.ids.length; i++) {
    await supabase.from("mail_rules").update({ sort_order: (i + 1) * 10 }).eq("id", body.ids[i]);
  }
  return NextResponse.json({ ok: true });
}
