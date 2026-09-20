"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Ruler } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardTemplate, CardTemplateInsert } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import { useUndoAction } from "@/lib/useUndoAction";
import { errorMessage } from "@/lib/errors";
import { formatTemplatePixelDims } from "@/lib/card-template";

function byNameAsc(a: CardTemplate, b: CardTemplate) {
  return a.name.localeCompare(b.name);
}

/** Sablonok — gyártói/méret specifikációk (cut/safe/bleed hüvelykben +
 * DPI), amikből a Kollekció kártyáinak pontos exportméretét számoljuk
 * majd egy későbbi fázisban. Itt csak a CRUD, ugyanaz a minta mint
 * ServiceAccountsSection (add-form + inline edit sor + undo-toast). */
export default function TemplatesSection({
  templates,
  onChange,
}: {
  templates: CardTemplate[];
  onChange: (next: CardTemplate[]) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const sorted = [...templates].sort(byNameAsc);

  function handleDelete(template: CardTemplate) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (editingId === template.id) setEditingId(null);
    onChange(templates.filter((t) => t.id !== template.id));
    scheduleUndo(
      `"${template.name}" sablon törölve.`,
      async () => {
        const { error } = await supabase.from("card_templates").delete().eq("id", template.id);
        if (error) console.error(error.message);
      },
      () => onChange([...templates.filter((t) => t.id !== template.id), template])
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          A gyártói pontos méret-specifikációk — ebből számolódik minden kollekció exportméretének pixelben.
        </p>
        <button
          type="button"
          className="btn btn-bronze shrink-0"
          onClick={() => {
            setEditingId(null);
            setShowForm((v) => !v);
          }}
        >
          <Plus size={16} /> Új sablon
        </button>
      </div>

      {showForm && (
        <TemplateForm
          onCreated={(t) => {
            onChange([...templates, t]);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="Még nincs rögzített sablon"
          description="Add hozzá a gyártód pontos vágott/safe/bleed méretét és DPI-ját, hogy a kollekciók erre tudjanak hivatkozni."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((t) =>
            editingId === t.id ? (
              <TemplateEditRow
                key={t.id}
                template={t}
                onSaved={(saved) => {
                  onChange(templates.map((x) => (x.id === saved.id ? saved : x)));
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <TemplateRow
                key={t.id}
                template={t}
                onEdit={() => {
                  setShowForm(false);
                  setEditingId(t.id);
                }}
                onDelete={() => handleDelete(t)}
              />
            )
          )}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </div>
  );
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: CardTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onEdit}
      className="card flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 hover:border-bronze/40"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-forest">{template.name}</p>
          {template.manufacturer && <span className="badge bg-ivory-dim text-walnut">{template.manufacturer}</span>}
        </div>
        <p className="mt-1 text-xs text-muted">
          Vágott {template.cut_width_in}˝ × {template.cut_height_in}˝ · Safe {template.safe_width_in}˝ ×{" "}
          {template.safe_height_in}˝ · Bleed {template.bleed_width_in}˝ × {template.bleed_height_in}˝
        </p>
        <p className="mt-0.5 text-xs font-medium text-bronze">{formatTemplatePixelDims(template)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
          aria-label="Szerkesztés"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-red-600"
          aria-label="Törlés"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  name: "",
  manufacturer: "",
  cut_width_in: "",
  cut_height_in: "",
  safe_width_in: "",
  safe_height_in: "",
  bleed_width_in: "",
  bleed_height_in: "",
  dpi: "300",
};

function templateFields(
  form: typeof EMPTY_FORM,
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>
) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Sablon neve *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder='pl. "QPMN Skat Size"'
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Gyártó neve</label>
          <input
            className="input"
            value={form.manufacturer}
            onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
            placeholder="pl. QPMN"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Vágott szélesség (˝) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            required
            value={form.cut_width_in}
            onChange={(e) => setForm((f) => ({ ...f, cut_width_in: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Vágott magasság (˝) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            required
            value={form.cut_height_in}
            onChange={(e) => setForm((f) => ({ ...f, cut_height_in: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">DPI</label>
          <input
            type="number"
            min="1"
            className="input"
            value={form.dpi}
            onChange={(e) => setForm((f) => ({ ...f, dpi: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Safe szélesség (˝) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            required
            value={form.safe_width_in}
            onChange={(e) => setForm((f) => ({ ...f, safe_width_in: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Safe magasság (˝) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            required
            value={form.safe_height_in}
            onChange={(e) => setForm((f) => ({ ...f, safe_height_in: e.target.value }))}
          />
        </div>
        <div />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Bleed szélesség (˝) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            required
            value={form.bleed_width_in}
            onChange={(e) => setForm((f) => ({ ...f, bleed_width_in: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Bleed magasság (˝) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            required
            value={form.bleed_height_in}
            onChange={(e) => setForm((f) => ({ ...f, bleed_height_in: e.target.value }))}
          />
        </div>
      </div>
      {form.bleed_width_in && form.bleed_height_in && form.dpi && (
        <p className="text-xs font-medium text-bronze">
          {formatTemplatePixelDims({
            bleed_width_in: Number(form.bleed_width_in) || 0,
            bleed_height_in: Number(form.bleed_height_in) || 0,
            dpi: Number(form.dpi) || 300,
          })}
        </p>
      )}
    </>
  );
}

function buildPayload(form: typeof EMPTY_FORM): CardTemplateInsert | null {
  const nums = {
    cut_width_in: Number(form.cut_width_in),
    cut_height_in: Number(form.cut_height_in),
    safe_width_in: Number(form.safe_width_in),
    safe_height_in: Number(form.safe_height_in),
    bleed_width_in: Number(form.bleed_width_in),
    bleed_height_in: Number(form.bleed_height_in),
    dpi: Number(form.dpi) || 300,
  };
  if (!form.name.trim() || Object.values(nums).some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return { name: form.name.trim(), manufacturer: form.manufacturer.trim() || null, ...nums };
}

function TemplateForm({ onCreated, onCancel }: { onCreated: (t: CardTemplate) => void; onCancel: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const payload = buildPayload(form);
    if (!supabase || !payload) {
      setError("Add meg a sablon nevét és minden méretet (pozitív számként).");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase.from("card_templates").insert(payload).select().single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült menteni a sablont."));
      return;
    }
    if (data) onCreated(data);
  }

  return (
    <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      {templateFields(form, setForm)}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Sablon mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}

function TemplateEditRow({
  template,
  onSaved,
  onCancel,
}: {
  template: CardTemplate;
  onSaved: (t: CardTemplate) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: template.name,
    manufacturer: template.manufacturer ?? "",
    cut_width_in: String(template.cut_width_in),
    cut_height_in: String(template.cut_height_in),
    safe_width_in: String(template.safe_width_in),
    safe_height_in: String(template.safe_height_in),
    bleed_width_in: String(template.bleed_width_in),
    bleed_height_in: String(template.bleed_height_in),
    dpi: String(template.dpi),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const payload = buildPayload(form);
    if (!supabase || !payload) {
      setError("Add meg a sablon nevét és minden méretet (pozitív számként).");
      return;
    }
    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("card_templates")
      .update(payload)
      .eq("id", template.id)
      .select()
      .single();
    setSaving(false);
    if (updateError) {
      setError(errorMessage(updateError, "Nem sikerült menteni a sablont."));
      return;
    }
    if (data) onSaved(data);
  }

  return (
    <form
      onSubmit={save}
      className="animate-fade-in flex flex-col gap-3 rounded-md border border-bronze/40 bg-ivory-dim/40 p-4"
    >
      {templateFields(form, setForm)}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          <Check size={14} /> {saving ? "Mentés…" : "Mentés"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <X size={14} /> Mégse
        </button>
      </div>
    </form>
  );
}
