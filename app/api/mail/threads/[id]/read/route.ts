import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";

// POST /api/mail/threads/[id]/read — a szál MEGNYITÁSAKOR hívja a UI,
// a Dashboard-beli "olvasva" állapotot állítja (mail_messages.read_at),
// SOSEM az IMAP szerveren (nincs \Seen STORE parancs sehol a kódban) —
// lásd lib/mail-sync.ts kommentjét, miért különbözik ez a kettő.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const { error } = await supabase
    .from("mail_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", id)
    .eq("direction", "in")
    .is("read_at", null);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
