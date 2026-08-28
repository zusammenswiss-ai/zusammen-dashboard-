"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarRange,
  Users,
  KanbanSquare,
  Package,
  Calculator,
  Sprout,
  FolderOpen,
  Lightbulb,
  ClipboardList,
  Archive,
  Menu,
  X,
  Rocket,
  HeartHandshake,
  Share2,
  Settings,
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Áttekintés", icon: LayoutDashboard },
  { href: "/calendar", label: "Naptár", icon: CalendarRange },
  { href: "/suppliers", label: "Beszállítók", icon: Users },
  { href: "/tasks", label: "Feladatok", icon: KanbanSquare },
  { href: "/orders", label: "Megrendelések", icon: Package },
  { href: "/finance", label: "Pénzügyek", icon: Calculator },
  { href: "/marketing", label: "Marketing", icon: Sprout },
  { href: "/demand", label: "Igényfelmérés", icon: ClipboardList },
  { href: "/documents", label: "Dokumentumok", icon: FolderOpen },
  { href: "/card-assets", label: "Kártya-fájlok", icon: Archive },
  { href: "/personal-ritual", label: "Személyes rituálé", icon: HeartHandshake },
  { href: "/shares", label: "Megosztások", icon: Share2 },
  { href: "/future-plans", label: "Jövőbeli tervek", icon: Lightbulb },
  { href: "/settings", label: "Beállítások", icon: Settings },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-forest px-4 py-3 lg:hidden">
        <Brand />
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Navigáció megnyitása/bezárása"
          className="rounded-md p-2 text-ivory hover:bg-forest-light"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={`${
          open ? "block" : "hidden"
        } w-full shrink-0 bg-forest lg:block lg:w-64`}
      >
        <div className="hidden px-6 py-7 lg:block">
          <Brand />
        </div>
        <nav className="flex flex-col gap-1 px-3 pb-3 lg:px-4">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-bronze text-white"
                    : "text-ivory/80 hover:bg-forest-light hover:text-ivory"
                }`}
              >
                <Icon size={17} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 pb-6 lg:px-4">
          <div className="border-t border-ivory/10 pt-3">
            <Link
              href="/landing"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-bronze-light transition-colors hover:bg-forest-light hover:text-ivory"
            >
              <Rocket size={17} strokeWidth={2} />
              Landing oldal
            </Link>
          </div>
        </div>
        <div className="hidden px-6 pb-6 text-xs leading-relaxed text-ivory/40 lg:block">
          Zusammen — prémium svájci beszélgetőkártyák. Alapítói dashboard, v1.
        </div>
      </aside>
    </>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bronze font-serif text-sm font-semibold text-white">
        Z
      </span>
      <span className="font-serif text-lg font-medium tracking-wide text-ivory">
        Zusammen
      </span>
    </Link>
  );
}
