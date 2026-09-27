"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Headset } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { SupportTicket, SupportTicketInsert } from "@/lib/supabase/types";
import {
  SUPPORT_CHANNELS,
  SUPPORT_TOPICS,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_STATUS_STYLES,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_STYLES,
} from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import SearchBar from "@/components/SearchBar";
import StickyFormActions from "@/components/StickyFormActions";
import ShowMoreButton from "@/components/ShowMoreButton";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { useShowMore } from "@/lib/useShowMore";
import { errorMessage } from "@/lib/errors";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  customer_name: "",
  contact: "",
  channel: SUPPORT_CHANNELS[0],
  topic: SUPPORT_TOPICS[0],
  related_order: "",
  status: SUPPORT_TICKET_STATUSES[0],
  priority: SUPPORT_PRIORITIES[1],
  received_at: todayIso(),
  notes: "",
};

type FormState = typeof EMPTY_FORM;

function formToInsert(form: FormState): SupportTicketInsert {
  return {
    customer_name: form.customer_name.trim(),
    contact: form.contact.trim() || null,
    channel: form.channel,
    topic: form.topic,
    related_order: form.related_order.trim() || null,
    status: form.status,
    priority: form.priority,
    received_at: form.received_at || todayIso(),
    notes: form.notes.trim() || null,
  };
}

function byReceivedDesc(a: SupportTicket, b: SupportTicket) {
  return b.received_at.localeCompare(a.received_at);
}

/**
 * Megkeresések — az Ügyfélszolgálat modul fő listája. Szándékosan
 * önálló, kézi nyilvántartás (lásd supabase/schema.sql support_tickets
 * kommentjét): nincs email-fiók összekapcsolás, nincs kapcsolat a
 * Feladatok/Kanban modullal, a "Kapcsolódó rendelés" is csak szabad
 * szöveg, nem valódi hivatkozás a Megrendelésekre.
 */
export default function TicketsSection() {
  const supabase = getSupabaseClient();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Mind");
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from("support_tickets").select("*");
    if (loadError) setError(errorMessage(loadError, "Nem sikerült betölteni a megkereséseket."));
    setTickets(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...tickets]
      .filter((t) => statusFilter === "Mind" || t.status === statusFilter)
      .filter(
        (t) =>
          !q ||
          t.customer_name.toLowerCase().includes(q) ||
          (t.contact ?? "").toLowerCase().includes(q) ||
          (t.related_order ?? "").toLowerCase().includes(q)
      )
      .sort(byReceivedDesc);
  }, [tickets, search, statusFilter]);

  const { visible, hasMore, hiddenCount, showAll, setShowAll } = useShowMore(filtered, 10);

  function handleDelete(ticket: SupportTicket) {
    if (!supabase) return;
    if (editingId === ticket.id) setEditingId(null);
    setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
    scheduleUndo(
      `"${ticket.customer_name}" megkeresése törölve.`,
      async () => {
        const { error: deleteError } = await supabase.from("support_tickets").delete().eq("id", ticket.id);
        if (deleteError) console.error(deleteError.message);
      },
      () => setTickets((prev) => [...prev, ticket])
    );
  }

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-4">
      {error && <ErrorBanner message={error} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Keresés név, elérhetőség, rendelés szerint…" />
          <select className="select w-auto text-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="Mind">Minden állapot</option>
            {SUPPORT_TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-bronze !px-3 !py-1.5 text-xs"
          onClick={() => {
            setEditingId(null);
            setShowForm((v) => !v);
          }}
        >
          <Plus size={14} /> Új megkeresés
        </button>
      </div>

      {showForm && (
        <TicketForm
          onSaved={(t) => {
            setTickets((prev) => [...prev, t]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Headset}
          title={tickets.length === 0 ? "Még nincs rögzített megkeresés" : "Nincs a szűrésnek megfelelő megkeresés"}
          description={
            tickets.length === 0
              ? "Rögzítsd az ügyfelektől érkező kérdéseket, panaszokat, dicséreteket — email, Instagram, WhatsApp, bármi."
              : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((t) =>
            editingId === t.id ? (
              <TicketEditRow
                key={t.id}
                ticket={t}
                onSaved={(saved) => {
                  setTickets((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <TicketRow
                key={t.id}
                ticket={t}
                onEdit={() => {
                  setShowForm(false);
                  setEditingId(t.id);
                }}
                onDelete={() => handleDelete(t)}
              />
            )
          )}
          {(hasMore || showAll) && (
            <ShowMoreButton hiddenCount={hiddenCount} showAll={showAll} onToggle={() => setShowAll((v) => !v)} />
          )}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </div>
  );
}

function TicketRow({ ticket, onEdit, onDelete }: { ticket: SupportTicket; onEdit: () => void; onDelete: () => void }) {
  return (
    <div
      onClick={onEdit}
      className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:border-bronze/40"
    >
      <div className="min-w-0">
        <span className="font-medium text-forest">{ticket.customer_name}</span>
        {ticket.contact && <span className="ml-1.5 text-xs text-muted">{ticket.contact}</span>}
        {ticket.notes && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{ticket.notes}</p>}
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="badge bg-ivory-dim text-walnut">{ticket.channel}</span>
          <span className="badge bg-ivory-dim text-walnut">{ticket.topic}</span>
          <span className={`badge ${SUPPORT_TICKET_STATUS_STYLES[ticket.status]}`}>{ticket.status}</span>
          <span className={`badge ${SUPPORT_PRIORITY_STYLES[ticket.priority]}`}>{ticket.priority}</span>
          {ticket.related_order && <span className="badge bg-ivory-dim text-walnut">Rendelés: {ticket.related_order}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-xs text-muted">{formatDate(ticket.received_at)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-muted/70 hover:text-forest"
          title="Szerkesztés"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-muted/70 hover:text-red-600"
          title="Törlés"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function TicketFields({ form, setForm }: { form: FormState; setForm: (updater: (f: FormState) => FormState) => void }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Ügyfél neve *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.customer_name}
            onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
            placeholder="pl. Kovács Anna"
          />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Kapcsolat (email/telefon)</label>
          <input
            className="input"
            value={form.contact}
            onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
            placeholder="pl. anna@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Csatorna</label>
          <select className="select" value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as FormState["channel"] }))}>
            {SUPPORT_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Téma</label>
          <select className="select" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value as FormState["topic"] }))}>
            {SUPPORT_TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Állapot</label>
          <select className="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))}>
            {SUPPORT_TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Prioritás</label>
          <select className="select" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as FormState["priority"] }))}>
            {SUPPORT_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Beérkezés dátuma</label>
          <input
            type="date"
            className="input"
            value={form.received_at}
            onChange={(e) => setForm((f) => ({ ...f, received_at: e.target.value }))}
          />
        </div>
        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted">Kapcsolódó rendelés</label>
          <input
            className="input"
            value={form.related_order}
            onChange={(e) => setForm((f) => ({ ...f, related_order: e.target.value }))}
            placeholder="pl. #1042 vagy szabad szöveg"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Jegyzet</label>
        <textarea
          className="textarea min-h-20"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Mi történt, mit válaszoltunk, mire kell figyelni…"
        />
      </div>
    </>
  );
}

function TicketForm({ onSaved, onCancel }: { onSaved: (t: SupportTicket) => void; onCancel: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.customer_name.trim()) {
      setError("Adj meg egy ügyfélnevet.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("support_tickets")
      .insert(formToInsert(form))
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült menteni a megkeresést."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form onSubmit={submit} className="mb-1 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <TicketFields form={form} setForm={setForm} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <StickyFormActions>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Megkeresés mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </StickyFormActions>
    </form>
  );
}

function TicketEditRow({
  ticket,
  onSaved,
  onCancel,
}: {
  ticket: SupportTicket;
  onSaved: (t: SupportTicket) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    customer_name: ticket.customer_name,
    contact: ticket.contact ?? "",
    channel: ticket.channel,
    topic: ticket.topic,
    related_order: ticket.related_order ?? "",
    status: ticket.status,
    priority: ticket.priority,
    received_at: ticket.received_at,
    notes: ticket.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.customer_name.trim()) {
      setError("Adj meg egy ügyfélnevet.");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("support_tickets")
      .update(formToInsert(form))
      .eq("id", ticket.id)
      .select()
      .single();
    setSaving(false);
    if (updateError) {
      setError(errorMessage(updateError, "Nem sikerült menteni a megkeresést."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form onSubmit={save} className="animate-fade-in flex flex-col gap-3 rounded-md border border-bronze/40 bg-ivory-dim/40 p-4">
      <TicketFields form={form} setForm={setForm} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <StickyFormActions>
        <button type="submit" disabled={saving} className="btn btn-primary">
          <Check size={14} /> {saving ? "Mentés…" : "Mentés"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <X size={14} /> Mégse
        </button>
      </StickyFormActions>
    </form>
  );
}
