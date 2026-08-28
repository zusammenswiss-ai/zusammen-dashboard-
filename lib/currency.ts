import type { CurrencyCode } from "@/lib/supabase/types";

export const CURRENCY_OPTIONS: CurrencyCode[] = ["CHF", "USD", "EUR"];

// Picked to match each currency's home market rather than always using
// one locale — mostly affects thousands/decimal separators and where
// the symbol sits (CHF 1'234.50 vs $1,234.50 vs 1.234,50 €).
const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
  CHF: "de-CH",
  USD: "en-US",
  EUR: "de-DE",
};

/**
 * Formats a number as money. This is a *display* preference, not a real
 * conversion — the app has no exchange-rate source, so switching
 * currency in Beállítások relabels the same stored number (e.g. a
 * product priced "100" reads as CHF 100 or as $100 depending on the
 * setting), it doesn't recompute it. See the Pénznem card's caption on
 * Beállítások.
 */
export function formatMoney(value: number, currency: CurrencyCode = "CHF"): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
