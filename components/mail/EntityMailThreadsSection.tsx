"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, ExternalLink } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { MailThreadLinkEntityType } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { MAIL_STATUS_LABEL, MAIL_STATUS_STYLE } from "@/lib/mail-ui";

type ThreadSummary = {
  id: string;
  subject: string;
  status: "new" | "in_progress" | "waiting" | "done";
  last_message_at: string | null;
  latest_from: string | null;
  latest_snippet: string | null;
  has_unread: boolean;
};

/**
 * "Levelek" szakasz — a feladat 5/B/b pontjának kétirányúsága: a
 * Postafiókban látott szálak a kapcsolódó egyéb oldalakon (kampány,
 * jelentkező, rendelés, ügyfélszolgálati eset, beszállító) is
 * megjelennek, mail_thread_links alapján. Közvetlenül a böngésző
 * Supabase-kliensével olvas (mail_threads/mail_thread_links/mail_messages
 * mindhárom "authenticated" RLS-sel elérhető), nincs szükség külön API
 * route-ra. `entityIds` több id is lehet (pl. egy kampány összes
 * jelentkezőjének szálai, beágyazva a kampány oldalán).
 */
export default function EntityMailThreadsSection({
  entityType,
  entityIds,
  title = "Levelek",
}: {
  entityType: MailThreadLinkEntityType;
  entityIds: string[];
  title?: string;
}) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  const idsKey = entityIds.join(",");

  const load = useCallback(async () => {
    if (!supabase || entityIds.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: links, error: linksError } = await supabase
        .from("mail_thread_links")
        .select("thread_id")
        .eq("entity_type", entityType)
        .in("entity_id", entityIds);
      if (linksError) throw new Error(linksError.message);

      const threadIds = [...new Set((links ?? []).map((l) => l.thread_id))];
      if (threadIds.length === 0) {
        setThreads([]);
        return;
      }

      const [threadsRes, messagesRes] = await Promise.all([
        supabase.from("mail_threads").select("id, subject, status, last_message_at").in("id", threadIds),
        supabase
          .from("mail_messages")
          .select("thread_id, direction, from_addr, from_name, body_text, received_at, read_at")
          .in("thread_id", threadIds)
          .order("received_at", { ascending: false }),
      ]);
      if (threadsRes.error) throw new Error(threadsRes.error.message);
      if (messagesRes.error) throw new Error(messagesRes.error.message);

      const byThread = new Map<string, (typeof messagesRes.data)[number][]>();
      for (const m of messagesRes.data ?? []) {
        const list = byThread.get(m.thread_id) ?? [];
        list.push(m);
        byThread.set(m.thread_id, list);
      }

      const rows = (threadsRes.data ?? [])
        .map((t): ThreadSummary => {
          const messages = byThread.get(t.id) ?? [];
          const latest = messages[0] ?? null;
          return {
            id: t.id,
            subject: t.subject,
            status: t.status,
            last_message_at: t.last_message_at,
            latest_from: latest?.from_name || latest?.from_addr || null,
            latest_snippet: latest?.body_text?.slice(0, 140) || null,
            has_unread: messages.some((m) => m.direction === "in" && !m.read_at),
          };
        })
        .sort((a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime());
      setThreads(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült betölteni a leveleket.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, entityType, idsKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-2">
      {error && <ErrorBanner message={error} />}
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Mail size={13} className="text-bronze" /> {title}
      </h3>
      {threads.length === 0 ? (
        <EmptyState icon={Mail} title="Nincs kapcsolódó levélszál" description="A Postafiókban kezdett vagy oda beérkezett levelek itt is megjelennek." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/postafiok?thread=${t.id}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-bronze/40"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {t.has_unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-bronze" />}
                  <span className={`truncate ${t.has_unread ? "font-semibold text-forest" : "text-forest"}`}>{t.subject}</span>
                </div>
                <p className="truncate text-xs text-muted">
                  {t.latest_from ? `${t.latest_from} — ` : ""}
                  {t.latest_snippet}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`badge ${MAIL_STATUS_STYLE[t.status]}`}>{MAIL_STATUS_LABEL[t.status]}</span>
                <span className="text-xs text-muted">{t.last_message_at ? formatDate(t.last_message_at) : ""}</span>
                <ExternalLink size={12} className="text-muted" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
