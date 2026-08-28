import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Database } from "@/lib/supabase/types";
import { getUnreadInboxCount } from "@/lib/email/gmail-inbox";
import { fetchDueNotifications, type NotificationItem } from "@/lib/notifications";

// Fired daily by Vercel Cron (see vercel.json) — summarizes what's due
// (overdue/soon tasks, overdue/soon order deliveries, expiring supplier
// contracts — via lib/notifications.ts, shared with the NotificationBell
// in the nav so the two criteria never drift apart) and emails it via
// Resend. Gated by CRON_SECRET so this route can't be triggered by
// anyone who finds the URL.
const DEFAULT_FROM = "Zusammen <onboarding@resend.dev>";
const DEFAULT_TO = "zusammen.swiss@gmail.com";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function byKindSeverity(items: NotificationItem[], kind: NotificationItem["kind"], severity: NotificationItem["severity"]) {
  return items.filter((n) => n.kind === kind && n.severity === severity);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET nincs beállítva — az emlékeztető email nincs bekapcsolva." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: "Supabase nincs konfigurálva." }, { status: 500 });
  }
  if (!resendKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY nincs beállítva." }, { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const todayStr = isoDate(new Date());

  let notifications: NotificationItem[];
  try {
    notifications = await fetchDueNotifications(supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nem sikerült lekérdezni az emlékeztetőket.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  const overdueTasks = byKindSeverity(notifications, "task", "overdue");
  const dueSoonTasks = byKindSeverity(notifications, "task", "soon");
  const overdueOrders = byKindSeverity(notifications, "order", "overdue");
  const dueSoonOrders = byKindSeverity(notifications, "order", "soon");
  const expiringContracts = notifications.filter((n) => n.kind === "contract");

  // Best-effort — a lapsed/disconnected Gmail account (no one there to
  // click a reconnect prompt on an unattended cron job) should never
  // break the rest of the reminder, so this just silently omits the
  // line instead of failing the whole route. See README for why this
  // route stays independent of the Gmail connection's health.
  let unreadCount: number | null = null;
  try {
    const unreadResult = await getUnreadInboxCount();
    if (unreadResult.ok) unreadCount = unreadResult.count;
  } catch {
    // ignored — see comment above
  }

  const hasAnything = Boolean(notifications.length || unreadCount);

  const lines: string[] = [`Zusammen — napi összefoglaló (${todayStr})`, ""];

  if (!hasAnything) {
    lines.push("Nincs sürgős tennivaló mára. Szép napot!");
  } else {
    if (overdueTasks.length) {
      lines.push(`Lejárt határidejű feladatok (${overdueTasks.length}):`);
      overdueTasks.forEach((t) => lines.push(`  - ${t.title} (${t.date})`));
      lines.push("");
    }
    if (dueSoonTasks.length) {
      lines.push(`Hamarosan esedékes feladatok (${dueSoonTasks.length}):`);
      dueSoonTasks.forEach((t) => lines.push(`  - ${t.title} (${t.date})`));
      lines.push("");
    }
    if (overdueOrders.length) {
      lines.push(`Késésben lévő megrendelések (${overdueOrders.length}):`);
      overdueOrders.forEach((o) => lines.push(`  - ${o.title} (${o.date})`));
      lines.push("");
    }
    if (dueSoonOrders.length) {
      lines.push(`Hamarosan szállítandó megrendelések (${dueSoonOrders.length}):`);
      dueSoonOrders.forEach((o) => lines.push(`  - ${o.title} (${o.date})`));
      lines.push("");
    }
    if (expiringContracts.length) {
      lines.push(`Lejáró/lejárt beszállítói szerződések (${expiringContracts.length}):`);
      expiringContracts.forEach((s) => lines.push(`  - ${s.title} (${s.date})`));
      lines.push("");
    }
    if (unreadCount) {
      lines.push(`${unreadCount} olvasatlan levél a Postaládában.`);
      lines.push("");
    }
  }

  lines.push("— A Zusammen dashboard automatikus emlékeztetője.");

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
    to: [process.env.REMINDER_EMAIL_TO || DEFAULT_TO],
    subject: `Zusammen — napi összefoglaló (${todayStr})`,
    text: lines.join("\n"),
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, hasAnything });
}
