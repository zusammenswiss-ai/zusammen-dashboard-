// Hungarian display labels for enum-like values stored in English in
// Supabase (CHECK constraints reference the English values in schema.sql —
// translating only the display label avoids a schema migration).
import type { TaskPriority, PlanStatus, Season, OrderStatus, ContractStatus, PrintStatus } from "./supabase/types";

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

// Fixed preview slots a card-asset ZIP is scanned for on upload — shared
// between the Kártya-fájlok list and its detail modal.
export const CARD_ASSET_THUMB_SLOTS: { key: string; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "back", label: "Back" },
  { key: "wild", label: "Wild" },
  { key: "goldcard", label: "GoldCard" },
];

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
} as const;

export type CalendarCategory = keyof typeof CALENDAR_CATEGORIES;
