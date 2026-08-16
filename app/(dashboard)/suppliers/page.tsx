"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, Mail, Users, Search } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Supplier } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";

function bySupplierRecency(a: Supplier, b: Supplier) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

const EMPTY_FORM = { name: "", category: "" };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const loadSuppliers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setSuppliers(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadSuppliers();
  }, [supabase, loadSuppliers]);

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ name: form.name.trim(), category: form.category.trim() || null })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setSuppliers((prev) => [data, ...prev]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function updateSupplier(id: string, patch: Partial<Supplier>) {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    if (!supabase) return;
    const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
    if (error) setError(error.message);
  }

  function deleteSupplier(id: string) {
    if (!supabase) return;
    const removed = suppliers.find((s) => s.id === id);
    if (!removed) return;
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    scheduleUndo(
      `"${removed.name}" törölve.`,
      async () => {
        const { error } = await supabase.from("suppliers").delete().eq("id", id);
        if (error) setError(error.message);
      },
      () => setSuppliers((prev) => [...prev, removed].sort(bySupplierRecency))
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Beszállítók" />
        <EmptyState icon={Users} title="Csatlakoztasd a Supabase-t a beszállítók kezeléséhez" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Beszállítók"
        subtitle="Gyártói és beszállítói kapcsolatok a Zusammen kártyapaklikhoz."
        action={
          <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Beszállító hozzáadása
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {showForm && (
        <form onSubmit={addSupplier} className="card mb-6 flex flex-col gap-3 p-5 animate-fade-in sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Név *</label>
            <input
              className="input"
              required
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="pl. Alpine Print Co."
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
            <input
              className="input"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="pl. Nyomtatás, Csomagolás, Dobozok"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Mentés"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {!loading && suppliers.length > 0 && (
        <div className="relative mb-4 max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Beszállítók keresése…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Még nincs beszállító"
          description="Add hozzá a gyártókat és nyomdákat, akiket a Zusammen indulásához megkeresel."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((supplier) => (
            <SupplierRow
              key={supplier.id}
              supplier={supplier}
              expanded={expanded === supplier.id}
              onToggle={() => setExpanded(expanded === supplier.id ? null : supplier.id)}
              onUpdate={(patch) => updateSupplier(supplier.id, patch)}
              onDelete={() => deleteSupplier(supplier.id)}
            />
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </>
  );
}

function SupplierRow({
  supplier,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  supplier: Supplier;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<Supplier>) => void;
  onDelete: () => void;
}) {
  const [notes, setNotes] = useState(supplier.notes ?? "");
  const [emailText, setEmailText] = useState(supplier.email_text ?? "");

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-3 text-left"
        >
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          <div className="min-w-0">
            <p className="truncate font-medium text-forest">{supplier.name}</p>
            {supplier.category && (
              <span className="badge mt-1 bg-ivory-dim text-walnut">{supplier.category}</span>
            )}
          </div>
        </button>

        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-forest">
          <input
            type="checkbox"
            className="h-4 w-4 accent-bronze"
            checked={supplier.contacted}
            onChange={(e) => onUpdate({ contacted: e.target.checked })}
          />
          Megkeresve
        </label>
        <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-forest">
          <input
            type="checkbox"
            className="h-4 w-4 accent-bronze"
            checked={supplier.reply_received}
            onChange={(e) => onUpdate({ reply_received: e.target.checked })}
          />
          Válaszolt
        </label>

        <button
          onClick={onDelete}
          className="btn btn-danger shrink-0 !px-2"
          aria-label="Beszállító törlése"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-border bg-ivory-dim/40 p-4 animate-fade-in sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Jegyzetek</label>
            <textarea
              className="textarea min-h-24"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (supplier.notes ?? "") && onUpdate({ notes })}
              placeholder="Árazás, minimum rendelési mennyiség, kért minták…"
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted">
              <Mail size={12} /> Csatolt email (opcionális)
            </label>
            <textarea
              className="textarea min-h-24 font-mono text-xs"
              value={emailText}
              onChange={(e) => setEmailText(e.target.value)}
              onBlur={() => emailText !== (supplier.email_text ?? "") && onUpdate({ email_text: emailText })}
              placeholder="Illeszd be ide a releváns email levelezést…"
            />
          </div>
        </div>
      )}
    </div>
  );
}
