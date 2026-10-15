"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, LineChart } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, CampaignKpi, CampaignKpiEntry } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import CollapsibleSection from "@/components/CollapsibleSection";
import { formatDate } from "@/lib/format";

const EMPTY_KPI_FORM = { name: "", unit: "", target: "" };

/** Eredmények fül — KPI-k (cél + jelenlegi érték) és minden egyes KPI
 * saját mérés-előzménye (campaign_kpi_entries), hogy ne csak egy
 * pillanatkép legyen, hanem visszanézhető legyen, hogyan alakult. */
export default function CampaignKpiTab({ campaign }: { campaign: Campaign }) {
  const [kpis, setKpis] = useState<CampaignKpi[]>([]);
  const [entriesByKpi, setEntriesByKpi] = useState<Map<string, CampaignKpiEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_KPI_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("campaign_kpis")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("created_at");
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setKpis(data ?? []);
    if ((data ?? []).length > 0) {
      const { data: entries } = await supabase
        .from("campaign_kpi_entries")
        .select("*")
        .in("kpi_id", (data ?? []).map((k) => k.id))
        .order("entry_date", { ascending: false });
      const grouped = new Map<string, CampaignKpiEntry[]>();
      for (const entry of entries ?? []) {
        const list = grouped.get(entry.kpi_id) ?? [];
        list.push(entry);
        grouped.set(entry.kpi_id, list);
      }
      setEntriesByKpi(grouped);
    }
    setLoading(false);
  }, [campaign.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function addKpi(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    const { error: insertError } = await supabase.from("campaign_kpis").insert({
      campaign_id: campaign.id,
      name: form.name.trim(),
      unit: form.unit.trim() || null,
      target: form.target.trim() ? Number(form.target) : null,
    });
    setSaving(false);
    if (insertError) setError(insertError.message);
    else {
      setForm(EMPTY_KPI_FORM);
      setShowForm(false);
      void load();
    }
  }

  async function deleteKpi(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("campaign_kpis").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else void load();
  }

  async function addEntry(kpi: CampaignKpi, value: number, note: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error: insertError } = await supabase.from("campaign_kpi_entries").insert({ kpi_id: kpi.id, value, note: note || null });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    const { error: updateError } = await supabase.from("campaign_kpis").update({ current_value: value }).eq("id", kpi.id);
    if (updateError) setError(updateError.message);
    void load();
  }

  if (loading) return <Spinner />;

  return (
    <div>
      {error && <ErrorBanner message={error} />}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">A kampány mérhető céljai — minden méréshez előzmény tartozik.</p>
        <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> KPI
        </button>
      </div>

      {showForm && (
        <form onSubmit={addKpi} className="mb-4 flex animate-fade-in flex-wrap items-end gap-2 rounded-md border border-border p-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Mutató neve *</label>
            <input className="input" required autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="pl. Jelentkezők száma" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Mértékegység</label>
            <input className="input w-24" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="fő / %" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Cél</label>
            <input type="number" step="0.01" className="input w-24" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} />
          </div>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Mentés…" : "Hozzáadás"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
            Mégse
          </button>
        </form>
      )}

      {kpis.length === 0 ? (
        <EmptyState icon={LineChart} title="Még nincs KPI felvéve" description='Add hozzá a mérhető célokat, pl. "Jelentkezők száma".' />
      ) : (
        <div className="flex flex-col gap-3">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.id}
              kpi={kpi}
              entries={entriesByKpi.get(kpi.id) ?? []}
              onAddEntry={(value, note) => addEntry(kpi, value, note)}
              onDelete={() => deleteKpi(kpi.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  kpi,
  entries,
  onAddEntry,
  onDelete,
}: {
  kpi: CampaignKpi;
  entries: CampaignKpiEntry[];
  onAddEntry: (value: number, note: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const pct = kpi.target ? Math.min(100, Math.round((kpi.current_value / kpi.target) * 100)) : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    onAddEntry(Number(value), note.trim());
    setValue("");
    setNote("");
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-forest">{kpi.name}</p>
          <p className="mt-0.5 text-sm text-muted">
            {kpi.current_value}
            {kpi.unit ? ` ${kpi.unit}` : ""}
            {kpi.target != null && <span> / {kpi.target} cél</span>}
          </p>
        </div>
        <button onClick={onDelete} className="text-muted/70 hover:text-red-600" title="Törlés">
          <Trash2 size={13} />
        </button>
      </div>
      {pct != null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ivory-dim">
          <div className="h-full bg-bronze" style={{ width: `${pct}%` }} />
        </div>
      )}

      <CollapsibleSection
        title={<span className="text-xs font-medium text-muted">Mérés-előzmény ({entries.length})</span>}
        defaultOpen={false}
        headerClassName="mt-3"
      >
        <form onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Új érték</label>
            <input type="number" step="0.01" className="input w-24 !py-1.5 text-xs" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Megjegyzés</label>
            <input className="input !py-1.5 text-xs" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-bronze !py-1.5 text-xs">
            Mentés
          </button>
        </form>
        {entries.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 rounded-md bg-ivory-dim px-2.5 py-1.5 text-xs">
                <span className="text-forest">
                  {entry.value}
                  {kpi.unit ? ` ${kpi.unit}` : ""}
                  {entry.note && <span className="text-muted"> — {entry.note}</span>}
                </span>
                <span className="shrink-0 text-muted">{formatDate(entry.entry_date)}</span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
