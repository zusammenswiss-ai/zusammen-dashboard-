"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Trash2, FileDown, FileUp, Plus, X, ListPlus, ArrowRight } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CurrencyCode, Protocol, ProtocolActionItem, ProtocolInsert, ProtocolUpdate } from "@/lib/supabase/types";
import type { ExchangeRates } from "@/lib/exchange-rates";
import { computeCurrentWeekSnapshot, STATS_ROW_LABELS, type WeeklyStatsSnapshot } from "@/lib/weekly-stats";
import { extractDocxText } from "@/lib/docx-import";
import { downloadProtocolPdf } from "@/lib/protocol-pdf";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/currency";
import BackButton from "@/components/BackButton";
import { Spinner } from "@/components/Feedback";
import { errorMessage } from "@/lib/errors";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isSnapshot(value: Record<string, unknown>): value is WeeklyStatsSnapshot {
  return typeof value.computedAt === "string";
}

type ImportTarget = "topics" | "decisions" | "risks" | "next_focus";
const IMPORT_TARGET_LABELS: Record<ImportTarget, string> = {
  topics: "Megbeszélt témák",
  decisions: "Döntések",
  risks: "Kockázatok / figyelmeztetések",
  next_focus: "Következő heti fókusz",
};

export default function ProtocolDetailModal({
  protocol,
  isFounder,
  currency,
  rates,
  onSaved,
  onDeleted,
  onClose,
}: {
  protocol: Protocol | null;
  isFounder: boolean;
  currency: CurrencyCode;
  rates: ExchangeRates | null;
  onSaved: (p: Protocol) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState<Protocol | null>(protocol);
  const [entryDate, setEntryDate] = useState(protocol?.entry_date ?? todayIso());
  const [topics, setTopics] = useState(protocol?.topics ?? "");
  const [decisions, setDecisions] = useState(protocol?.decisions ?? "");
  const [risks, setRisks] = useState(protocol?.risks ?? "");
  const [nextFocus, setNextFocus] = useState(protocol?.next_focus ?? "");
  const [actionItems, setActionItems] = useState<ProtocolActionItem[]>(
    protocol?.action_items ?? []
  );
  const [newSnapshot, setNewSnapshot] = useState<WeeklyStatsSnapshot | null>(null);
  const [capturingSnapshot, setCapturingSnapshot] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [createdTask, setCreatedTask] = useState<{ id: string; title: string } | null>(null);
  const [importTarget, setImportTarget] = useState<ImportTarget>("topics");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNew = current === null;

  async function captureSnapshot() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setCapturingSnapshot(true);
    setError(null);
    try {
      setNewSnapshot(await computeCurrentWeekSnapshot(supabase, currency, rates));
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült lekérni a heti statisztikát."));
    } finally {
      setCapturingSnapshot(false);
    }
  }

  useEffect(() => {
    // Új bejegyzés — a kérés szerint a "Pillanatkép mentése" automatikusan
    // megtörténik a form megnyitásakor, de a gomb (lentebb) újra
    // lenyomható a mentés előtt, ha frissebb számokat szeretne.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isNew) void captureSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setActionItemText(index: number, text: string) {
    setActionItems((prev) => prev.map((item, i) => (i === index ? { ...item, text } : item)));
  }
  function setActionItemRef(index: number, task_ref: string) {
    setActionItems((prev) => prev.map((item, i) => (i === index ? { ...item, task_ref: task_ref || null } : item)));
  }
  function removeActionItem(index: number) {
    setActionItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImport(file: File) {
    setImporting(true);
    setImportError(null);
    try {
      const text = await extractDocxText(file);
      const append = (current: string) => (current.trim() ? `${current}\n\n${text}` : text);
      if (importTarget === "topics") setTopics(append(topics));
      if (importTarget === "decisions") setDecisions(append(decisions));
      if (importTarget === "risks") setRisks(append(risks));
      if (importTarget === "next_focus") setNextFocus(append(nextFocus));
    } catch (err) {
      setImportError(errorMessage(err, "Nem sikerült beolvasni a Word fájlt."));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const cleanActionItems = actionItems.filter((item) => item.text.trim());
    const basePayload: ProtocolUpdate = {
      entry_date: entryDate,
      topics: topics.trim() || null,
      decisions: decisions.trim() || null,
      risks: risks.trim() || null,
      action_items: cleanActionItems,
      next_focus: nextFocus.trim() || null,
    };
    if (current) {
      const { data, error: updateError } = await supabase
        .from("protocols")
        .update(basePayload)
        .eq("id", current.id)
        .select()
        .single();
      setSaving(false);
      if (updateError) {
        setError(errorMessage(updateError, "Nem sikerült menteni a jegyzőkönyvet."));
        return;
      }
      if (data) {
        setCurrent(data);
        onSaved(data);
      }
    } else {
      const insertPayload: ProtocolInsert = { ...basePayload, stats_snapshot: newSnapshot ?? {} };
      const { data, error: insertError } = await supabase
        .from("protocols")
        .insert(insertPayload)
        .select()
        .single();
      setSaving(false);
      if (insertError) {
        setError(errorMessage(insertError, "Nem sikerült létrehozni a jegyzőkönyvet."));
        return;
      }
      if (data) {
        setCurrent(data);
        onSaved(data);
      }
    }
  }

  async function handleDelete() {
    if (!current) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (!window.confirm("Biztosan törlöd ezt a jegyzőkönyv-bejegyzést? Ez nem vonható vissza.")) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("protocols").delete().eq("id", current.id);
    setDeleting(false);
    if (deleteError) {
      setError(errorMessage(deleteError, "Nem sikerült törölni a bejegyzést."));
      return;
    }
    onDeleted(current.id);
    onClose();
  }

  async function handleCreateTask() {
    if (!current || !nextFocus.trim()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setCreatingTask(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({
        title: `Következő heti fókusz — ${formatDate(current.entry_date)}`,
        category: "Jegyzőkönyv",
        status: "Teendő",
        notes: nextFocus.trim(),
        protocol_id: current.id,
      })
      .select()
      .single();
    setCreatingTask(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült létrehozni a feladatot."));
      return;
    }
    if (data) setCreatedTask({ id: data.id, title: data.title });
  }

  const snapshot: Record<string, unknown> = current ? current.stats_snapshot : (newSnapshot ?? {});
  const disabled = !isFounder;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-2xl flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6">
          <BackButton onClick={onClose} label="Vissza a listához" />

          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-serif text-xl text-forest">{isNew ? "Új jegyzőkönyv" : formatDate(current!.entry_date)}</h2>
            <div className="flex shrink-0 items-center gap-2">
              {current && (
                <button type="button" onClick={() => downloadProtocolPdf(current)} className="btn btn-ghost !px-3 !py-1.5 text-xs">
                  <FileDown size={14} /> Exportálás PDF-be
                </button>
              )}
              {current && isFounder && (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="btn btn-ghost !px-3 !py-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} /> {deleting ? "Törlés…" : "Törlés"}
                </button>
              )}
            </div>
          </div>

          {!isFounder && (
            <p className="mt-2 rounded-lg bg-ivory-dim px-3 py-2 text-xs text-muted">
              Csak megtekintési jogosultságod van — a szerkesztés/törlés a Founder szereppel rendelkező felhasználónak
              van fenntartva.
            </p>
          )}

          <form onSubmit={handleSave} className="mt-4 flex flex-col gap-4">
            <div className="w-fit">
              <label className="mb-1 block text-xs font-medium text-muted">Dátum</label>
              <input
                type="date"
                className="input"
                value={entryDate}
                disabled={disabled}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-serif text-base text-forest">Heti statisztika pillanatkép</p>
                {isNew && (
                  <button
                    type="button"
                    onClick={() => void captureSnapshot()}
                    disabled={capturingSnapshot}
                    className="btn btn-ghost !px-3 !py-1.5 text-xs"
                  >
                    <Camera size={13} /> {capturingSnapshot ? "Rögzítés…" : "Pillanatkép mentése"}
                  </button>
                )}
              </div>
              {capturingSnapshot ? (
                <Spinner />
              ) : isSnapshot(snapshot) ? (
                <>
                  <div className="flex flex-col divide-y divide-border text-sm">
                    {STATS_ROW_LABELS.map(({ key, label }) => {
                      const raw = snapshot[key];
                      const isMoney = key === "revenueTotal" || key === "expenseTotal";
                      const value = isMoney ? formatMoney(raw, snapshot.currency) : raw;
                      return (
                        <div key={key} className="flex items-center justify-between py-1.5">
                          <span className="text-forest">{label}</span>
                          <span className="font-medium text-walnut">{value}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-muted">
                    Rögzítve: {formatDate(snapshot.computedAt)} — ez a pillanatkép utólag nem módosítható.
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted">Nincs még pillanatkép rögzítve ehhez a bejegyzéshez.</p>
              )}
            </div>

            {isFounder && (
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-ivory-dim/40 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    <FileUp size={12} className="mb-0.5 inline" /> Word beillesztése — cél mező
                  </label>
                  <select
                    className="select w-auto text-xs"
                    value={importTarget}
                    onChange={(e) => setImportTarget(e.target.value as ImportTarget)}
                  >
                    {(Object.keys(IMPORT_TARGET_LABELS) as ImportTarget[]).map((key) => (
                      <option key={key} value={key}>
                        {IMPORT_TARGET_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="btn btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
                  {importing ? "Beolvasás…" : "Word fájl kiválasztása (.docx)"}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx"
                    className="hidden"
                    disabled={importing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImport(file);
                    }}
                  />
                </label>
                {importError && <p className="text-xs text-red-600">{importError}</p>}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Megbeszélt témák</label>
              <textarea className="textarea min-h-24" disabled={disabled} value={topics} onChange={(e) => setTopics(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Döntések (soronként egy pont)</label>
              <textarea className="textarea min-h-24" disabled={disabled} value={decisions} onChange={(e) => setDecisions(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Kockázatok / figyelmeztetések</label>
              <textarea className="textarea min-h-20" disabled={disabled} value={risks} onChange={(e) => setRisks(e.target.value)} />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-medium text-muted">Akciópontok</label>
                {isFounder && (
                  <button
                    type="button"
                    onClick={() => setActionItems((prev) => [...prev, { text: "", task_ref: null }])}
                    className="flex items-center gap-1 text-xs font-medium text-bronze hover:underline"
                  >
                    <Plus size={12} /> Sor hozzáadása
                  </button>
                )}
              </div>
              {actionItems.length === 0 ? (
                <p className="text-xs text-muted">Nincs még akciópont.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {actionItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="input flex-1"
                        placeholder="Akciópont…"
                        disabled={disabled}
                        value={item.text}
                        onChange={(e) => setActionItemText(i, e.target.value)}
                      />
                      <input
                        className="input w-40 shrink-0 text-xs"
                        placeholder="Hivatkozás (opcionális)"
                        disabled={disabled}
                        value={item.task_ref ?? ""}
                        onChange={(e) => setActionItemRef(i, e.target.value)}
                      />
                      {isFounder && (
                        <button type="button" onClick={() => removeActionItem(i)} className="shrink-0 text-muted/70 hover:text-red-600">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Következő heti fókusz</label>
              <textarea
                className="textarea min-h-20"
                disabled={disabled}
                value={nextFocus}
                onChange={(e) => setNextFocus(e.target.value)}
              />
              {current && nextFocus.trim() && (
                <div className="mt-1.5">
                  {createdTask ? (
                    <Link
                      href={`/tasks?open=${createdTask.id}`}
                      className="flex w-fit items-center gap-1 text-xs text-muted underline decoration-dotted hover:text-forest"
                    >
                      🗒 {createdTask.title} <ArrowRight size={10} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleCreateTask()}
                      disabled={creatingTask}
                      className="flex items-center gap-1 text-xs font-medium text-bronze hover:underline"
                    >
                      <ListPlus size={13} /> {creatingTask ? "Létrehozás…" : "Feladat létrehozása ebből"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            {isFounder && (
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? "Mentés…" : isNew ? "Jegyzőkönyv létrehozása" : "Mentés"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Bezárás
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
