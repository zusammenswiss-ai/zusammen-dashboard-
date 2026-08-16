// Hungarian display labels for enum-like values stored in English in
// Supabase (CHECK constraints reference the English values in schema.sql —
// translating only the display label avoids a schema migration).
import type { TaskPriority, PlanStatus, Season } from "./supabase/types";

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
