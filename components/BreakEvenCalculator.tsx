"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import type { Product, CurrencyCode } from "@/lib/supabase/types";
import { convertAmount, type ExchangeRates } from "@/lib/exchange-rates";
import { breakEvenUnits } from "@/lib/finance";
import { formatMoney } from "@/lib/currency";

/**
 * Havi fix költség ÷ egységnyi árrés — how many units of one product
 * need to sell every month to cover the currently-recurring Kiadások.
 * Per-product (not a blended average across the whole catalog) since a
 * founder picking a specific product to price/plan around is a much
 * more actionable question than one averaged number across everything
 * from a Jövőbeli terv idea to a live SKU.
 */
export default function BreakEvenCalculator({
  products,
  fixedMonthlyCost,
  currency,
  rates,
}: {
  products: Product[];
  fixedMonthlyCost: number;
  currency: CurrencyCode;
  rates: ExchangeRates | null;
}) {
  const eligible = products.filter((p) => p.sale_price != null);
  const [productId, setProductId] = useState<string>(eligible[0]?.id ?? "");
  const product = eligible.find((p) => p.id === productId) ?? eligible[0] ?? null;

  const marginPerUnit = product
    ? convertAmount(product.sale_price ?? 0, product.sale_price_currency, currency, rates) -
      convertAmount(product.cogs ?? 0, (product.cogs_currency as CurrencyCode | null) ?? "CHF", currency, rates)
    : 0;
  const units = product ? breakEvenUnits(fixedMonthlyCost, marginPerUnit) : null;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <Target size={16} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Fedezeti pont</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        Havi fix költség (a Kiadások közül az ismétlődő tételek) ÷ egységnyi árrés — hány darabot kell eladni
        havonta a nullszaldóhoz.
      </p>

      {eligible.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Adj meg legalább egy terméket eladási árral a Termékek fülön.</p>
      ) : (
        <>
          <div className="mt-4 max-w-xs">
            <label className="mb-1 block text-xs font-medium text-muted">Termék</label>
            <select className="select" value={product?.id ?? ""} onChange={(e) => setProductId(e.target.value)}>
              {eligible.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Havi fix költség" value={formatMoney(fixedMonthlyCost, currency)} />
            <Stat label="Árrés / darab" value={formatMoney(marginPerUnit, currency)} />
            <Stat
              label="Fedezeti pont"
              value={units != null ? `${Math.ceil(units)} db / hó` : "—"}
              warn={units == null}
            />
          </div>
          {units == null && (
            <p className="mt-2 text-xs text-yellow-700">
              ⚠ A kiválasztott termék árrése nulla vagy negatív ezen az áron — így sosincs fedezeti pont, az
              ártól vagy önköltségtől függetlenül a darabszámtól.
            </p>
          )}
          {fixedMonthlyCost === 0 && (
            <p className="mt-2 text-xs text-muted">
              Még nincs ismétlődőnek jelölt Kiadás rögzítve — a fedezeti pont addig 0-ról indul. Rögzítsd a
              rendszeres költségeket lent.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-serif text-xl ${warn ? "text-yellow-700" : "text-forest"}`}>{value}</p>
    </div>
  );
}
