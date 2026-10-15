"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, CampaignPartner, CampaignPartnerChannelType, CampaignPartnerStatus } from "@/lib/supabase/types";
import { CAMPAIGN_PARTNER_CHANNEL_TYPES, CAMPAIGN_PARTNER_STATUSES, CAMPAIGN_PARTNER_STATUS_STYLES } from "@/lib/labels";
import EmptyState from "@/components/EmptyState";
import { Spinner, ErrorBanner } from "@/components/Feedback";

const EMPTY_FORM = { name: "", channel_type: "Egyéb" as CampaignPartnerChannelType, status: "Terv" as CampaignPartnerStatus, contact: "", notes: "" };

/** Partnerek fül — influencerek, helyi partnerek, sajtókapcsolatok egy
 * adott kampányhoz, státusszal (Terv → Megkeresve → Egyeztetés → Kész). */
export default function CampaignPartnersTab({ campaign }: { campaign: Campaign }) {
  const [partners, setPartners] = useState<CampaignPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from("campaign_partners")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setPartners(data ?? []);
    setLoading(false);
  }, [campaign.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    const { error: insertError } = await supabase.from("campaign_partners").insert({
      campaign_id: campaign.id,
      name: form.name.trim(),
      channel_type: form.channel_type,
      status: form.status,
      contact: form.contact.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (insertError) setError(insertError.message);
    else {
      setForm(EMPTY_FORM);
      setShowForm(false);
      void load();
    }
  }

  async function updateStatus(id: string, status: CampaignPartnerStatus) {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error: updateError } = await supabase.from("campaign_partners").update({ status }).eq("id", id);
    if (updateError) setError(updateError.message);
  }

  async function deletePartner(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setPartners((prev) => prev.filter((p) => p.id !== id));
    const { error: deleteError } = await supabase.from("campaign_partners").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
  }

  if (loading) return <Spinner />;

  return (
    <div>
      {error && <ErrorBanner message={error} />}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">Influencerek, helyi partnerek, sajtókapcsolatok ehhez a kampányhoz.</p>
        <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Partner
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Név *</label>
              <input className="input" required autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
              <select className="select" value={form.channel_type} onChange={(e) => setForm((f) => ({ ...f, channel_type: e.target.value as CampaignPartnerChannelType }))}>
                {CAMPAIGN_PARTNER_CHANNEL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Státusz</label>
              <select className="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CampaignPartnerStatus }))}>
                {CAMPAIGN_PARTNER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Kapcsolat (email/telefon)</label>
              <input className="input" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Jegyzet</label>
              <textarea className="textarea min-h-16" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
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

      {partners.length === 0 ? (
        <EmptyState icon={Users} title="Még nincs partner felvéve" description="Adj hozzá egy influencert, helyi partnert vagy sajtókapcsolatot." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {partners.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-forest">{p.name}</span>
                  <span className="badge bg-ivory-dim text-walnut">{p.channel_type}</span>
                </div>
                {p.contact && <p className="mt-0.5 text-xs text-muted">{p.contact}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <select
                  className={`select !w-auto !py-1 text-xs ${CAMPAIGN_PARTNER_STATUS_STYLES[p.status]}`}
                  value={p.status}
                  onChange={(e) => updateStatus(p.id, e.target.value as CampaignPartnerStatus)}
                >
                  {CAMPAIGN_PARTNER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button onClick={() => deletePartner(p.id)} className="text-muted/70 hover:text-red-600" title="Törlés">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
