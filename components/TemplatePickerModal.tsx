"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, TaskItem, TaskTemplate, TaskType } from "@/lib/supabase/types";
import { PRIORITY_HU, TEMPLATE_CATEGORY_ORDER, TASK_TYPES, groupByCategory } from "@/lib/labels";

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-forest/10 text-forest",
  Medium: "bg-bronze/15 text-walnut",
  High: "bg-red-100 text-red-700",
};

/** Checkbox picker over the task_templates set — ticking any number of
 * them and confirming creates one Teendő task per pick, in one bulk
 * insert. Grouped by category, same order as the Sablonok kezelése view. */
export default function TemplatePickerModal({
  templates,
  campaigns,
  onClose,
  onAdded,
}: {
  templates: TaskTemplate[];
  campaigns: Campaign[];
  onClose: () => void;
  onAdded: (tasks: TaskItem[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Applies to every task created in this one batch — see the Típus
  // dimension on the Feladatok board (lib/labels.ts). No quick-add here
  // (unlike the single-task forms) — kept simpler by design, the founder
  // creates the kampány first on the Marketing oldal or a single task.
  const [taskType, setTaskType] = useState<TaskType>("Egyszeri");
  const [campaignId, setCampaignId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = groupByCategory(templates, TEMPLATE_CATEGORY_ORDER);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelected() {
    const supabase = getSupabaseClient();
    if (!supabase || selected.size === 0) return;
    setSaving(true);
    setError(null);
    const inserts = templates
      .filter((t) => selected.has(t.id))
      .map((t) => ({
        title: t.title,
        category: t.category,
        priority: t.default_priority,
        status: "Teendő" as const,
        assignee: t.default_assignee,
        notes: t.notes_template,
        task_type: taskType,
        campaign_id: taskType === "Kampány" ? campaignId || null : null,
      }));
    const { data, error: insertError } = await supabase.from("tasks").insert(inserts).select();
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onAdded(data ?? []);
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
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="font-serif text-xl text-forest">Sablonból hozzáadás</h2>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {templates.length === 0 ? (
            <p className="text-sm text-muted">
              Még nincs egy sablon sem. Hozz létre egyet a &quot;Sablonok kezelése&quot; nézetben.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Egy Típus vonatkozik az egész kötegre — ha egyszerre több
                  sablont pipálsz ki, mindegyik ugyanazt a Típust kapja. */}
              <div className="flex flex-wrap items-end gap-2 border-b border-border pb-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
                  <select
                    className="select !py-1.5 text-xs"
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as TaskType)}
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                {taskType === "Kampány" && (
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-muted">Melyik kampányhoz tartozik?</label>
                    <select
                      className="select !py-1.5 text-xs"
                      value={campaignId}
                      onChange={(e) => setCampaignId(e.target.value)}
                    >
                      <option value="">Nincs kiválasztva</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {groups.map(({ category, items }) => (
                <div key={category}>
                  <h3 className="mb-2 font-serif text-sm text-forest">{category}</h3>
                  <div className="flex flex-col gap-1.5">
                    {items.map((t) => (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-ivory-dim"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(t.id)}
                          onChange={() => toggle(t.id)}
                        />
                        <span className="flex-1 text-sm text-forest">{t.title}</span>
                        <span className={`badge ${PRIORITY_STYLES[t.default_priority]}`}>
                          {PRIORITY_HU[t.default_priority]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <span className="text-xs text-muted">{selected.size} kiválasztva</span>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={onClose}>
              Mégse
            </button>
            <button
              className="btn btn-primary"
              disabled={selected.size === 0 || saving}
              onClick={addSelected}
            >
              {saving ? "Hozzáadás…" : "Kiválasztottak hozzáadása"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
