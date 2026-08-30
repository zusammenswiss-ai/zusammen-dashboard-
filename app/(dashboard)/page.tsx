"use client";

import { useEffect, useMemo, useState } from "react";
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
  Stamp,
  MapPin,
  Sparkles,
  Award,
  Mail,
  Bell,
  ClockAlert,
  CircleAlert,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { formatDate, timeAgo } from "@/lib/format";
import { formatMoney } from "@/lib/currency";
import { DEFAULT_CURRENCY } from "@/lib/company-settings";
import { PLAN_STATUS_HU, ORDER_STATUS_HU } from "@/lib/labels";
import { fetchDueNotifications, type NotificationItem } from "@/lib/notifications";
import { nextGoldCardDate, daysUntil } from "@/lib/gold-card";
import { convertAmount, fetchExchangeRates, type ExchangeRates } from "@/lib/exchange-rates";
import type { CurrencyCode, PlanStatus, OrderStatus } from "@/lib/supabase/types";

// Two separate activity kinds, deliberately not merged into one feed —
// "the business" and "the personal ritual" are different concerns for a
// founder glancing at this page, so each gets its own clearly-labeled
// section instead of being interleaved by timestamp.
type BusinessActivityKind = "supplier" | "task" | "document" | "plan" | "order";
type RitualActivityKind = "goldcard" | "memory" | "wildcard" | "surprise";

type ActivityItem<K> = {
  id: string;
  kind: K;
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
  documentsTotal: number;
  ideasTotal: number;
  ordersOpen: number;
  ordersTotal: number;
  goldCardLettersTotal: number;
};

export default function OverviewPage() {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [businessActivity, setBusinessActivity] = useState<ActivityItem<BusinessActivityKind>[]>([]);
  const [ritualActivity, setRitualActivity] = useState<ActivityItem<RitualActivityKind>[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // null = not shown yet (still loading, Gmail not connected, or an
  // error) — a disconnected Gmail just leaves this section shorter, not
  // broken-looking.
  const [unreadMail, setUnreadMail] = useState<number | null>(null);
  // Raw Termékek rows + Beállítások → Pénznem, kept separate from Stats
  // (rather than folded into one setStats call) so the revenue/margin
  // stat card can be a useMemo depending on live exchange rates — those
  // load on their own schedule (see the effect below), independently of
  // this page's one-shot data fetch.
  const [financeRows, setFinanceRows] = useState<
    { sale_price: number | null; sale_price_currency: CurrencyCode; cogs: number | null; cogs_currency: string | null; planned_units: number }[]
  >([]);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  // Live árfolyamok a "Várható bevétel" stat card mixed-currency
  // összegzéséhez — see lib/exchange-rates.ts. Null just means "not
  // converted yet"; convertAmount degrades gracefully either way.
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  // Beállítások → Naptár-integráció; defaults to shown until the row
  // loads (or if it never existed) — matches the column's own db default.
  const [goldCardReminderEnabled, setGoldCardReminderEnabled] = useState(true);

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
        const [
          suppliersRes,
          tasksRes,
          financeRes,
          documentsRes,
          plansRes,
          ordersRes,
          goldCardLettersRes,
          goldCardLettersCountRes,
          journeyMemoriesRes,
          wildCardCompletionsRes,
          surpriseQuestionLogRes,
          notificationItems,
          companySettingsRes,
        ] = await Promise.all([
          supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
          supabase.from("tasks").select("*").order("created_at", { ascending: false }),
          supabase.from("products").select("sale_price, sale_price_currency, cogs, cogs_currency, planned_units"),
          supabase.from("documents").select("*").order("created_at", { ascending: false }),
          supabase.from("future_plans").select("*").order("created_at", { ascending: false }),
          supabase.from("orders").select("*").order("created_at", { ascending: false }),
          supabase.from("gold_card_letters").select("*").order("created_at", { ascending: false }).limit(5),
          supabase.from("gold_card_letters").select("id", { count: "exact", head: true }),
          supabase.from("journey_memories").select("*").order("created_at", { ascending: false }).limit(5),
          supabase.from("wild_card_completions").select("*").order("created_at", { ascending: false }).limit(5),
          supabase.from("surprise_question_log").select("*").order("created_at", { ascending: false }).limit(5),
          fetchDueNotifications(supabase),
          supabase.from("company_settings").select("gold_card_reminder_enabled, currency").maybeSingle(),
        ]);

        const firstError =
          suppliersRes.error ||
          tasksRes.error ||
          financeRes.error ||
          documentsRes.error ||
          plansRes.error ||
          ordersRes.error ||
          goldCardLettersRes.error ||
          goldCardLettersCountRes.error ||
          journeyMemoriesRes.error ||
          wildCardCompletionsRes.error ||
          surpriseQuestionLogRes.error;
        if (firstError) throw firstError;

        const suppliers = suppliersRes.data ?? [];
        const tasks = tasksRes.data ?? [];
        // Termékek katalógus rows — see the same revenue/margin math on
        // Pénzügyek, which reads this same table now. Kept in their own
        // state (not reduced here) so the stat card can react to
        // exchange rates loading asynchronously — see the useMemo below.
        setFinanceRows(financeRes.data ?? []);
        const documents = documentsRes.data ?? [];
        const plans = plansRes.data ?? [];
        const orders = ordersRes.data ?? [];
        const goldCardLetters = goldCardLettersRes.data ?? [];
        const journeyMemories = journeyMemoriesRes.data ?? [];
        const wildCardCompletions = wildCardCompletionsRes.data ?? [];
        const surpriseQuestionLog = surpriseQuestionLogRes.data ?? [];
        setCurrency(companySettingsRes.data?.currency ?? DEFAULT_CURRENCY);

        setStats({
          suppliersTotal: suppliers.length,
          suppliersContacted: suppliers.filter((s) => s.contacted).length,
          suppliersReplied: suppliers.filter((s) => s.reply_received).length,
          tasksTodo: tasks.filter((t) => t.status === "Teendő").length,
          tasksInProgress: tasks.filter((t) => t.status === "Folyamatban").length,
          tasksDone: tasks.filter((t) => t.status === "Kész").length,
          documentsTotal: documents.length,
          ideasTotal: plans.length,
          ordersOpen: orders.filter((o) => o.status !== "Done").length,
          ordersTotal: orders.length,
          goldCardLettersTotal: goldCardLettersCountRes.count ?? goldCardLetters.length,
        });

        const business: ActivityItem<BusinessActivityKind>[] = [
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

        const ritual: ActivityItem<RitualActivityKind>[] = [
          ...goldCardLetters.map((l) => ({
            id: `goldcard-${l.id}`,
            kind: "goldcard" as const,
            title: `Gold Card levél #${l.seq_number}`,
            detail: "Gold Card levél lepecsételve",
            timestamp: l.created_at,
            href: "/personal-ritual",
          })),
          ...journeyMemories.map((m) => ({
            id: `memory-${m.id}`,
            kind: "memory" as const,
            title: m.place,
            detail: "Új emlék hozzáadva",
            timestamp: m.created_at,
            href: "/personal-ritual",
          })),
          ...wildCardCompletions.map((w) => ({
            id: `wildcard-${w.id}`,
            kind: "wildcard" as const,
            title: w.wildcard_name,
            detail: `Wild Card teljesítve: ${w.wildcard_name}`,
            timestamp: w.created_at,
            href: "/personal-ritual",
          })),
          ...surpriseQuestionLog.map((s) => ({
            id: `surprise-${s.id}`,
            kind: "surprise" as const,
            title: "Meglepetés kérdés",
            detail: "Meglepetés kérdés elküldve",
            timestamp: s.created_at,
            href: "/personal-ritual",
          })),
        ]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5);

        setBusinessActivity(business);
        setRitualActivity(ritual);
        setNotifications(notificationItems);
        setGoldCardReminderEnabled(companySettingsRes.data?.gold_card_reminder_enabled ?? true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nem sikerült betölteni a dashboard adatait.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gmail/unread-count");
        const data = await res.json();
        if (res.ok && data.ok) setUnreadMail(data.count);
      } catch {
        // Silent — Gmail being unreachable shouldn't disturb the rest of
        // the Áttekintés, this section just stays without a mail row.
      }
    })();
  }, []);

  useEffect(() => {
    // A failed fetch just leaves rates null — the revenue stat card's
    // convertAmount calls fall back to unconverted sums, same as
    // before this feature existed, rather than breaking the page.
    fetchExchangeRates().then((result) => {
      if (result.ok) setRates(result.rates);
    });
  }, []);

  // Converted into `currency` (Beállítások → Pénznem) rather than just
  // summed raw — same fix as Pénzügyek's totals, see lib/exchange-rates.ts.
  const { revenue, margin } = useMemo(() => {
    let rev = 0;
    let mar = 0;
    for (const p of financeRows) {
      const price = convertAmount(p.sale_price ?? 0, p.sale_price_currency, currency, rates);
      const cogs = convertAmount(p.cogs ?? 0, (p.cogs_currency as CurrencyCode | null) ?? "CHF", currency, rates);
      rev += price * p.planned_units;
      mar += (price - cogs) * p.planned_units;
    }
    return { revenue: rev, margin: mar };
  }, [financeRows, currency, rates]);

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

  const today = new Date();
  const nextLetterDate = nextGoldCardDate(today);
  const nextLetterDays = daysUntil(nextLetterDate, today);
  const urgentTotal = notifications.length + (unreadMail ?? 0);

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
          {/* 1. What needs attention right now — the same criteria the nav's
              NotificationBell and the daily reminder email use (lib/notifications.ts),
              surfaced up front instead of only in a dropdown. */}
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <Bell size={17} className="text-bronze" />
              <h2 className="font-serif text-lg text-forest">Mire figyelj most</h2>
            </div>
            {urgentTotal === 0 ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                <CircleCheck size={15} className="text-forest" /> Minden rendben — nincs sürgős teendő ma.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {unreadMail !== null && unreadMail > 0 && (
                  <li>
                    <Link
                      href="/inbox"
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-ivory-dim/60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
                        <Mail size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-forest">{unreadMail} olvasatlan levél</p>
                        <p className="text-xs text-muted">Postaláda</p>
                      </div>
                    </Link>
                  </li>
                )}
                {notifications.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-ivory-dim/60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
                        <NotificationKindIcon kind={item.kind} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-forest">{item.title}</p>
                        <p className="truncate text-xs text-muted">{item.detail}</p>
                      </div>
                      <span
                        className={`badge shrink-0 ${
                          item.severity === "overdue" ? "bg-red-100 text-red-700" : "bg-bronze/15 text-walnut"
                        }`}
                      >
                        {item.severity === "overdue" ? <CircleAlert size={11} /> : <ClockAlert size={11} />}
                        {formatDate(item.date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 2. Business snapshot */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
              value={formatMoney(revenue, currency)}
              hint={`${formatMoney(margin, currency)} árrés`}
            />
            <StatCard
              icon={FolderOpen}
              label="Dokumentumok"
              value={stats.documentsTotal}
              hint={`${stats.ideasTotal} jövőbeli ötlet rögzítve`}
            />
          </div>

          {/* 3. Business activity + Kanban snapshot */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h2 className="font-serif text-lg text-forest">Üzleti aktivitás</h2>
              {businessActivity.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  Még nincs semmi rögzítve — kezdd egy beszállító, feladat vagy dokumentum hozzáadásával.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col divide-y divide-border">
                  {businessActivity.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-ivory-dim/60"
                      >
                        <BusinessActivityIcon kind={item.kind} />
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

          {/* 4. Személyes rituálé — kept visibly separate from the business
              sections above, mirroring the same activity+widget layout. */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h2 className="font-serif text-lg text-forest">Személyes rituálé aktivitás</h2>
              {ritualActivity.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  Még nincs rögzítve semmi — kezdj egy Gold Card levéllel vagy egy emlékkel.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col divide-y divide-border">
                  {ritualActivity.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-ivory-dim/60"
                      >
                        <RitualActivityIcon kind={item.kind} />
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
              <h2 className="font-serif text-lg text-forest">Következő Gold Card levél</h2>
              {goldCardReminderEnabled ? (
                <>
                  <p className="mt-4 font-serif text-2xl text-forest">
                    {nextLetterDays <= 0 ? "Ma esedékes" : `${nextLetterDays} nap`}
                  </p>
                  <p className="mt-1 text-xs text-muted">{formatDate(nextLetterDate.toISOString())}</p>
                </>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  A negyedéves emlékeztető szüneteltetve — állítsd vissza a Beállításokban.
                </p>
              )}
              <p className="mt-3 text-xs text-muted">{stats.goldCardLettersTotal} levél lepecsételve eddig</p>
              <Link
                href="/personal-ritual"
                className="mt-5 inline-block text-sm font-medium text-bronze hover:underline"
              >
                Személyes rituálé megnyitása →
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function NotificationKindIcon({ kind }: { kind: NotificationItem["kind"] }) {
  const map = {
    task: KanbanSquare,
    order: Package,
    contract: FileText,
  } as const;
  const Icon = map[kind];
  return <Icon size={15} />;
}

function BusinessActivityIcon({ kind }: { kind: BusinessActivityKind }) {
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

function RitualActivityIcon({ kind }: { kind: RitualActivityKind }) {
  const map = {
    goldcard: { icon: Stamp, className: "bg-bronze/10 text-bronze" },
    memory: { icon: MapPin, className: "bg-walnut/10 text-walnut" },
    wildcard: { icon: Award, className: "bg-bronze/10 text-bronze" },
    surprise: { icon: Sparkles, className: "bg-forest/10 text-forest" },
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
