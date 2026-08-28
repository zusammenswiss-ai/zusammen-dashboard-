// Single source of truth for the sidebar's structure — both Nav.tsx (the
// grouped rendering) and CommandPalette.tsx (the flattened, filterable
// list) read from here, so the two can never drift out of sync.
import {
  LayoutDashboard,
  Truck,
  Package,
  Calculator,
  BarChart3,
  Layers,
  Megaphone,
  FileText,
  Columns3,
  Calendar,
  Lightbulb,
  Mail,
  Share2,
  Heart,
  Settings,
  Rocket,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Opens in a new tab instead of navigating in place — just the Landing oldal link today. */
  external?: boolean;
};
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_TOP_ITEM: NavItem = { href: "/", label: "Áttekintés", icon: LayoutDashboard };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "üzlet",
    items: [
      { href: "/suppliers", label: "Beszállítók", icon: Truck },
      { href: "/orders", label: "Megrendelések", icon: Package },
      { href: "/finance", label: "Pénzügyek", icon: Calculator },
      { href: "/demand", label: "Igényfelmérés", icon: BarChart3 },
    ],
  },
  {
    label: "tartalom",
    items: [
      { href: "/card-assets", label: "Kártya-fájlok", icon: Layers },
      { href: "/marketing", label: "Marketing", icon: Megaphone },
      { href: "/documents", label: "Dokumentumok", icon: FileText },
    ],
  },
  {
    label: "munkafolyamat",
    items: [
      { href: "/tasks", label: "Feladatok", icon: Columns3 },
      { href: "/calendar", label: "Naptár", icon: Calendar },
      { href: "/future-plans", label: "Jövőbeli tervek", icon: Lightbulb },
    ],
  },
  {
    label: "kapcsolat",
    items: [
      { href: "/inbox", label: "Postaláda", icon: Mail },
      { href: "/shares", label: "Megosztások", icon: Share2 },
    ],
  },
];

// Visually separated from the 4 business groups above (warmer background /
// gold left border even when inactive — see Nav.tsx) and from Beállítások
// below — a private ritual, not a business function.
export const NAV_RITUAL_ITEM: NavItem = { href: "/personal-ritual", label: "Személyes rituálé", icon: Heart };

export const NAV_SETTINGS_ITEM: NavItem = { href: "/settings", label: "Beállítások", icon: Settings };

export const NAV_LANDING_ITEM: NavItem = {
  href: "/landing",
  label: "Landing oldal",
  icon: Rocket,
  external: true,
};

/** Flattened, in display order — what the Cmd+K command palette lists. */
export const ALL_NAV_ITEMS: NavItem[] = [
  NAV_TOP_ITEM,
  ...NAV_GROUPS.flatMap((group) => group.items),
  NAV_RITUAL_ITEM,
  NAV_SETTINGS_ITEM,
  NAV_LANDING_ITEM,
];
