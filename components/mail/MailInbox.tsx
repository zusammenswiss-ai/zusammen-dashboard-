"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox as InboxIcon, Mail, CircleDot, Clock3, Plus, ChevronLeft } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { MailArea } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { MAIL_STATUS_STYLE, MAIL_STATUS_LABEL } from "@/lib/mail-ui";
import MailThreadView from "./MailThreadView";
import MailComposeModal from "./MailComposeModal";

type View = { key: string; label: string; kind: "area" | "special" };

type ThreadRow = {
  id: string;
  subject: string;
  area: string;
  status: "new" | "in_progress" | "waiting" | "done";
  priority: "low" | "normal" | "urgent";
  last_message_at: string | null;
  latest_from: string | null;
  latest_snippet: string | null;
  has_unread: boolean;
  signup_id: string | null;
  links: { entity_type: string; entity_id: string }[];
};

/**
 * Postaláda — a Postafiók oldal "Postaláda" fülének tartalma. Három
 * panel (nézetek / szállista / szálnézet), mobilon (feladat 4. pont:
 * "Mobilon egy oszlopos nézet") egyszerre csak egy panel látszik,
 * "vissza" gombbal lépkedve — ugyanaz a drill-down minta, mint a
 * Dashboard több más mobilra optimalizált nézetén.
 */
export default function MailInbox({ initialThreadId = null }: { initialThreadId?: string | null }) {
  const [areas, setAreas] = useState<MailArea[]>([]);
  const [view, setView] = useState<View>({ key: "all", label: "Összes", kind: "special" });
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [mobilePane, setMobilePane] = useState<"views" | "list" | "detail">("list");

  const supabase = getSupabaseClient();

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.from("mail_areas").select("*").order("sort_order");
      setAreas(data ?? []);
    })();
  }, [supabase]);

  const views: View[] = useMemo(
    () => [
      { key: "all", label: "Összes", kind: "special" },
      { key: "unread", label: "Olvasatlan", kind: "special" },
      { key: "waiting", label: "Válaszra vár", kind: "special" },
      ...areas.map((a): View => ({ key: a.key, label: a.label, kind: "area" })),
    ],
    [areas]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (view.kind === "area") params.set("area", view.key);
      if (view.key === "unread") params.set("unread", "true");
      if (view.key === "waiting") params.set("status", "waiting");
      const res = await fetch(`/api/mail/threads?${params.toString()}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült betölteni a leveleket.");
      setThreads(data.threads);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült betölteni a leveleket."));
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // "Levelek" szakaszokból érkező deep link (/postafiok?thread=<id>) —
  // lásd app/(dashboard)/postafiok/page.tsx.
  useEffect(() => {
    if (!initialThreadId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedThreadId(initialThreadId);
    setMobilePane("detail");
  }, [initialThreadId]);

  function openThread(id: string) {
    setSelectedThreadId(id);
    setMobilePane("detail");
  }

  function backToList() {
    setSelectedThreadId(null);
    setMobilePane("list");
  }

  return (
    <div className="card flex h-[calc(100vh-220px)] min-h-[480px] overflow-hidden p-0">
      {/* Nézetek */}
      <div className={`w-48 shrink-0 overflow-y-auto border-r border-border bg-ivory-dim/30 p-2 sm:block ${mobilePane === "views" ? "block w-full" : "hidden"}`}>
        <button type="button" onClick={() => setShowCompose(true)} className="btn btn-bronze mb-2 w-full !py-1.5 text-xs">
          <Plus size={14} /> Új levél
        </button>
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => {
              setView(v);
              setMobilePane("list");
            }}
            className={`mb-0.5 flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs ${
              view.key === v.key ? "bg-bronze/10 font-medium text-bronze" : "text-walnut hover:bg-ivory-dim"
            }`}
          >
            {v.key === "unread" ? <CircleDot size={12} /> : v.key === "waiting" ? <Clock3 size={12} /> : <Mail size={12} />}
            {v.label}
          </button>
        ))}
      </div>

      {/* Szállista */}
      <div className={`flex w-full flex-col overflow-hidden sm:flex sm:w-80 sm:shrink-0 sm:border-r sm:border-border ${mobilePane === "list" ? "flex" : "hidden"}`}>
        <div className="flex items-center gap-2 border-b border-border p-2 sm:hidden">
          <button type="button" onClick={() => setMobilePane("views")} className="rounded-md p-1.5 text-muted hover:bg-ivory-dim">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-forest">{view.label}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {error && <ErrorBanner message={error} />}
          {loading ? (
            <Spinner />
          ) : threads.length === 0 ? (
            <EmptyState icon={InboxIcon} title="Nincs levél ebben a nézetben" />
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`block w-full border-b border-border px-3 py-2.5 text-left hover:bg-ivory-dim/50 ${
                  selectedThreadId === t.id ? "bg-ivory-dim" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${t.has_unread ? "font-semibold text-forest" : "text-walnut"}`}>
                    {t.latest_from || "(ismeretlen feladó)"}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted">{t.last_message_at ? formatDate(t.last_message_at) : ""}</span>
                </div>
                <p className={`truncate text-sm ${t.has_unread ? "font-medium text-forest" : "text-muted"}`}>{t.subject}</p>
                <p className="truncate text-xs text-muted">{t.latest_snippet}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className={`badge ${MAIL_STATUS_STYLE[t.status]}`}>{MAIL_STATUS_LABEL[t.status]}</span>
                  {!t.signup_id && t.links.length === 0 && <span className="badge bg-red-50 text-red-600">Ismeretlen feladó</span>}
                  {t.has_unread && <span className="h-1.5 w-1.5 rounded-full bg-bronze" />}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Szálnézet */}
      <div className={`flex-1 overflow-hidden sm:flex ${mobilePane === "detail" ? "flex" : "hidden"}`}>
        {selectedThreadId ? (
          <MailThreadView threadId={selectedThreadId} onBack={backToList} onChanged={load} />
        ) : (
          <div className="hidden w-full items-center justify-center sm:flex">
            <EmptyState icon={Mail} title="Válassz egy levelet a listából" />
          </div>
        )}
      </div>

      {showCompose && (
        <MailComposeModal
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            void load();
          }}
        />
      )}
    </div>
  );
}
