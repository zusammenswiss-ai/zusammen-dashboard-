"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, History, Sparkles, Search } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Ritual, RitualSnapshot, ContentStatus } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import CollapsibleSection from "@/components/CollapsibleSection";
import ShowMoreButton from "@/components/ShowMoreButton";
import SearchBar from "@/components/SearchBar";
import ContentVersionHistoryModal from "@/components/ContentVersionHistoryModal";
import RitualFormModal, { type RitualFormValues } from "@/components/RitualFormModal";
import { useUndoAction } from "@/lib/useUndoAction";
import { useShowMore } from "@/lib/useShowMore";
import { CONTENT_STATUSES, CONTENT_STATUS_HU, CONTENT_STATUS_STYLES } from "@/lib/labels";
import { buildVersionEntry } from "@/lib/content-version";
import { errorMessage } from "@/lib/errors";

function byRecency(a: Ritual, b: Ritual) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function snapshotOf(ritual: Ritual): RitualSnapshot {
  return {
    name: ritual.name,
    category: ritual.category,
    duration_minutes: ritual.duration_minutes,
    steps: ritual.steps,
  };
}

export default function RitualsSection() {
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRitual, setEditingRitual] = useState<Ritual | null>(null);
  const [historyRitual, setHistoryRitual] = useState<Ritual | null>(null);
  const [query, setQuery] = useState("");

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const loadRituals = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from("rituals").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRituals(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadRituals();
  }, [supabase, loadRituals]);

  async function saveRitual(values: RitualFormValues) {
    if (!supabase) return;
    const newSnapshot: RitualSnapshot = {
      name: values.name,
      category: values.category || null,
      duration_minutes: values.duration_minutes ? Number(values.duration_minutes) : null,
      steps: values.steps,
    };

    if (editingRitual) {
      const oldSnapshot = snapshotOf(editingRitual);
      const contentChanged = JSON.stringify(oldSnapshot) !== JSON.stringify(newSnapshot);
      const statusChanged = editingRitual.status !== values.status;
      let history = editingRitual.version_history;
      if (contentChanged) {
        history = [...history, buildVersionEntry(editingRitual.version, editingRitual.status, oldSnapshot)];
      } else if (statusChanged) {
        history = [...history, buildVersionEntry(editingRitual.version, editingRitual.status, null)];
      }
      const { data, error } = await supabase
        .from("rituals")
        .update({ ...newSnapshot, status: values.status, version: values.version, version_history: history })
        .eq("id", editingRitual.id)
        .select()
        .single();
      if (error) throw error;
      if (data) setRituals((prev) => prev.map((r) => (r.id === data.id ? data : r)));
    } else {
      const { data, error } = await supabase
        .from("rituals")
        .insert({ ...newSnapshot, status: values.status, version: values.version })
        .select()
        .single();
      if (error) throw error;
      if (data) setRituals((prev) => [data, ...prev]);
    }
    setShowForm(false);
    setEditingRitual(null);
  }

  async function updateStatus(ritual: Ritual, newStatus: ContentStatus) {
    if (!supabase || newStatus === ritual.status) return;
    const history = [...ritual.version_history, buildVersionEntry(ritual.version, ritual.status, null)];
    setRituals((prev) =>
      prev.map((r) => (r.id === ritual.id ? { ...r, status: newStatus, version_history: history } : r))
    );
    const { error } = await supabase
      .from("rituals")
      .update({ status: newStatus, version_history: history })
      .eq("id", ritual.id);
    if (error) setError(errorMessage(error, "Nem sikerült frissíteni az állapotot."));
  }

  function deleteRitual(ritual: Ritual) {
    if (!supabase) return;
    setRituals((prev) => prev.filter((r) => r.id !== ritual.id));
    scheduleUndo(
      `"${ritual.name}" törölve.`,
      async () => {
        const { error } = await supabase.from("rituals").delete().eq("id", ritual.id);
        if (error) setError(error.message);
      },
      () => setRituals((prev) => [...prev, ritual].sort(byRecency))
    );
  }

  const filteredRituals = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rituals;
    return rituals.filter((r) => r.name.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q));
  }, [rituals, query]);

  const groups = CONTENT_STATUSES.map((status) => ({
    status,
    items: filteredRituals.filter((r) => r.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        {!loading && rituals.length > 0 ? (
          <SearchBar value={query} onChange={setQuery} placeholder="Rituálék keresése…" className="relative w-full max-w-xs" />
        ) : (
          <div />
        )}
        <button
          className="btn btn-bronze shrink-0"
          onClick={() => {
            setEditingRitual(null);
            setShowForm(true);
          }}
        >
          <Plus size={16} /> Új rituálé
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : rituals.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Még nincs rituálé"
          description="Építs egy lépésről lépésre haladó rituálét, amit aztán kártyákhoz köthetsz."
        />
      ) : filteredRituals.length === 0 ? (
        <EmptyState icon={Search} title="Nincs találat" description="Próbálj más keresőszót." />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ status, items }) => (
            <RitualStatusGroup
              key={status}
              status={status}
              items={items}
              onEdit={(r) => {
                setEditingRitual(r);
                setShowForm(true);
              }}
              onDelete={deleteRitual}
              onUpdateStatus={updateStatus}
              onShowHistory={setHistoryRitual}
            />
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}

      {showForm && (
        <RitualFormModal
          ritual={editingRitual}
          onSave={saveRitual}
          onClose={() => {
            setShowForm(false);
            setEditingRitual(null);
          }}
        />
      )}

      {historyRitual && (
        <ContentVersionHistoryModal
          title={`Előzmények — ${historyRitual.name}`}
          entries={historyRitual.version_history}
          onClose={() => setHistoryRitual(null)}
          renderSnapshot={(snap: RitualSnapshot) => (
            <div className="flex flex-col gap-0.5">
              <p className="text-forest">{snap.name}</p>
              {snap.category && <p>Kategória: {snap.category}</p>}
              {snap.duration_minutes != null && <p>{snap.duration_minutes} perc</p>}
              <p>{snap.steps.length} lépés</p>
            </div>
          )}
        />
      )}
    </div>
  );
}

function RitualStatusGroup({
  status,
  items,
  onEdit,
  onDelete,
  onUpdateStatus,
  onShowHistory,
}: {
  status: ContentStatus;
  items: Ritual[];
  onEdit: (ritual: Ritual) => void;
  onDelete: (ritual: Ritual) => void;
  onUpdateStatus: (ritual: Ritual, status: ContentStatus) => void;
  onShowHistory: (ritual: Ritual) => void;
}) {
  const { visible, hiddenCount, showAll, setShowAll } = useShowMore(items, 8);
  return (
    <div>
      <CollapsibleSection
        title={<h2 className="font-serif text-lg text-forest">{CONTENT_STATUS_HU[status]}</h2>}
        right={<span className="badge bg-ivory-dim text-walnut">{items.length}</span>}
        storageKey={`zusammen-collapsed-rituals-status-${status}`}
        headerClassName="mb-3"
      >
        <div className="flex flex-col gap-3">
          {visible.map((ritual) => (
            <div key={ritual.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-forest">{ritual.name}</p>
                  {ritual.category && <span className="badge bg-ivory-dim text-walnut">{ritual.category}</span>}
                  <span className="badge bg-bronze/10 text-walnut">{ritual.version}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {ritual.steps.length} lépés
                  {ritual.duration_minutes != null && ` · ${ritual.duration_minutes} perc`}
                </p>
                {ritual.version_history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onShowHistory(ritual)}
                    className="mt-1 flex items-center gap-1 text-[11px] text-muted underline decoration-dotted hover:text-forest"
                  >
                    <History size={11} /> Előzmények ({ritual.version_history.length})
                  </button>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  className={`select w-auto text-xs ${CONTENT_STATUS_STYLES[ritual.status]}`}
                  value={ritual.status}
                  onChange={(e) => onUpdateStatus(ritual, e.target.value as ContentStatus)}
                >
                  {CONTENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {CONTENT_STATUS_HU[s]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => onEdit(ritual)}
                  className="btn btn-ghost !px-2"
                  aria-label="Szerkesztés"
                  title="Szerkesztés"
                >
                  <Pencil size={15} />
                </button>
                <button onClick={() => onDelete(ritual)} className="btn btn-danger !px-2" aria-label="Törlés">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {items.length > 8 && (
          <ShowMoreButton hiddenCount={hiddenCount} showAll={showAll} onToggle={() => setShowAll((v) => !v)} />
        )}
      </CollapsibleSection>
    </div>
  );
}
