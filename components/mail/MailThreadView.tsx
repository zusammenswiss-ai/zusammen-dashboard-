"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Paperclip,
  Image as ImageIcon,
  Send,
  Loader2,
  StickyNote,
  ListTodo,
  Download,
  Tag,
  Check,
} from "lucide-react";
import type { MailMessage, MailNote, MailThread, MailThreadLink, MailLabel, MailArea, MailTemplate, MailThreadStatus, MailThreadPriority } from "@/lib/supabase/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { MAIL_STATUS_LABEL, MAIL_PRIORITY_LABEL, MAIL_ENTITY_TYPE_LABEL } from "@/lib/mail-ui";
import { fillMailTemplate } from "@/lib/mail-template-vars";
import QuickTaskModal from "@/components/QuickTaskModal";

type ThreadDetail = {
  thread: MailThread;
  messages: MailMessage[];
  notes: MailNote[];
  activity: { id: string; actor: string | null; action: string; detail: Record<string, unknown>; created_at: string }[];
  links: MailThreadLink[];
  labels: MailLabel[];
};

export default function MailThreadView({ threadId, onBack, onChanged }: { threadId: string; onBack: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<MailArea[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mail/threads/${threadId}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Nem sikerült betölteni a szálat.");
      setDetail(data);
      await fetch(`/api/mail/threads/${threadId}/read`, { method: "POST" });
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült betölteni a szálat."));
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase.from("mail_areas").select("*").order("sort_order");
      setAreas(data ?? []);
    })();
  }, [supabase]);

  async function patchThread(patch: { status?: MailThreadStatus; priority?: MailThreadPriority; area?: string }) {
    const res = await fetch(`/api/mail/threads/${threadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (data.ok) {
      await load();
      onChanged();
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorBanner message={error} />;
  if (!detail) return null;

  const { thread, messages, notes, links } = detail;

  return (
    <div className="flex w-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <button type="button" onClick={onBack} className="rounded-md p-1.5 text-muted hover:bg-ivory-dim sm:hidden">
          <ArrowLeft size={16} />
        </button>
        <h3 className="min-w-0 flex-1 truncate font-serif text-base text-forest">{thread.subject}</h3>
        <button type="button" onClick={() => setShowTaskModal(true)} className="btn btn-ghost shrink-0 !px-2.5 !py-1 text-xs">
          <ListTodo size={13} /> Feladat
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-ivory-dim/30 p-2 text-xs">
        <select className="select !h-7 !py-0 text-xs" value={thread.area} onChange={(e) => void patchThread({ area: e.target.value })}>
          {areas.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
        <select
          className="select !h-7 !py-0 text-xs"
          value={thread.status}
          onChange={(e) => void patchThread({ status: e.target.value as MailThreadStatus })}
        >
          {(Object.keys(MAIL_STATUS_LABEL) as MailThreadStatus[]).map((s) => (
            <option key={s} value={s}>
              {MAIL_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          className="select !h-7 !py-0 text-xs"
          value={thread.priority}
          onChange={(e) => void patchThread({ priority: e.target.value as MailThreadPriority })}
        >
          {(Object.keys(MAIL_PRIORITY_LABEL) as MailThreadPriority[]).map((p) => (
            <option key={p} value={p}>
              {MAIL_PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        {links.map((l) => (
          <span key={l.id} className="badge bg-forest-light/15 text-forest">
            {MAIL_ENTITY_TYPE_LABEL[l.entity_type] || l.entity_type}
          </span>
        ))}
        <LabelPicker threadId={threadId} currentLabels={detail.labels} onChanged={load} />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>

        {notes.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
            {notes.map((n) => (
              <div key={n.id} className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-900">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-[10px] text-amber-700">
                  {n.author || "Névtelen"} — {formatDate(n.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReplyAndNoteComposer
        threadId={threadId}
        area={thread.area}
        templateVars={{ firstName: [...messages].reverse().find((m) => m.direction === "in")?.from_name ?? null, subject: thread.subject }}
        onSent={load}
      />

      {showTaskModal && (
        <QuickTaskModal
          heading={`Feladat — ${thread.subject}`}
          defaultTitle={`Válasz: ${thread.subject}`}
          extraFields={{ mail_thread_id: threadId, category: "Marketing", task_type: "Kampány" }}
          onClose={() => setShowTaskModal(false)}
          onCreated={() => {
            setShowTaskModal(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: MailMessage }) {
  const [showImages, setShowImages] = useState(false);
  const isOut = message.direction === "out";

  const html = message.body_html_sanitized;
  const srcDoc = html
    ? `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${
        showImages ? "* data: cid:" : "data: cid:"
      }; style-src 'unsafe-inline'; font-src data:;"><base target="_blank"></head><body style="margin:0;padding:12px;font-family:-apple-system,sans-serif;font-size:14px;color:#233328;">${html}</body></html>`
    : null;

  return (
    <div className={`rounded-xl border p-3 ${isOut ? "border-bronze/30 bg-bronze/5" : "border-border bg-white"}`}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-xs">
        <span className="font-medium text-forest">
          {isOut ? "Te" : message.from_name || message.from_addr || "(ismeretlen)"}
          <span className="ml-1.5 font-normal text-muted">{isOut ? `→ ${message.to_addrs?.join(", ")}` : `<${message.from_addr}>`}</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          {message.sent_via && <span className="badge bg-ivory-dim text-walnut">{message.sent_via}</span>}
          {formatDate(message.received_at ?? message.created_at)}
        </span>
      </div>
      {srcDoc ? (
        <div className="overflow-hidden rounded-md border border-border">
          <iframe title="Levél tartalma" srcDoc={srcDoc} className="h-56 w-full bg-white" sandbox="" />
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-walnut">{message.body_text}</p>
      )}
      {html && !showImages && (
        <button type="button" onClick={() => setShowImages(true)} className="mt-1.5 flex items-center gap-1 text-[11px] text-bronze hover:underline">
          <ImageIcon size={12} /> Képek betöltése
        </button>
      )}
      {message.has_attachments && message.attachments_meta.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
          {message.attachments_meta.map((a) => (
            <a
              key={a.partId}
              href={`/api/mail/attachments/${message.id}?part=${encodeURIComponent(a.partId)}`}
              className="flex items-center gap-1 rounded-md bg-ivory-dim px-2 py-1 text-[11px] text-walnut hover:bg-ivory-dim/70"
            >
              <Paperclip size={11} /> {a.name} <Download size={10} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function LabelPicker({ threadId, currentLabels, onChanged }: { threadId: string; currentLabels: MailLabel[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [allLabels, setAllLabels] = useState<MailLabel[]>([]);
  const supabase = getSupabaseClient();

  async function loadAll() {
    const res = await fetch("/api/mail/labels");
    const data = await res.json();
    if (data.ok) setAllLabels(data.labels);
  }

  async function toggle(labelId: string, active: boolean) {
    if (!supabase) return;
    if (active) await supabase.from("mail_thread_labels").delete().eq("thread_id", threadId).eq("label_id", labelId);
    else await supabase.from("mail_thread_labels").upsert({ thread_id: threadId, label_id: labelId });
    onChanged();
  }

  return (
    <div className="relative">
      {currentLabels.map((l) => (
        <span key={l.id} className="badge mr-1 text-white" style={{ backgroundColor: l.color }}>
          {l.name}
        </span>
      ))}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void loadAll();
        }}
        className="btn btn-ghost !px-1.5 !py-0.5 text-xs"
      >
        <Tag size={11} /> Címke
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-border bg-white p-1.5 shadow-lg">
          {allLabels.length === 0 && <p className="p-2 text-[11px] text-muted">Nincs még címke a Postafiók → Címkék fülön.</p>}
          {allLabels.map((l) => {
            const active = currentLabels.some((c) => c.id === l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => void toggle(l.id, active)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs hover:bg-ivory-dim"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                {l.name}
                {active && <Check size={11} className="ml-auto text-forest" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReplyAndNoteComposer({
  threadId,
  area,
  templateVars,
  onSent,
}: {
  threadId: string;
  area: string;
  templateVars: { firstName: string | null; subject: string };
  onSent: () => void;
}) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);

  useEffect(() => {
    fetch("/api/mail/templates")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setTemplates(data.templates.filter((t: MailTemplate) => !t.area || t.area === area));
      })
      .catch(() => {});
  }, [area]);

  function insertTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (t) setBody((prev) => (prev ? `${prev}\n\n${fillMailTemplate(t.body, templateVars)}` : fillMailTemplate(t.body, templateVars)));
  }

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      if (mode === "reply") {
        const html = body
          .split(/\n{2,}/)
          .map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br/>")}</p>`)
          .join("");
        const res = await fetch(`/api/mail/threads/${threadId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Nem sikerült elküldeni.");
      } else {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("Supabase nincs konfigurálva.");
        const { error: insertError } = await supabase.from("mail_notes").insert({ thread_id: threadId, body });
        if (insertError) throw new Error(insertError.message);
      }
      setBody("");
      onSent();
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült elküldeni."));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setMode("reply")} className={`btn !py-1 text-xs ${mode === "reply" ? "btn-bronze" : "btn-ghost"}`}>
          <Send size={12} /> Válasz
        </button>
        <button type="button" onClick={() => setMode("note")} className={`btn !py-1 text-xs ${mode === "note" ? "btn-bronze" : "btn-ghost"}`}>
          <StickyNote size={12} /> Belső jegyzet
        </button>
        {mode === "reply" && templates.length > 0 && (
          <select
            className="select !h-7 ml-auto !py-0 text-xs"
            value=""
            onChange={(e) => {
              if (e.target.value) insertTemplate(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Sablon beszúrása…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <textarea
        className="textarea min-h-20 text-sm"
        placeholder={mode === "reply" ? "Válasz szövege… (bekezdések üres sorral elválasztva)" : "Belső jegyzet — nem megy ki a címzettnek…"}
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={() => void send()} disabled={sending || !body.trim()} className="btn btn-primary !py-1.5 text-xs">
          {sending ? <Loader2 size={13} className="animate-spin" /> : mode === "reply" ? <Send size={13} /> : <StickyNote size={13} />}
          {mode === "reply" ? "Küldés" : "Mentés"}
        </button>
      </div>
    </div>
  );
}
