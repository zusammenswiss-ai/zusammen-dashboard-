// Live currency conversion for Pénzügyek/Áttekintés — see
// app/api/finance/exchange-rates for where the rates actually come
// from. This replaces the old "just flag the mismatch, never convert"
// behavior everywhere it's wired in; formatMoney (lib/currency.ts)
// stays purely a *display* formatter, unaware of conversion — this
// module is what turns "100 USD" into "a real number of CHF" before
// anything gets summed.
import type { CurrencyCode } from "@/lib/supabase/types";

// "1 CHF equals this many units of X" — CHF is always the pivot.
export type ExchangeRates = Record<CurrencyCode, number>;

export type ExchangeRatesResult = { ok: true; rates: ExchangeRates; date: string } | { ok: false; error: string };

/**
 * Fetches live rates from our own /api/finance/exchange-rates route.
 * Callers (Pénzügyek, Áttekintés) call this once per page load and pass
 * the result's `rates` (or null on failure) into convertAmount below —
 * a failed fetch degrades to "no conversion" everywhere, not a broken page.
 */
export async function fetchExchangeRates(): Promise<ExchangeRatesResult> {
  try {
    const res = await fetch("/api/finance/exchange-rates");
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error ?? "Nem sikerült lekérni az árfolyamokat." };
    return { ok: true, rates: data.ratesFromCHF, date: data.date };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Hálózati hiba az árfolyamok lekérésekor." };
  }
}

/**
 * Converts an amount between two currencies via the CHF pivot. Returns
 * the amount unconverted if `rates` is null (fetch failed/not loaded
 * yet) or `from === to` — callers summing mixed-currency values should
 * treat a null `rates` the same way the old ⚠ mismatch badge did
 * (flag it), rather than silently trusting an unconverted sum.
 */
export function convertAmount(amount: number, from: CurrencyCode, to: CurrencyCode, rates: ExchangeRates | null): number {
  if (from === to || !rates) return amount;
  const amountInCHF = from === "CHF" ? amount : amount / rates[from];
  return to === "CHF" ? amountInCHF : amountInCHF * rates[to];
}
