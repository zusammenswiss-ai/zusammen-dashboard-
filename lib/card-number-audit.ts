import type { CollectionCard, CollectionCardType } from "./supabase/types";

export interface CardNumberDuplicate {
  card_number: string;
  cardIds: string[];
}

export interface CardNumberGap {
  card_type: CollectionCardType;
  suit: string | null;
  missing: number[];
}

export interface CardNumberAudit {
  duplicates: CardNumberDuplicate[];
  gaps: CardNumberGap[];
}

/**
 * Kollekciónkénti áttekintés: van-e duplikált vagy hiányzó sorszám.
 *
 * - Duplikátum: ugyanaz a card_number string kettő vagy több kártyán —
 *   típustól/kategóriától függetlenül, mert egy azonosítónak a teljes
 *   kollekción belül egyedinek kell lennie.
 * - Hiányzó: csak a tisztán numerikus sorszámok (pl. "2", "3") közötti
 *   réseket nézi, kategóriánként (card_type + suit) csoportosítva — ez
 *   ugyanaz a csoportosítás, amit egy kártyajáték-szerű "A, 2, 3…"
 *   sorozat elvár. A nem-numerikus azonosítók (pl. "A", "Wild Card 1")
 *   nincsenek belevonva a rés-számításba — nincs megbízható mód
 *   eldönteni, hogy "A" után mi számít "hiányzónak".
 */
export function auditCardNumbers(cards: CollectionCard[]): CardNumberAudit {
  const byNumber = new Map<string, string[]>();
  for (const card of cards) {
    const ids = byNumber.get(card.card_number) ?? [];
    ids.push(card.id);
    byNumber.set(card.card_number, ids);
  }
  const duplicates: CardNumberDuplicate[] = [...byNumber.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([card_number, cardIds]) => ({ card_number, cardIds }));

  const groups = new Map<string, { card_type: CollectionCardType; suit: string | null; values: Set<number> }>();
  for (const card of cards) {
    if (!/^\d+$/.test(card.card_number)) continue;
    const key = `${card.card_type}::${card.suit ?? ""}`;
    const group = groups.get(key) ?? { card_type: card.card_type, suit: card.suit, values: new Set<number>() };
    group.values.add(Number(card.card_number));
    groups.set(key, group);
  }
  const gaps: CardNumberGap[] = [];
  for (const { card_type, suit, values } of groups.values()) {
    if (values.size < 2) continue;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const missing: number[] = [];
    for (let n = min; n <= max; n++) if (!values.has(n)) missing.push(n);
    if (missing.length > 0) gaps.push({ card_type, suit, missing });
  }

  return { duplicates, gaps };
}
