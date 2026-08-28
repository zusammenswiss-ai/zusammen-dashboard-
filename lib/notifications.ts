// Shared "what needs attention" logic — same due-date/contract-expiry
// criteria used by both the daily reminder email
// (app/api/reminder-email/route.ts) and the NotificationBell in the
// nav, so the two never drift out of sync. Works with either the
// browser anon client or a server-side client, since both are plain
// SupabaseClient<Database> instances.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

export type NotificationKind = "task" | "order" | "contract";
export type NotificationSeverity = "overdue" | "soon";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  detail: string;
  date: string;
  href: string;
};

const DUE_SOON_DAYS = 3;
const CONTRACT_SOON_DAYS = 14;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Overdue/soon-due Feladatok, overdue/soon Megrendelés deliveries, and
 * Beszállító contracts expiring within CONTRACT_SOON_DAYS — sorted
 * overdue-first, then by date. Throws on a Supabase error (caller
 * decides how to surface that).
 */
export async function fetchDueNotifications(
  supabase: SupabaseClient<Database>
): Promise<NotificationItem[]> {
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
  if (tasksRes.error) throw tasksRes.error;
  if (ordersRes.error) throw ordersRes.error;
  if (suppliersRes.error) throw suppliersRes.error;

  const items: NotificationItem[] = [];

  for (const t of tasksRes.data ?? []) {
    if (!t.due_date) continue;
    if (t.due_date < todayStr) {
      items.push({
        id: `task-${t.id}`,
        kind: "task",
        severity: "overdue",
        title: t.title,
        detail: `Lejárt határidejű feladat`,
        date: t.due_date,
        href: `/tasks?open=${t.id}`,
      });
    } else if (t.due_date <= dueSoonStr) {
      items.push({
        id: `task-${t.id}`,
        kind: "task",
        severity: "soon",
        title: t.title,
        detail: `Hamarosan esedékes feladat`,
        date: t.due_date,
        href: `/tasks?open=${t.id}`,
      });
    }
  }

  for (const o of ordersRes.data ?? []) {
    if (!o.delivery_date) continue;
    if (o.delivery_date < todayStr) {
      items.push({
        id: `order-${o.id}`,
        kind: "order",
        severity: "overdue",
        title: o.customer_name,
        detail: "Késésben lévő megrendelés",
        date: o.delivery_date,
        href: "/orders",
      });
    } else if (o.delivery_date <= dueSoonStr) {
      items.push({
        id: `order-${o.id}`,
        kind: "order",
        severity: "soon",
        title: o.customer_name,
        detail: "Hamarosan szállítandó megrendelés",
        date: o.delivery_date,
        href: "/orders",
      });
    }
  }

  for (const s of suppliersRes.data ?? []) {
    if (!s.contract_valid_until || s.contract_valid_until > contractSoonStr) continue;
    const overdue = s.contract_valid_until < todayStr;
    items.push({
      id: `contract-${s.id}`,
      kind: "contract",
      severity: overdue ? "overdue" : "soon",
      title: s.name,
      detail: overdue ? "Lejárt beszállítói szerződés" : "Hamarosan lejáró beszállítói szerződés",
      date: s.contract_valid_until,
      href: "/suppliers",
    });
  }

  return items.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "overdue" ? -1 : 1;
    return a.date.localeCompare(b.date);
  });
}
