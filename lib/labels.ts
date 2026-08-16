// Hungarian display labels for enum-like values stored in English in
// Supabase (CHECK constraints reference the English values in schema.sql —
// translating only the display label avoids a schema migration).
import type { TaskPriority, PlanStatus, Season, OrderStatus } from "./supabase/types";

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
