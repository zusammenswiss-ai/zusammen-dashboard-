// Shared Gold Card Letters date logic — the fixed quarterly schedule used
// by both the Személyes rituálé countdown (GoldCardLettersSection) and
// the Naptár (calendar), which marks each due date as its own event.

// First round is fixed to 2026-09-01, then every 3 months after that —
// per spec, independent of how many letters have actually been uploaded.
export const GOLD_CARD_ANCHOR = new Date(2026, 8, 1); // month is 0-indexed: 8 = September

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function nextGoldCardDate(today: Date): Date {
  let next = startOfDay(GOLD_CARD_ANCHOR);
  const t = startOfDay(today);
  while (next.getTime() < t.getTime()) {
    next = new Date(next.getFullYear(), next.getMonth() + 3, next.getDate());
  }
  return next;
}

export function daysUntil(date: Date, today: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000);
}

/**
 * Every quarterly due date that falls within [rangeStart, rangeEnd]
 * (inclusive), for the Naptár's "esedékes" markers. Since the anchor is
 * the very first round, this naturally yields nothing for a range
 * entirely before 2026-09-01.
 */
export function goldCardDueDatesInRange(rangeStart: Date, rangeEnd: Date): Date[] {
  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const out: Date[] = [];
  let d = startOfDay(GOLD_CARD_ANCHOR);
  while (d.getTime() <= end.getTime()) {
    if (d.getTime() >= start.getTime()) out.push(d);
    d = new Date(d.getFullYear(), d.getMonth() + 3, d.getDate());
  }
  return out;
}
