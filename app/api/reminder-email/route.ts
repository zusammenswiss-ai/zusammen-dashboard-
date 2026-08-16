import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import type { Database } from "@/lib/supabase/types";

// Fired daily by Vercel Cron (see vercel.json) — summarizes what's due
// (overdue/soon tasks, overdue/soon order deliveries, expiring supplier
// contracts) and emails it via Resend. Gated by CRON_SECRET so this
// route can't be triggered by anyone who finds the URL.
const DUE_SOON_DAYS = 3;
const CONTRACT_SOON_DAYS = 14;
const DEFAULT_FROM = "Zusammen <onboarding@resend.dev>";
const DEFAULT_TO = "zusammen.swiss@gmail.com";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number) {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
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

  const today = new Date();
  const todayStr = isoDate(today);
  const dueSoonStr = isoDate(addDays(today, DUE_SOON_DAYS));
  const contractSoonStr = isoDate(addDays(today, CONTRACT_SOON_DAYS));

  const [tasksRes, ordersRes, suppliersRes] = await Promise.all([
    supabase.from("tasks").select("*").not("due_date", "is", null).neq("status", "Kész"),
    supabase.from("orders").select("*").not("delivery_date", "is", null).neq("status", "Done"),
    supabase
      .from("suppliers")
      .select("*")
      .eq("contract_status", "Signed")
      .not("contract_valid_until", "is", null),
  ]);

  const firstError = tasksRes.error || ordersRes.error || suppliersRes.error;
  if (firstError) {
    return NextResponse.json({ ok: false, error: firstError.message }, { status: 500 });
  }

  const tasks = tasksRes.data ?? [];
  const orders = ordersRes.data ?? [];
  const suppliers = suppliersRes.data ?? [];

  const overdueTasks = tasks.filter((t) => t.due_date! < todayStr);
  const dueSoonTasks = tasks.filter((t) => t.due_date! >= todayStr && t.due_date! <= dueSoonStr);

  const overdueOrders = orders.filter((o) => o.delivery_date! < todayStr);
  const dueSoonOrders = orders.filter((o) => o.delivery_date! >= todayStr && o.delivery_date! <= dueSoonStr);

  const expiringContracts = suppliers.filter((s) => s.contract_valid_until! <= contractSoonStr);

  const hasAnything = Boolean(
    overdueTasks.length ||
      dueSoonTasks.length ||
      overdueOrders.length ||
      dueSoonOrders.length ||
      expiringContracts.length
  );

  const lines: string[] = [`Zusammen — napi összefoglaló (${todayStr})`, ""];

  if (!hasAnything) {
    lines.push("Nincs sürgős tennivaló mára. Szép napot!");
  } else {
    if (overdueTasks.length) {
      lines.push(`Lejárt határidejű feladatok (${overdueTasks.length}):`);
      overdueTasks.forEach((t) => lines.push(`  - ${t.title} (${t.due_date})`));
      lines.push("");
    }
    if (dueSoonTasks.length) {
      lines.push(`Hamarosan esedékes feladatok (${dueSoonTasks.length}):`);
      dueSoonTasks.forEach((t) => lines.push(`  - ${t.title} (${t.due_date})`));
      lines.push("");
    }
    if (overdueOrders.length) {
      lines.push(`Késésben lévő megrendelések (${overdueOrders.length}):`);
      overdueOrders.forEach((o) => lines.push(`  - ${o.customer_name} (${o.delivery_date})`));
      lines.push("");
    }
    if (dueSoonOrders.length) {
      lines.push(`Hamarosan szállítandó megrendelések (${dueSoonOrders.length}):`);
      dueSoonOrders.forEach((o) => lines.push(`  - ${o.customer_name} (${o.delivery_date})`));
      lines.push("");
    }
    if (expiringContracts.length) {
      lines.push(`Lejáró/lejárt beszállítói szerződések (${expiringContracts.length}):`);
      expiringContracts.forEach((s) => lines.push(`  - ${s.name} (${s.contract_valid_until})`));
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
