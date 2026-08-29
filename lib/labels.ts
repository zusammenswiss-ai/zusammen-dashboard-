// Hungarian display labels for enum-like values stored in English in
// Supabase (CHECK constraints reference the English values in schema.sql —
// translating only the display label avoids a schema migration).
import type {
  TaskPriority,
  PlanStatus,
  Season,
  OrderStatus,
  ContractStatus,
  PrintStatus,
  RecurrenceType,
  ProductStatus,
} from "./supabase/types";

export const PRIORITY_HU: Record<TaskPriority, string> = {
  Low: "Alacsony",
  Medium: "Közepes",
  High: "Magas",
};

export const PLAN_STATUS_HU: Record<PlanStatus, string> = {
  Idea: "Ötlet",
  Considering: "Fontolgatva",
  Planned: "Tervezve",
};

export const SEASON_HU: Record<Season, string> = {
  Spring: "Tavasz",
  Summer: "Nyár",
  Autumn: "Ősz",
  Winter: "Tél",
};

export const ORDER_STATUS_HU: Record<OrderStatus, string> = {
  New: "Új",
  Processing: "Feldolgozás alatt",
  Shipped: "Kiszállítva",
  Done: "Teljesítve",
};

export const CONTRACT_STATUS_HU: Record<ContractStatus, string> = {
  None: "Nincs",
  Signed: "Megkötve",
  Failed: "Nem jött létre",
  Expired: "Lejárt",
};

// print_status is already stored in Hungarian (see the schema check
// constraint), so no translation map — just display order + badge color.
export const PRINT_STATUSES: PrintStatus[] = [
  "Piszkozat",
  "Nyomdának elküldve",
  "Megrendelve",
  "Megérkezett",
];
export const PRINT_STATUS_STYLES: Record<PrintStatus, string> = {
  Piszkozat: "bg-gray-200 text-gray-700",
  "Nyomdának elküldve": "bg-yellow-100 text-yellow-800",
  Megrendelve: "bg-blue-100 text-blue-700",
  Megérkezett: "bg-green-100 text-green-700",
};

// status is already stored in Hungarian (see the schema check constraint
// on products) — just display order + badge color, same convention as
// print_status above.
export const PRODUCT_STATUSES: ProductStatus[] = ["Fejlesztés alatt", "Tesztelés", "Élő", "Jövőbeli terv"];
export const PRODUCT_STATUS_STYLES: Record<ProductStatus, string> = {
  "Fejlesztés alatt": "bg-gray-200 text-gray-700",
  Tesztelés: "bg-yellow-100 text-yellow-800",
  Élő: "bg-green-100 text-green-700",
  "Jövőbeli terv": "bg-blue-100 text-blue-700",
};

// Fixed preview slots a card-asset ZIP is scanned for on upload — shared
// between the Kártya-fájlok list and its detail modal.
export const CARD_ASSET_THUMB_SLOTS: { key: string; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "wild", label: "Wild" },
  { key: "goldcard", label: "GoldCard" },
];

// Fixed display order for task-template categories — the seeded set,
// in the order they were specified. Any custom category an editor adds
// later just sorts alphabetically after these.
export const TEMPLATE_CATEGORY_ORDER = [
  "Beszállítók & Gyártás",
  "Kártya-fájlok",
  "Marketing",
  "Gold Card Letters",
  "Pénzügy",
  "Jogi & Adminisztráció",
  "Founder Journey & Közösség",
];

// Fixed options for a template's default assignee — matches tasks.assignee
// being free text, but the template picker/editor only offers these.
export const TEMPLATE_ASSIGNEE_OPTIONS = ["Barbara", "Partner", "Mindketten"];

// recurrence_type is already stored in Hungarian (see the schema check
// constraint) — this is display order for the select, not a translation.
export const RECURRENCE_TYPES: RecurrenceType[] = ["Napi", "Heti", "Havi", "Negyedéves", "Éves"];

// The grammatical unit word for "Minden {n}. ___" — e.g. interval 2 +
// Heti → "Minden 2. hét" (every 2nd week = biweekly).
export const RECURRENCE_UNIT_HU: Record<RecurrenceType, string> = {
  Napi: "nap",
  Heti: "hét",
  Havi: "hónap",
  Negyedéves: "negyedév",
  Éves: "év",
};

export function recurrenceFrequencyLabel(type: RecurrenceType, interval: number): string {
  return interval <= 1 ? `Minden ${RECURRENCE_UNIT_HU[type]}` : `Minden ${interval}. ${RECURRENCE_UNIT_HU[type]}`;
}

/**
 * Groups items by a `category` field, ordering known categories first
 * (per `order`, in that order) and any others alphabetically after —
 * shared by the Kártya-fájlok language grouping and the task-template
 * category grouping.
 */
export function groupByCategory<T extends { category: string }>(
  items: T[],
  order: string[]
): { category: string; items: T[] }[] {
  const byCategory = new Map<string, T[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  const categories = Array.from(byCategory.keys()).sort((a, b) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
  return categories.map((category) => ({ category, items: byCategory.get(category)! }));
}

/**
 * Category → color/label map shared by the Naptár (calendar) view and
 * anywhere else that needs a consistent legend across data types.
 * Colors map to the `--color-*` tokens in globals.css.
 */
export const CALENDAR_CATEGORIES = {
  task: { label: "Feladatok", color: "bronze" },
  supplier: { label: "Beszállítók", color: "walnut" },
  document: { label: "Dokumentumok", color: "forest" },
  marketing: { label: "Marketing", color: "slate" },
  plan: { label: "Jövőbeli tervek", color: "mauve" },
  order: { label: "Megrendelések", color: "forest-light" },
  content: { label: "Tartalom-naptár", color: "clay" },
  ritual: { label: "Személyes rituálé", color: "teal" },
  contract: { label: "Szerződés lejárat", color: "rose" },
  recurring: { label: "Ismétlődő sablon", color: "indigo" },
  event: { label: "Egyedi esemény", color: "emerald" },
} as const;

export type CalendarCategory = keyof typeof CALENDAR_CATEGORIES;
