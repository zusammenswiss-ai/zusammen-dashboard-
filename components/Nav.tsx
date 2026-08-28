"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import { useState } from "react";
import NotificationBell from "@/components/NotificationBell";
import CommandPalette from "@/components/CommandPalette";
import {
  NAV_TOP_ITEM,
  NAV_GROUPS,
  NAV_RITUAL_ITEM,
  NAV_SETTINGS_ITEM,
  NAV_LANDING_ITEM,
  type NavItem,
} from "@/lib/nav-items";

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(item: NavItem) {
    return item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-forest px-4 py-3 lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Navigáció megnyitása/bezárása"
            className="rounded-md p-2 text-ivory hover:bg-forest-light"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={`${
          open ? "block" : "hidden"
        } w-full shrink-0 bg-forest lg:block lg:w-64`}
      >
        <div className="hidden items-center justify-between px-6 py-7 lg:flex">
          <Brand />
          <NotificationBell />
        </div>

        <div className="px-3 pb-2 lg:px-4">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="flex w-full items-center gap-2.5 rounded-lg border border-ivory/10 bg-forest-light/40 px-3 py-2 text-left text-sm text-ivory/50 transition-colors hover:border-ivory/20 hover:text-ivory/80"
          >
            <Search size={15} />
            <span className="flex-1">Gyorskeresés…</span>
            <kbd className="rounded border border-ivory/15 px-1.5 py-0.5 font-mono text-[10px] text-ivory/40">⌘K</kbd>
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3 pb-3 lg:px-4">
          <NavLink item={NAV_TOP_ITEM} active={isActive(NAV_TOP_ITEM)} onNavigate={() => setOpen(false)} />

          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mt-3">
              <p className="mb-1 px-3 font-mono text-[10px] font-medium tracking-[0.16em] text-ivory/35">
                {group.label}
              </p>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <NavLink key={item.href} item={item} active={isActive(item)} onNavigate={() => setOpen(false)} />
                ))}
              </div>
            </div>
          ))}

          {/* Személyes rituálé — visually set apart from the business
              groups above: a warm background + gold left border even
              while inactive, not just on the active state everything
              else gets. */}
          <div className="mt-3 border-t border-ivory/10 pt-3">
            <NavLink
              item={NAV_RITUAL_ITEM}
              active={isActive(NAV_RITUAL_ITEM)}
              onNavigate={() => setOpen(false)}
              ritual
            />
          </div>

          <div className="mt-1 border-t border-ivory/10 pt-3">
            <NavLink item={NAV_SETTINGS_ITEM} active={isActive(NAV_SETTINGS_ITEM)} onNavigate={() => setOpen(false)} />
          </div>
        </nav>

        <div className="px-3 pb-6 lg:px-4">
          <div className="border-t border-ivory/10 pt-3">
            <Link
              href={NAV_LANDING_ITEM.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-bronze-light transition-colors hover:bg-forest-light hover:text-ivory"
            >
              <NAV_LANDING_ITEM.icon size={17} strokeWidth={2} />
              {NAV_LANDING_ITEM.label}
            </Link>
          </div>
        </div>
        <div className="hidden px-6 pb-6 text-xs leading-relaxed text-ivory/40 lg:block">
          Zusammen — prémium svájci beszélgetőkártyák. Alapítói dashboard, v1.
        </div>
      </aside>

      <CommandPalette />
    </>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
  ritual = false,
}: {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
  /** Személyes rituálé — gets a warm/gold treatment even while inactive. */
  ritual?: boolean;
}) {
  const Icon = item.icon;
  const baseClasses = "flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors";
  const stateClasses = active
    ? "border-bronze bg-bronze text-white"
    : ritual
      ? "border-bronze/40 bg-bronze/10 text-ivory/90 hover:border-bronze/60 hover:bg-bronze/15"
      : "border-transparent text-ivory/80 hover:bg-forest-light hover:text-ivory";

  return (
    <Link href={item.href} onClick={onNavigate} className={`${baseClasses} ${stateClasses}`}>
      <Icon size={17} strokeWidth={2} />
      {item.label}
    </Link>
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
