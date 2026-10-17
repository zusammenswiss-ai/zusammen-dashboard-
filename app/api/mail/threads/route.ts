import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";

// GET /api/mail/threads — Postaláda szállista, szűrőkkel. Service-role
// kliens kell, mert mail_messages (az "van-e olvasatlan bejövő üzenete"
// és az "utolsó üzenet előnézete" számításhoz) csak "authenticated read"
// RLS-sel olvasható, aggregálva viszont a böngésző Supabase-klienssel
// nem egyszerű egy lekérdezésben — itt a szerver route végzi el.
// ?area=marketing|support|...  ?unread=true  ?status=waiting
export async function GET(request: Request) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const url = new URL(request.url);
  const area = url.searchParams.get("area");
  const status = url.searchParams.get("status");
  const unreadOnly = url.searchParams.get("unread") === "true";
  const linked = url.searchParams.get("linked"); // "true" | "false" | null

  let query = supabase.from("mail_threads").select("*").order("last_message_at", { ascending: false, nullsFirst: false }).limit(200);
  if (area) query = query.eq("area", area);
  if (status) query = query.eq("status", status);
  const { data: threads, error } = await query;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const threadIds = (threads ?? []).map((t) => t.id);
  if (threadIds.length === 0) return NextResponse.json({ ok: true, threads: [] });

  const [messagesRes, linksRes] = await Promise.all([
    supabase
      .from("mail_messages")
      .select("thread_id, direction, from_addr, from_name, subject, body_text, received_at, read_at, signup_id")
      .in("thread_id", threadIds)
      .order("received_at", { ascending: false }),
    supabase.from("mail_thread_links").select("thread_id, entity_type, entity_id").in("thread_id", threadIds),
  ]);
  if (messagesRes.error) return NextResponse.json({ ok: false, error: messagesRes.error.message }, { status: 500 });

  const byThread = new Map<string, typeof messagesRes.data>();
  for (const m of messagesRes.data ?? []) {
    const list = byThread.get(m.thread_id) ?? [];
    list.push(m);
    byThread.set(m.thread_id, list);
  }
  const linksByThread = new Map<string, { entity_type: string; entity_id: string }[]>();
  for (const l of linksRes.data ?? []) {
    const list = linksByThread.get(l.thread_id) ?? [];
    list.push(l);
    linksByThread.set(l.thread_id, list);
  }

  let rows = (threads ?? []).map((thread) => {
    const messages = byThread.get(thread.id) ?? [];
    const latest = messages[0] ?? null;
    const hasUnread = messages.some((m) => m.direction === "in" && !m.read_at);
    const links = linksByThread.get(thread.id) ?? [];
    const signupLink = messages.find((m) => m.signup_id)?.signup_id ?? null;
    return {
      ...thread,
      latest_from: latest?.from_name || latest?.from_addr || null,
      latest_snippet: latest?.body_text?.slice(0, 160) || null,
      has_unread: hasUnread,
      signup_id: signupLink,
      links,
    };
  });

  if (unreadOnly) rows = rows.filter((r) => r.has_unread);
  if (linked === "true") rows = rows.filter((r) => r.signup_id || r.links.length > 0);
  if (linked === "false") rows = rows.filter((r) => !r.signup_id && r.links.length === 0);

  return NextResponse.json({ ok: true, threads: rows });
}
