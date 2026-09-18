"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CurrencyCode, Revenue, VatReturn } from "@/lib/supabase/types";
import { formatMoney } from "@/lib/currency";
import { vatThresholdProgress, VAT_THRESHOLD_CHF } from "@/lib/finance-budget";
import type { ExchangeRates } from "@/lib/exchange-rates";

const QUARTERS = [1, 2, 3, 4];

/**
 * Svájc: CHF 100'000 éves árbevétel felett kötelező a MWST-regisztráció
 * — ez a fül csak egy vizuális küszöb-mérő, nincs automatikus
 * bejelentés. A negyedéves beszedett/fizetett ÁFA mezők (vat_returns)
 * csak akkor jelennek meg, ha vat_registered be van kapcsolva — lásd a
 * komment ott a schema.sql-ben: ez egy előkészített, nem egy
 * ténylegesen bevalláshoz kötött funkció.
 */
export default function VatTab({
  revenue,
  rates,
  vatRegistered,
  vatReturns,
  onVatRegisteredSaved,
  onVatReturnSaved,
}: {
  revenue: Revenue[];
  rates: ExchangeRates | null;
  vatRegistered: boolean;
  vatReturns: VatReturn[];
  onVatRegisteredSaved: (value: boolean) => void;
  onVatReturnSaved: (row: VatReturn) => void;
}) {
  const year = new Date().getFullYear();
  const { totalChf, pct } = vatThresholdProgress(revenue, rates, year);
  const [savingToggle, setSavingToggle] = useState(false);

  async function toggleRegistered() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const next = !vatRegistered;
    setSavingToggle(true);
    const { data } = await supabase
      .from("company_settings")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      await supabase.from("company_settings").update({ vat_registered: next }).eq("id", data.id);
    } else {
      await supabase.from("company_settings").insert({ vat_registered: next });
    }
    setSavingToggle(false);
    onVatRegisteredSaved(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Gauge size={16} className="text-bronze" />
          <h2 className="font-serif text-lg text-forest">MWST-küszöb — {year}</h2>
        </div>
        <p className="mt-1 text-sm text-muted">
          Svájcban CHF {VAT_THRESHOLD_CHF.toLocaleString("de-CH")} éves árbevétel felett kötelező a
          MWST-regisztráció. A Bevételek fülön rögzített tételek alapján, CHF-re átváltva.
        </p>
        <div className="mt-4">
          <div className="h-4 w-full overflow-hidden rounded-full bg-ivory-dim">
            <div
              className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-forest"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-medium text-forest">
            CHF {totalChf.toLocaleString("de-CH", { maximumFractionDigits: 0 })} / CHF{" "}
            {VAT_THRESHOLD_CHF.toLocaleString("de-CH")} ({pct.toFixed(1)}%)
          </p>
          {pct >= 100 && (
            <p className="mt-1 text-xs font-medium text-red-600">
              A küszöböt átlépted — érdemes felvenni a kapcsolatot egy Treuhanddal a MWST-regisztrációhoz.
            </p>
          )}
        </div>
      </div>

      <div className="card p-5">
        <label className="flex items-center gap-2 text-sm font-medium text-forest">
          <input type="checkbox" checked={vatRegistered} disabled={savingToggle} onChange={toggleRegistered} />
          Regisztrálva vagyok MWST-re
        </label>
        <p className="mt-1 text-xs text-muted">
          Ha bekapcsolod, alább negyedévenként rögzítheted a beszedett és fizetett ÁFA-t — ez egy előkészített
          rögzítő felület, nincs mögötte automatikus bevallás vagy határidő-emlékeztető.
        </p>

        {vatRegistered && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 font-medium">Negyedév</th>
                  <th className="px-3 py-2 font-medium">Beszedett ÁFA</th>
                  <th className="px-3 py-2 font-medium">Fizetett ÁFA</th>
                  <th className="px-3 py-2 font-medium">Egyenleg</th>
                </tr>
              </thead>
              <tbody>
                {QUARTERS.map((q) => {
                  const existing = vatReturns.find((r) => r.year === year && r.quarter === q);
                  return (
                    <VatQuarterRow key={q} year={year} quarter={q} existing={existing} onSaved={onVatReturnSaved} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function VatQuarterRow({
  year,
  quarter,
  existing,
  onSaved,
}: {
  year: number;
  quarter: number;
  existing: VatReturn | undefined;
  onSaved: (row: VatReturn) => void;
}) {
  const [collected, setCollected] = useState(existing ? String(existing.collected_amount) : "");
  const [paid, setPaid] = useState(existing ? String(existing.paid_amount) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const collectedAmount = Number(collected) || 0;
    const paidAmount = Number(paid) || 0;
    setSaving(true);
    const { data, error } = await supabase
      .from("vat_returns")
      .upsert(
        {
          id: existing?.id,
          year,
          quarter,
          collected_amount: collectedAmount,
          paid_amount: paidAmount,
          currency: existing?.currency ?? "CHF",
        },
        { onConflict: "year,quarter" }
      )
      .select()
      .single();
    setSaving(false);
    if (!error && data) onSaved(data);
  }

  const balance = (Number(collected) || 0) - (Number(paid) || 0);

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-2 font-medium text-forest">Q{quarter}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          step="0.01"
          className="input w-28 !py-1"
          value={collected}
          onChange={(e) => setCollected(e.target.value)}
          onBlur={save}
        />
      </td>
      <td className="px-3 py-2">
        <input type="number" step="0.01" className="input w-28 !py-1" value={paid} onChange={(e) => setPaid(e.target.value)} onBlur={save} />
      </td>
      <td className={`px-3 py-2 font-medium ${balance < 0 ? "text-red-600" : "text-forest"}`}>
        {formatMoney(balance, (existing?.currency as CurrencyCode | undefined) ?? "CHF")}
        {saving && <span className="ml-1 text-xs font-normal text-muted">mentés…</span>}
      </td>
    </tr>
  );
}
