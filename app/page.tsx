"use client";

import { useEffect, useState } from "react";
import {
  Users,
  KanbanSquare,
  Wallet,
  FolderOpen,
  Lightbulb,
  CircleCheck,
  FileText,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { formatCHF, timeAgo } from "@/lib/format";

type ActivityItem = {
  id: string;
  kind: "supplier" | "task" | "document" | "plan";
  title: string;
  detail: string;
  timestamp: string;
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
        const [suppliersRes, tasksRes, financeRes, documentsRes, plansRes] = await Promise.all([
          supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
          supabase.from("tasks").select("*").order("created_at", { ascending: false }),
          supabase.from("finance_products").select("*"),
          supabase.from("documents").select("*").order("created_at", { ascending: false }),
          supabase.from("future_plans").select("*").order("created_at", { ascending: false }),
        ]);

        const firstError =
          suppliersRes.error || tasksRes.error || financeRes.error || documentsRes.error || plansRes.error;
        if (firstError) throw firstError;

        const suppliers = suppliersRes.data ?? [];
        const tasks = tasksRes.data ?? [];
        const finance = financeRes.data ?? [];
        const documents = documentsRes.data ?? [];
        const plans = plansRes.data ?? [];

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
        });

        const items: ActivityItem[] = [
          ...suppliers.slice(0, 5).map((s) => ({
            id: `supplier-${s.id}`,
            kind: "supplier" as const,
            title: s.name,
            detail: s.category ? `New supplier · ${s.category}` : "New supplier",
            timestamp: s.created_at,
          })),
          ...tasks.slice(0, 5).map((t) => ({
            id: `task-${t.id}`,
            kind: "task" as const,
            title: t.title,
            detail: `Task · ${t.status}`,
            timestamp: t.updated_at,
          })),
          ...documents.slice(0, 5).map((d) => ({
            id: `document-${d.id}`,
            kind: "document" as const,
            title: d.title,
            detail: "Document added",
            timestamp: d.created_at,
          })),
          ...plans.slice(0, 5).map((p) => ({
            id: `plan-${p.id}`,
            kind: "plan" as const,
            title: p.title,
            detail: `Idea · ${p.status}`,
            timestamp: p.created_at,
          })),
        ]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 8);

        setActivity(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Overview" subtitle="Zusammen launch dashboard" />
        <EmptyState
          icon={Wallet}
          title="Connect Supabase to get started"
          description="Add your Supabase URL and anon key to the environment, then reload this page. See the README for step-by-step instructions."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="A snapshot of where the Zusammen launch stands today."
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Suppliers"
              value={stats.suppliersTotal}
              hint={`${stats.suppliersContacted} contacted · ${stats.suppliersReplied} replied`}
            />
            <StatCard
              icon={KanbanSquare}
              label="Open tasks"
              value={stats.tasksTodo + stats.tasksInProgress}
              hint={`${stats.tasksDone} completed`}
            />
            <StatCard
              icon={Wallet}
              label="Projected revenue"
              value={formatCHF(stats.revenue)}
              hint={`${formatCHF(stats.margin)} margin`}
            />
            <StatCard
              icon={FolderOpen}
              label="Documents"
              value={stats.documentsTotal}
              hint={`${stats.ideasTotal} future ideas logged`}
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h2 className="font-serif text-lg text-forest">Recent activity</h2>
              {activity.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  Nothing logged yet — start by adding a supplier, task, or document.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col divide-y divide-border">
                  {activity.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-3">
                      <ActivityIcon kind={item.kind} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-forest">{item.title}</p>
                        <p className="text-xs text-muted">{item.detail}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{timeAgo(item.timestamp)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5">
              <h2 className="font-serif text-lg text-forest">Task board</h2>
              <div className="mt-4 flex flex-col gap-3">
                <TaskProgressRow label="Teendő" value={stats.tasksTodo} color="bg-walnut" />
                <TaskProgressRow label="Folyamatban" value={stats.tasksInProgress} color="bg-bronze" />
                <TaskProgressRow label="Kész" value={stats.tasksDone} color="bg-forest" />
              </div>
              <a
                href="/tasks"
                className="mt-5 inline-block text-sm font-medium text-bronze hover:underline"
              >
                Open the Kanban board →
              </a>
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
