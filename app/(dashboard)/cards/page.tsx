"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Pencil, History, CreditCard, Radio, QrCode } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ContentCard, CardSnapshot, ContentStatus } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import CollapsibleSection from "@/components/CollapsibleSection";
import ShowMoreButton from "@/components/ShowMoreButton";
import ContentVersionHistoryModal from "@/components/ContentVersionHistoryModal";
import CardFormModal, { type CardFormValues } from "@/components/CardFormModal";
import { useUndoAction } from "@/lib/useUndoAction";
import { useShowMore } from "@/lib/useShowMore";
import { CONTENT_STATUSES, CONTENT_STATUS_HU, CONTENT_STATUS_STYLES } from "@/lib/labels";
import { buildVersionEntry } from "@/lib/content-version";
import { errorMessage } from "@/lib/errors";

function byRecency(a: ContentCard, b: ContentCard) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function snapshotOf(card: ContentCard): CardSnapshot {
  return {
    title: card.title,
    category: card.category,
    question: card.question,
    short_description: card.short_description,
    deep_question: card.deep_question,
    ritual_id: card.ritual_id,
    duration_minutes: card.duration_minutes,
    energy: card.energy,
    depth: card.depth,
    mode: card.mode,
    nfc_id: card.nfc_id,
    qr_url: card.qr_url,
    journey: card.journey,
  };
}

export default function CardsPage() {
  const [cards, setCards] = useState<ContentCard[]>([]);
  const [rituals, setRituals] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<ContentCard | null>(null);
  const [historyCard, setHistoryCard] = useState<ContentCard | null>(null);

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const loadCards = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [cardsRes, ritualsRes] = await Promise.all([
      supabase.from("cards").select("*").order("card_number", { ascending: false }),
      supabase.from("rituals").select("id, name").order("name"),
    ]);
    if (cardsRes.error) setError(cardsRes.error.message);
    else setCards(cardsRes.data ?? []);
    if (!ritualsRes.error) setRituals(ritualsRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadCards();
  }, [supabase, loadCards]);

  const ritualNameById = useMemo(() => new Map(rituals.map((r) => [r.id, r.name])), [rituals]);

  async function saveCard(values: CardFormValues) {
    if (!supabase) return;
    const newSnapshot: CardSnapshot = {
      title: values.title,
      category: values.category || null,
      question: values.question || null,
      short_description: values.short_description || null,
      deep_question: values.deep_question || null,
      ritual_id: values.ritual_id || null,
      duration_minutes: values.duration_minutes ? Number(values.duration_minutes) : null,
      energy: values.energy || null,
      depth: values.depth || null,
      mode: values.mode || null,
      nfc_id: values.nfc_id || null,
      qr_url: values.qr_url || null,
      journey: values.journey || null,
    };

    if (editingCard) {
      const oldSnapshot = snapshotOf(editingCard);
      const contentChanged = JSON.stringify(oldSnapshot) !== JSON.stringify(newSnapshot);
      const statusChanged = editingCard.status !== values.status;
      let history = editingCard.version_history;
      if (contentChanged) {
        history = [...history, buildVersionEntry(editingCard.version, editingCard.status, oldSnapshot)];
      } else if (statusChanged) {
        history = [...history, buildVersionEntry(editingCard.version, editingCard.status, null)];
      }
      const { data, error } = await supabase
        .from("cards")
        .update({ ...newSnapshot, status: values.status, version: values.version, version_history: history })
        .eq("id", editingCard.id)
        .select()
        .single();
      if (error) throw error;
      if (data) setCards((prev) => prev.map((c) => (c.id === data.id ? data : c)));
    } else {
      const { data, error } = await supabase
        .from("cards")
        .insert({ ...newSnapshot, status: values.status, version: values.version })
        .select()
        .single();
      if (error) throw error;
      if (data) setCards((prev) => [data, ...prev]);
    }
    setShowForm(false);
    setEditingCard(null);
  }

  async function updateStatus(card: ContentCard, newStatus: ContentStatus) {
    if (!supabase || newStatus === card.status) return;
    const history = [...card.version_history, buildVersionEntry(card.version, card.status, null)];
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, status: newStatus, version_history: history } : c))
    );
    const { error } = await supabase
      .from("cards")
      .update({ status: newStatus, version_history: history })
      .eq("id", card.id);
    if (error) setError(errorMessage(error, "Nem sikerült frissíteni az állapotot."));
  }

  function deleteCard(card: ContentCard) {
    if (!supabase) return;
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    scheduleUndo(
      `"${card.title}" törölve.`,
      async () => {
        const { error } = await supabase.from("cards").delete().eq("id", card.id);
        if (error) setError(error.message);
      },
      () => setCards((prev) => [...prev, card].sort(byRecency))
    );
  }

  const groups = CONTENT_STATUSES.map((status) => ({
    status,
    items: cards.filter((c) => c.status === status),
  })).filter((g) => g.items.length > 0);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Kártyák" />
        <EmptyState icon={CreditCard} title="Csatlakoztasd a Supabase-t a kártyák kezeléséhez" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Kártyák"
        subtitle="Kártya-tartalmak: kérdések, rituálék, NFC/QR adatok — verziózva."
        action={
          <button
            className="btn btn-bronze"
            onClick={() => {
              setEditingCard(null);
              setShowForm(true);
            }}
          >
            <Plus size={16} /> Új kártya
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Még nincs kártya"
          description="Hozd létre az első kártya-tartalmat — kérdés, mély kérdés, és opcionálisan egy hozzá kötött rituálé."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ status, items }) => (
            <CardStatusGroup
              key={status}
              status={status}
              items={items}
              ritualNameById={ritualNameById}
              onEdit={(c) => {
                setEditingCard(c);
                setShowForm(true);
              }}
              onDelete={deleteCard}
              onUpdateStatus={updateStatus}
              onShowHistory={setHistoryCard}
            />
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}

      {showForm && (
        <CardFormModal
          card={editingCard}
          rituals={rituals}
          onSave={saveCard}
          onClose={() => {
            setShowForm(false);
            setEditingCard(null);
          }}
        />
      )}

      {historyCard && (
        <ContentVersionHistoryModal
          title={`Előzmények — #${String(historyCard.card_number).padStart(2, "0")} ${historyCard.title}`}
          entries={historyCard.version_history}
          onClose={() => setHistoryCard(null)}
          renderSnapshot={(snap: CardSnapshot) => (
            <div className="flex flex-col gap-0.5">
              <p className="text-forest">{snap.title}</p>
              {snap.question && <p>Kérdés: {snap.question}</p>}
              {snap.category && <p>Kategória: {snap.category}</p>}
              {snap.ritual_id && ritualNameById.get(snap.ritual_id) && (
                <p>Rituálé: {ritualNameById.get(snap.ritual_id)}</p>
              )}
            </div>
          )}
        />
      )}
    </>
  );
}

function CardStatusGroup({
  status,
  items,
  ritualNameById,
  onEdit,
  onDelete,
  onUpdateStatus,
  onShowHistory,
}: {
  status: ContentStatus;
  items: ContentCard[];
  ritualNameById: Map<string, string>;
  onEdit: (card: ContentCard) => void;
  onDelete: (card: ContentCard) => void;
  onUpdateStatus: (card: ContentCard, status: ContentStatus) => void;
  onShowHistory: (card: ContentCard) => void;
}) {
  const { visible, hiddenCount, showAll, setShowAll } = useShowMore(items, 8);
  return (
    <div>
      <CollapsibleSection
        title={<h2 className="font-serif text-lg text-forest">{CONTENT_STATUS_HU[status]}</h2>}
        right={<span className="badge bg-ivory-dim text-walnut">{items.length}</span>}
        storageKey={`zusammen-collapsed-cards-status-${status}`}
        headerClassName="mb-3"
      >
        <div className="flex flex-col gap-3">
          {visible.map((card) => (
            <div key={card.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-ivory-dim text-walnut">#{String(card.card_number).padStart(2, "0")}</span>
                  <p className="font-medium text-forest">{card.title}</p>
                  {card.category && <span className="badge bg-ivory-dim text-walnut">{card.category}</span>}
                  <span className="badge bg-bronze/10 text-walnut">{card.version}</span>
                  {card.nfc_id && (
                    <span className="badge bg-forest-light/15 text-forest" title={`NFC ID: ${card.nfc_id}`}>
                      <Radio size={10} className="mr-0.5 inline" /> NFC
                    </span>
                  )}
                  {card.qr_url && (
                    <span className="badge bg-forest-light/15 text-forest" title={card.qr_url}>
                      <QrCode size={10} className="mr-0.5 inline" /> QR
                    </span>
                  )}
                </div>
                {card.question && <p className="mt-1 line-clamp-2 text-sm text-muted">{card.question}</p>}
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                  {card.ritual_id && ritualNameById.get(card.ritual_id) && (
                    <Link href="/rituals" className="hover:underline">
                      Rituálé: {ritualNameById.get(card.ritual_id)}
                    </Link>
                  )}
                  {card.energy && <span>Energia: {card.energy}</span>}
                  {card.depth && <span>Mélység: {card.depth}</span>}
                  {card.mode && <span>Mód: {card.mode}</span>}
                </p>
                {card.version_history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onShowHistory(card)}
                    className="mt-1 flex items-center gap-1 text-[11px] text-muted underline decoration-dotted hover:text-forest"
                  >
                    <History size={11} /> Előzmények ({card.version_history.length})
                  </button>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  className={`select w-auto text-xs ${CONTENT_STATUS_STYLES[card.status]}`}
                  value={card.status}
                  onChange={(e) => onUpdateStatus(card, e.target.value as ContentStatus)}
                >
                  {CONTENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {CONTENT_STATUS_HU[s]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => onEdit(card)}
                  className="btn btn-ghost !px-2"
                  aria-label="Szerkesztés"
                  title="Szerkesztés"
                >
                  <Pencil size={15} />
                </button>
                <button onClick={() => onDelete(card)} className="btn btn-danger !px-2" aria-label="Törlés">
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
