// Single source of truth for the sidebar's structure — both Nav.tsx (the
// grouped rendering) and CommandPalette.tsx (the flattened, filterable
// list) read from here, so the two can never drift out of sync.
import {
  LayoutDashboard,
  Truck,
  Package,
  Calculator,
  Layers,
  Tag,
  Megaphone,
  FileText,
  Columns3,
  Calendar,
  Lightbulb,
  Mail,
  Share2,
  Heart,
  Settings,
  CreditCard,
  Sparkles,
  Palette,
  Headset,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_TOP_ITEM: NavItem = { href: "/", label: "Áttekintés", icon: LayoutDashboard };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "üzlet",
    items: [
      { href: "/suppliers", label: "Beszállítók", icon: Truck },
      { href: "/products", label: "Termékek", icon: Tag },
      { href: "/orders", label: "Vevői rendelések", icon: Package },
      { href: "/support", label: "Ügyfélszolgálat", icon: Headset },
      { href: "/finance", label: "Pénzügyek", icon: Calculator },
    ],
  },
  {
    label: "tartalom",
    items: [
      // Az alkotás sorrendjét követi: tervezés → nyers fájlok/import →
      // kész galéria → rituálé-tartalom → marketing → dokumentumok —
      // korábban a kész Kártyák galéria a tervező-eszközök ELŐTT
      // szerepelt, ami a munkafolyamattal ellentétes sorrend volt.
      { href: "/card-designer", label: "Kártyatervező", icon: Palette },
      { href: "/card-assets", label: "Kártya-fájlok", icon: Layers },
      { href: "/cards", label: "Kártyák", icon: CreditCard },
      { href: "/rituals", label: "Rituálék", icon: Sparkles },
      { href: "/marketing", label: "Marketing", icon: Megaphone },
      { href: "/documents", label: "Dokumentumok", icon: FileText },
    ],
  },
  {
    // Korábban külön "kapcsolat" csoport volt a Postaládának/Megosztásoknak,
    // de csak 2 elemmel jóval soványabb volt a másik 3 csoportnál (6/6/4/2) —
    // most mindhárom csoport 6 elemes, kiegyensúlyozottabb a nav.
    label: "munkafolyamat",
    items: [
      { href: "/tasks", label: "Feladatok", icon: Columns3 },
      { href: "/protocols", label: "Jegyzőkönyvek", icon: ClipboardList },
      { href: "/calendar", label: "Naptár", icon: Calendar },
      { href: "/future-plans", label: "Jövőbeli tervek", icon: Lightbulb },
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

/** Flattened, in display order — what the Cmd+K command palette lists. */
export const ALL_NAV_ITEMS: NavItem[] = [
  NAV_TOP_ITEM,
  ...NAV_GROUPS.flatMap((group) => group.items),
  NAV_RITUAL_ITEM,
  NAV_SETTINGS_ITEM,
];
