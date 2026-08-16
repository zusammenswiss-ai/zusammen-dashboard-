"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  KanbanSquare,
  Wallet,
  FolderOpen,
  Lightbulb,
  CircleCheck,
  FileText,
  Package,
  CalendarRange,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { formatCHF, timeAgo } from "@/lib/format";
import { PLAN_STATUS_HU, ORDER_STATUS_HU } from "@/lib/labels";
import type { PlanStatus, OrderStatus } from "@/lib/supabase/types";

type ActivityItem = {
  id: string;
  kind: "supplier" | "task" | "document" | "plan" | "order";
  title: string;
  detail: string;
  timestamp: string;
  href: string;
};

type Stats = {
  suppliersTotal: number;
  suppliersContacted: number;
  suppliersReplied: number;
  tasksTodo: number;
  tasksInProgress: number;
  tasksDone: number;
  revenue: number;
  margin: number;
  documentsTotal: number;
  ideasTotal: number;
  ordersOpen: number;
  ordersTotal: number;
};

export default function OverviewPage() {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [suppliersRes, tasksRes, financeRes, documentsRes, plansRes, ordersRes] = await Promise.all([
          supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
          supabase.from("tasks").select("*").order("created_at", { ascending: false }),
          supabase.from("finance_products").select("*"),
          supabase.from("documents").select("*").order("created_at", { ascending: false }),
          supabase.from("future_plans").select("*").order("created_at", { ascending: false }),
          supabase.from("orders").select("*").order("created_at", { ascending: false }),
        ]);

        const firstError =
          suppliersRes.error ||
          tasksRes.error ||
          financeRes.error ||
          documentsRes.error ||
          plansRes.error ||
          ordersRes.error;
        if (firstError) throw firstError;

        const suppliers = suppliersRes.data ?? [];
        const tasks = tasksRes.data ?? [];
        const finance = financeRes.data ?? [];
        const documents = documentsRes.data ?? [];
        const plans = plansRes.data ?? [];
        const orders = ordersRes.data ?? [];

        const revenue = finance.reduce((sum, p) => sum + p.price * p.units, 0);
        const margin = finance.reduce((sum, p) => sum + (p.price - p.cogs) * p.units, 0);

        setStats({
          suppliersTotal: suppliers.length,
          suppliersContacted: suppliers.filter((s) => s.contacted).length,
          suppliersReplied: suppliers.filter((s) => s.reply_received).length,
          tasksTodo: tasks.filter((t) => t.status === "Teendő").length,
          tasksInProgress: tasks.filter((t) => t.status === "Folyamatban").length,
          tasksDone: tasks.filter((t) => t.status === "Kész").length,
          revenue,
          margin,
          documentsTotal: documents.length,
          ideasTotal: plans.length,
          ordersOpen: orders.filter((o) => o.status !== "Done").length,
          ordersTotal: orders.length,
        });

        const items: ActivityItem[] = [
          ...suppliers.slice(0, 5).map((s) => ({
            id: `supplier-${s.id}`,
            kind: "supplier" as const,
            title: s.name,
            detail: s.category ? `Új beszállító · ${s.category}` : "Új beszállító",
            timestamp: s.created_at,
            href: "/suppliers",
          })),
          ...tasks.slice(0, 5).map((t) => ({
            id: `task-${t.id}`,
            kind: "task" as const,
            title: t.title,
            detail: `Feladat · ${t.status}`,
            timestamp: t.updated_at,
            href: `/tasks?open=${t.id}`,
          })),
          ...documents.slice(0, 5).map((d) => ({
            id: `document-${d.id}`,
            kind: "document" as const,
            title: d.title,
            detail: "Dokumentum hozzáadva",
            timestamp: d.created_at,
            href: "/documents",
          })),
          ...plans.slice(0, 5).map((p) => ({
            id: `plan-${p.id}`,
            kind: "plan" as const,
            title: p.title,
            detail: `Ötlet · ${PLAN_STATUS_HU[p.status as PlanStatus]}`,
            timestamp: p.created_at,
            href: "/future-plans",
          })),
          ...orders.slice(0, 5).map((o) => ({
            id: `order-${o.id}`,
            kind: "order" as const,
            title: o.customer_name,
            detail: `Megrendelés · ${ORDER_STATUS_HU[o.status as OrderStatus]}`,
            timestamp: o.created_at,
            href: "/orders",
          })),
        ]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 8);

        setActivity(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nem sikerült betölteni a dashboard adatait.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Áttekintés" subtitle="Zusammen indulási dashboard" />
        <EmptyState
          icon={Wallet}
          title="Csatlakoztasd a Supabase-t a kezdéshez"
          description="Add hozzá a Supabase URL-t és az anon kulcsot a környezethez, majd tölts be újra. Lépésről lépésre a README-ben találod."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Áttekintés"
        subtitle="Pillanatkép arról, hol tart most a Zusammen indulása."
        action={
          <Link href="/calendar" className="btn btn-ghost">
            <CalendarRange size={16} /> Naptár megnyitása
          </Link>
        }
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard
              icon={Users}
              label="Beszállítók"
              value={stats.suppliersTotal}
              hint={`${stats.suppliersContacted} megkeresve · ${stats.suppliersReplied} válaszolt`}
            />
            <StatCard
              icon={KanbanSquare}
              label="Nyitott feladatok"
              value={stats.tasksTodo + stats.tasksInProgress}
              hint={`${stats.tasksDone} kész`}
            />
            <StatCard
              icon={Package}
              label="Nyitott megrendelések"
              value={stats.ordersOpen}
              hint={`${stats.ordersTotal} összesen`}
            />
            <StatCard
              icon={Wallet}
              label="Várható bevétel"
              value={formatCHF(stats.revenue)}
              hint={`${formatCHF(stats.margin)} árrés`}
            />
            <StatCard
              icon={FolderOpen}
              label="Dokumentumok"
              value={stats.documentsTotal}
              hint={`${stats.ideasTotal} jövőbeli ötlet rögzítve`}
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h2 className="font-serif text-lg text-forest">Legutóbbi aktivitás</h2>
              {activity.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  Még nincs semmi rögzítve — kezdd egy beszállító, feladat vagy dokumentum hozzáadásával.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col divide-y divide-border">
                  {activity.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-ivory-dim/60"
                      >
                        <ActivityIcon kind={item.kind} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-forest">{item.title}</p>
                          <p className="text-xs text-muted">{item.detail}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted">{timeAgo(item.timestamp)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5">
              <h2 className="font-serif text-lg text-forest">Feladattábla</h2>
              <div className="mt-4 flex flex-col gap-3">
                <TaskProgressRow label="Teendő" value={stats.tasksTodo} color="bg-walnut" />
                <TaskProgressRow label="Folyamatban" value={stats.tasksInProgress} color="bg-bronze" />
                <TaskProgressRow label="Kész" value={stats.tasksDone} color="bg-forest" />
              </div>
              <Link
                href="/tasks"
                className="mt-5 inline-block text-sm font-medium text-bronze hover:underline"
              >
                Kanban tábla megnyitása →
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function ActivityIcon({ kind }: { kind: ActivityItem["kind"] }) {
  const map = {
    supplier: { icon: Users, className: "bg-walnut/10 text-walnut" },
    task: { icon: CircleCheck, className: "bg-bronze/10 text-bronze" },
    document: { icon: FileText, className: "bg-forest/10 text-forest" },
    plan: { icon: Lightbulb, className: "bg-bronze/10 text-bronze" },
    order: { icon: Package, className: "bg-forest-light/10 text-forest" },
  } as const;
  const { icon: Icon, className } = map[kind];
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${className}`}>
      <Icon size={15} />
    </span>
  );
}

function TaskProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-forest">{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ivory-dim">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: value === 0 ? "4%" : `${Math.min(100, value * 18)}%` }}
        />
      </div>
    </div>
  );
}
