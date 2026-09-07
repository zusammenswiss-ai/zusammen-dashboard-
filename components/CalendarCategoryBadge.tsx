import {
  CheckSquare,
  Truck,
  FileText,
  Megaphone,
  Compass,
  Package,
  Image as ImageIcon,
  Heart,
  FileWarning,
  Repeat,
  CalendarDays,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { CalendarCategory } from "@/lib/labels";

// Shared between the Naptár page (month grid dots, agenda rows, day
// modal, legend) and the Áttekintés "Közelgő események" widget — one
// place to keep an event type's color+icon consistent everywhere it
// shows up. Literal Tailwind class names throughout (not built via
// template strings) so the scanner can see and generate them.

export const CATEGORY_ICON: Record<CalendarCategory, LucideIcon> = {
  task: CheckSquare,
  supplier: Truck,
  document: FileText,
  marketing: Megaphone,
  plan: Compass,
  order: Package,
  content: ImageIcon,
  ritual: Heart,
  contract: FileWarning,
  recurring: Repeat,
  event: CalendarDays,
  campaign: Target,
};

/** Small solid dot — used for the compact per-day markers in the month grid. */
export const CATEGORY_DOT: Record<CalendarCategory, string> = {
  task: "bg-blue-500",
  supplier: "bg-walnut",
  document: "bg-forest",
  marketing: "bg-slate",
  plan: "bg-mauve",
  order: "bg-forest-light",
  content: "bg-clay",
  ritual: "bg-teal",
  contract: "bg-rose-500",
  recurring: "bg-indigo-500",
  event: "bg-emerald-600",
  campaign: "bg-amber-500",
};

const CATEGORY_TEXT: Record<CalendarCategory, string> = {
  task: "text-blue-600",
  supplier: "text-walnut",
  document: "text-forest",
  marketing: "text-slate",
  plan: "text-mauve",
  order: "text-forest-light",
  content: "text-clay",
  ritual: "text-teal",
  contract: "text-rose-600",
  recurring: "text-indigo-600",
  event: "text-emerald-700",
  campaign: "text-amber-600",
};

const CATEGORY_BG_TINT: Record<CalendarCategory, string> = {
  task: "bg-blue-500/10",
  supplier: "bg-walnut/10",
  document: "bg-forest/10",
  marketing: "bg-slate/10",
  plan: "bg-mauve/10",
  order: "bg-forest-light/10",
  content: "bg-clay/10",
  ritual: "bg-teal/10",
  contract: "bg-rose-500/10",
  recurring: "bg-indigo-500/10",
  event: "bg-emerald-600/10",
  campaign: "bg-amber-500/10",
};

/** A category's icon in a small tinted circle — the "szín + ikon" unit
 * used everywhere an event needs to read at a glance (agenda rows, the
 * day modal, the legend, the Áttekintés widget). */
export function CategoryIcon({ category, size = 13 }: { category: CalendarCategory; size?: number }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${CATEGORY_BG_TINT[category]} ${CATEGORY_TEXT[category]}`}
    >
      <Icon size={size} />
    </span>
  );
}
