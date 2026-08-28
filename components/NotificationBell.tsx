"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ClockAlert, CircleAlert, Mail, KanbanSquare, Package, FileText } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { fetchDueNotifications, type NotificationItem } from "@/lib/notifications";
import { formatDate } from "@/lib/format";

const KIND_ICON = {
  task: KanbanSquare,
  order: Package,
  contract: FileText,
} as const;

const SEVERITY_STYLES = {
  overdue: "bg-red-100 text-red-700",
  soon: "bg-bronze/15 text-walnut",
} as const;

/**
 * Bell in the nav — aggregates the same "what needs attention" list as
 * the daily reminder email (lib/notifications.ts) plus the unread Gmail
 * count, so the founder can check everything from inside the dashboard,
 * not just once a day in their inbox.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadMail, setUnreadMail] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        (async () => {
          if (!isSupabaseConfigured) return [];
          const supabase = getSupabaseClient();
          if (!supabase) return [];
          return fetchDueNotifications(supabase);
        })(),
        (async () => {
          const res = await fetch("/api/gmail/unread-count");
          const data = await res.json();
          return res.ok && data.ok ? (data.count as number) : null;
        })(),
      ]);
      const [notificationsResult, unreadResult] = results;
      if (notificationsResult.status === "fulfilled") setItems(notificationsResult.value);
      else setError("Nem sikerült betölteni néhány értesítést.");
      setUnreadMail(unreadResult.status === "fulfilled" ? unreadResult.value : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) void load(); // refresh on every open, cheap and keeps a long-open tab from going stale
      return next;
    });
  }

  const total = items.length + (unreadMail ?? 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggle}
        aria-label="Értesítések"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-ivory/80 transition-colors hover:bg-forest-light hover:text-ivory"
      >
        <Bell size={18} />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-bronze px-1 text-[10px] font-semibold leading-none text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="animate-fade-in absolute right-0 top-11 z-50 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-serif text-sm text-forest">Értesítések</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 && unreadMail === null ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Betöltés…</p>
            ) : error && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-red-600">{error}</p>
            ) : total === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Nincs új értesítés.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {unreadMail !== null && unreadMail > 0 && (
                  <li>
                    <Link
                      href="/inbox"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ivory-dim/60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
                        <Mail size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-forest">
                          {unreadMail} olvasatlan levél
                        </p>
                        <p className="text-xs text-muted">Postaláda</p>
                      </div>
                    </Link>
                  </li>
                )}
                {items.map((item) => {
                  const Icon = KIND_ICON[item.kind];
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ivory-dim/60"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
                          <Icon size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-forest">{item.title}</p>
                          <p className="truncate text-xs text-muted">
                            {item.detail} · {formatDate(item.date)}
                          </p>
                        </div>
                        <span className={`badge shrink-0 ${SEVERITY_STYLES[item.severity]}`}>
                          {item.severity === "overdue" ? (
                            <CircleAlert size={11} />
                          ) : (
                            <ClockAlert size={11} />
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
