"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet, Link2, X, ArrowRight } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, Expense } from "@/lib/supabase/types";
import { formatCHF } from "@/lib/format";
import { formatDate } from "@/lib/format";
import EmptyState from "@/components/EmptyState";

/** Költségek fül — csak olvasásra mutatja a kampányhoz rendelt kiadásokat
 * (expenses.campaign_id), a tervezett kerettel összevetve. A tényleges
 * könyvelés továbbra is a Pénzügyek modulban történik — ez a fül nem
 * duplikálja azt, csak szűrve mutatja, plusz egy gyors "hozzárendelés"
 * lehetőséget ad már felvett, de még kampányhoz nem kötött kiadásokhoz. */
export default function CampaignCostsTab({ campaign, expenses }: { campaign: Campaign; expenses: Expense[] }) {
  const [picking, setPicking] = useState(false);
  const [unassigned, setUnassigned] = useState<Expense[] | null>(null);
  const [list, setList] = useState(expenses);

  const total = list.reduce((sum, e) => sum + e.amount, 0);

  async function openPicker() {
    setPicking(true);
    if (unassigned) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .is("campaign_id", null)
      .order("expense_date", { ascending: false })
      .limit(30);
    setUnassigned(data ?? []);
  }

  async function assign(expense: Expense) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error } = await supabase.from("expenses").update({ campaign_id: campaign.id }).eq("id", expense.id);
    if (!error) {
      setList((prev) => [expense, ...prev]);
      setUnassigned((prev) => (prev ?? []).filter((e) => e.id !== expense.id));
      setPicking(false);
    }
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs font-medium text-muted">Tervezett büdzsé</p>
          <p className="mt-1 font-serif text-xl text-forest">{campaign.budget_planned != null ? formatCHF(campaign.budget_planned) : "—"}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-muted">Hozzárendelt kiadások összesen</p>
          <p className="mt-1 font-serif text-xl text-forest">{formatCHF(total)}</p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <Link href="/finance" className="flex items-center gap-1 text-xs font-medium text-bronze hover:underline">
          Új kiadás felvétele a Pénzügyekben <ArrowRight size={12} />
        </Link>
        <button className="btn btn-ghost !px-3 !py-1.5 text-xs" onClick={openPicker}>
          <Link2 size={14} /> Meglévő kiadás hozzárendelése
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={Wallet} title="Még nincs kiadás hozzárendelve" description="Vedd fel a Pénzügyekben, majd rendeld ide, vagy rendelj hozzá egy meglévőt." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-forest">{e.description}</p>
                <p className="text-xs text-muted">{e.category}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs text-muted">{formatDate(e.expense_date)}</span>
                <span className="font-medium text-forest">{formatCHF(e.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]" onClick={() => setPicking(false)}>
          <div className="animate-fade-in card flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-serif text-lg text-forest">Kiadás hozzárendelése</h3>
              <button onClick={() => setPicking(false)} className="rounded-md p-1.5 text-muted hover:bg-ivory-dim" aria-label="Bezárás">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {unassigned === null ? (
                <p className="p-3 text-xs text-muted">Betöltés…</p>
              ) : unassigned.length === 0 ? (
                <p className="p-3 text-xs text-muted">Nincs szabad (más kampányhoz nem rendelt) kiadás.</p>
              ) : (
                unassigned.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => assign(e)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-ivory-dim"
                  >
                    <span className="truncate">{e.description}</span>
                    <span className="shrink-0 text-xs text-muted">{formatCHF(e.amount)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
