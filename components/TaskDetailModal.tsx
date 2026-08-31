"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { X, Trash2, CalendarDays, User, Tag, Lock, Unlock } from "lucide-react";
import type { Campaign, TaskItem, TaskPriority, TaskStatus, TaskType } from "@/lib/supabase/types";
import { PRIORITY_HU, TASK_TYPES, TASK_TYPE_ICON } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import CampaignFormModal from "@/components/CampaignFormModal";
import BackButton from "@/components/BackButton";

const STATUSES: TaskStatus[] = ["Teendő", "Folyamatban", "Kész"];
const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

/** Full detail/edit view for a single task — opened from a Kanban card or
 * deep-linked from the Overview activity feed via /tasks?open=<id>. */
export default function TaskDetailModal({
  task,
  campaigns,
  onCampaignCreated,
  onClose,
  onSave,
  onDelete,
}: {
  task: TaskItem;
  campaigns: Campaign[];
  onCampaignCreated: (campaign: Campaign) => void;
  onClose: () => void;
  onSave: (patch: Partial<TaskItem>) => void;
  onDelete: () => void;
}) {
  // Opens read-only ("rögzítve") — "Feloldás" switches it to the editable
  // form below, "Rögzítés" saves the patch and re-closes it, so a stray
  // click on the card never edits a task by accident.
  const [locked, setLocked] = useState(true);
  const [draft, setDraft] = useState({
    title: task.title,
    category: task.category ?? "",
    priority: task.priority,
    status: task.status,
    due_date: task.due_date ?? "",
    assignee: task.assignee ?? "",
    notes: task.notes ?? "",
    task_type: task.task_type,
    campaign_id: task.campaign_id ?? "",
  });
  // "+ Új kampány" quick-add reachable from the "Melyik kampányhoz
  // tartozik?" select below — no season prefill here, same as the
  // equivalent quick-add on the main Feladatok "Új feladat" form.
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function unlock() {
    setLocked(false);
  }

  function save() {
    onSave({
      title: draft.title.trim() || task.title,
      category: draft.category.trim() || null,
      priority: draft.priority,
      status: draft.status,
      due_date: draft.due_date || null,
      assignee: draft.assignee.trim() || null,
      notes: draft.notes.trim() || null,
      task_type: draft.task_type,
      campaign_id: draft.task_type === "Kampány" ? draft.campaign_id || null : null,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0 flex-1">
            <BackButton onClick={onClose} label="Vissza a táblához" />
            {locked ? (
              <h2 className="font-serif text-xl text-forest">{draft.title}</h2>
            ) : (
              <input
                className="w-full border-none bg-transparent font-serif text-xl text-forest outline-none"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                aria-label="Feladat címe"
                autoFocus
              />
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {locked ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field icon={Tag} label="Kategória" value={draft.category || "—"} />
                <Field label="Állapot" value={draft.status} />
                <Field label="Prioritás" value={PRIORITY_HU[draft.priority]} />
                <Field label="Típus" value={`${TASK_TYPE_ICON[draft.task_type]}${draft.task_type}`} />
                <Field icon={CalendarDays} label="Határidő" value={formatDate(draft.due_date)} />
                <Field icon={User} label="Felelős" value={draft.assignee || "—"} />
                {draft.task_type === "Kampány" && (draft.campaign_id || task.campaign_label) && (
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-muted">Kampány</label>
                    {draft.campaign_id ? (
                      <Link
                        href={`/marketing?campaign=${draft.campaign_id}`}
                        className="block rounded-md bg-ivory-dim px-3 py-2 text-forest hover:text-bronze hover:underline"
                      >
                        {campaignById.get(draft.campaign_id)?.name ?? "Kampány"}
                      </Link>
                    ) : (
                      <p className="rounded-md bg-ivory-dim px-3 py-2 text-forest">{task.campaign_label}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
                <p className="whitespace-pre-wrap rounded-md bg-ivory-dim px-3 py-2 text-sm text-forest">
                  {draft.notes || <span className="text-muted">Nincs megjegyzés</span>}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
                    <Tag size={12} /> Kategória
                  </label>
                  <input
                    className="input"
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                    placeholder="pl. Gyártás"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Állapot</label>
                  <select
                    className="select"
                    value={draft.status}
                    onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as TaskStatus }))}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Prioritás</label>
                  <select
                    className="select"
                    value={draft.priority}
                    onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as TaskPriority }))}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_HU[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
                    <CalendarDays size={12} /> Határidő
                  </label>
                  <input
                    type="date"
                    className="input"
                    value={draft.due_date}
                    onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
                  <select
                    className="select"
                    value={draft.task_type}
                    onChange={(e) => setDraft((d) => ({ ...d, task_type: e.target.value as TaskType }))}
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
                    <User size={12} /> Felelős
                  </label>
                  <input
                    className="input"
                    value={draft.assignee}
                    onChange={(e) => setDraft((d) => ({ ...d, assignee: e.target.value }))}
                    placeholder="Ki felelős ezért?"
                  />
                </div>
                {draft.task_type === "Kampány" && (
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-muted">Melyik kampányhoz tartozik?</label>
                    <select
                      className="select"
                      value={draft.campaign_id}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setShowCampaignForm(true);
                          return;
                        }
                        setDraft((d) => ({ ...d, campaign_id: e.target.value }));
                      }}
                    >
                      <option value="">Nincs kiválasztva</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      <option value="__new__">+ Új kampány</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
                <textarea
                  className="textarea min-h-32"
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="Részletek, kontextus, linkek, kikkel kell egyeztetni…"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <button onClick={onDelete} className="btn btn-danger" aria-label="Feladat törlése">
            <Trash2 size={15} /> Törlés
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Mégse
            </button>
            {locked ? (
              <button onClick={unlock} className="btn btn-primary">
                <Lock size={15} /> Feloldás
              </button>
            ) : (
              <button onClick={save} className="btn btn-primary">
                <Unlock size={15} /> Rögzítés
              </button>
            )}
          </div>
        </div>
      </div>

      {showCampaignForm && (
        <CampaignFormModal
          onClose={() => setShowCampaignForm(false)}
          onCreated={(c) => {
            onCampaignCreated(c);
            setDraft((d) => ({ ...d, campaign_id: c.id }));
            setShowCampaignForm(false);
          }}
        />
      )}
    </div>
  );
}

/** Read-only label/value pair shown in the locked (rögzítve) view. */
function Field({
  icon: Icon,
  label,
  value,
}: {
  icon?: ComponentType<{ size?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
        {Icon && <Icon size={12} />} {label}
      </label>
      <p className="rounded-md bg-ivory-dim px-3 py-2 text-forest">{value}</p>
    </div>
  );
}
