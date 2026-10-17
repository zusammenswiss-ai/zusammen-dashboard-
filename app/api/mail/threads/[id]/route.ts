import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/serverClient";
import type { MailThreadStatus, MailThreadPriority } from "@/lib/supabase/types";

// GET /api/mail/threads/[id] — teljes szál: üzenetek, jegyzetek,
// napló, kapcsolódó elemek egy hívásban (service-role kliens, mail_messages/
// mail_activity csak "authenticated read").
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const [threadRes, messagesRes, notesRes, activityRes, linksRes, threadLabelsRes] = await Promise.all([
    supabase.from("mail_threads").select("*").eq("id", id).maybeSingle(),
    supabase.from("mail_messages").select("*").eq("thread_id", id).order("received_at", { ascending: true }),
    supabase.from("mail_notes").select("*").eq("thread_id", id).order("created_at", { ascending: true }),
    supabase.from("mail_activity").select("*").eq("thread_id", id).order("created_at", { ascending: true }),
    supabase.from("mail_thread_links").select("*").eq("thread_id", id),
    supabase.from("mail_thread_labels").select("label_id").eq("thread_id", id),
  ]);

  if (threadRes.error) return NextResponse.json({ ok: false, error: threadRes.error.message }, { status: 500 });
  if (!threadRes.data) return NextResponse.json({ ok: false, error: "A szál nem található." }, { status: 404 });

  const labelIds = (threadLabelsRes.data ?? []).map((l) => l.label_id);
  const labelsRes = labelIds.length > 0 ? await supabase.from("mail_labels").select("*").in("id", labelIds) : { data: [] };

  return NextResponse.json({
    ok: true,
    thread: threadRes.data,
    messages: messagesRes.data ?? [],
    notes: notesRes.data ?? [],
    activity: activityRes.data ?? [],
    links: linksRes.data ?? [],
    labels: labelsRes.data ?? [],
  });
}

type PatchBody = {
  status?: MailThreadStatus;
  priority?: MailThreadPriority;
  area?: string;
  owner?: string | null;
  actor?: string;
};

// PATCH /api/mail/threads/[id] — kézi besorolás/állapot/felelős/prioritás
// váltás. A kézi váltás mindig "_is_manual" flaget állít (area/owner),
// hogy egy jövőbeli szabály-kiértékelés sose írja felül (feladat 5/B/e
// pont utolsó mondata) — és minden változás mail_activity-ba kerül.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ ok: false, error: "Érvénytelen kérés." }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });

  const { data: current } = await supabase.from("mail_threads").select("*").eq("id", id).maybeSingle();
  if (!current) return NextResponse.json({ ok: false, error: "A szál nem található." }, { status: 404 });

  const update: Record<string, unknown> = {};
  const activityEntries: { action: string; detail: Record<string, unknown> }[] = [];
  const actor = body.actor?.trim() || null;

  if (body.area && body.area !== current.area) {
    update.area = body.area;
    update.area_is_manual = true;
    activityEntries.push({ action: "area_changed", detail: { from: current.area, to: body.area, manual: true } });
  }
  if (body.owner !== undefined && body.owner !== current.owner) {
    update.owner = body.owner;
    update.owner_is_manual = true;
    activityEntries.push({ action: "owner_changed", detail: { from: current.owner, to: body.owner } });
  }
  if (body.priority && body.priority !== current.priority) {
    update.priority = body.priority;
    activityEntries.push({ action: "priority_changed", detail: { from: current.priority, to: body.priority } });
  }
  if (body.status && body.status !== current.status) {
    update.status = body.status;
    if (body.status === "done") {
      update.closed_at = new Date().toISOString();
      update.closed_by = actor;
      activityEntries.push({ action: "closed", detail: { from: current.status } });
    } else if (current.status === "done") {
      update.closed_at = null;
      update.closed_by = null;
      activityEntries.push({ action: "reopened", detail: { from: current.status, to: body.status, manual: true } });
    } else {
      activityEntries.push({ action: "status_changed", detail: { from: current.status, to: body.status } });
    }
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true, thread: current });

  const { data: updated, error } = await supabase.from("mail_threads").update(update).eq("id", id).select().single();
  if (error || !updated) return NextResponse.json({ ok: false, error: error?.message || "Nem sikerült menteni." }, { status: 500 });

  if (activityEntries.length > 0) {
    await supabase.from("mail_activity").insert(activityEntries.map((e) => ({ thread_id: id, actor, action: e.action, detail: e.detail })));
  }

  return NextResponse.json({ ok: true, thread: updated });
}
