"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import { useEffect, useState } from "react";
import NotificationBell from "@/components/NotificationBell";
import CommandPalette from "@/components/CommandPalette";
import CollapsibleSection from "@/components/CollapsibleSection";
import {
  NAV_TOP_ITEM,
  NAV_GROUPS,
  NAV_RITUAL_ITEM,
  NAV_SETTINGS_ITEM,
  NAV_LANDING_ITEM,
  type NavItem,
} from "@/lib/nav-items";

const NAV_GROUP_STORAGE_PREFIX = "zusammen-nav-group-collapsed-";

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Which groups the founder has explicitly collapsed (persisted below) —
  // a group not in this set renders open, same as before this feature.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const next = new Set<string>();
      for (const group of NAV_GROUPS) {
        if (localStorage.getItem(NAV_GROUP_STORAGE_PREFIX + group.label) === "1") next.add(group.label);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsedGroups(next);
    } catch {
      // Private browsing or a blocked localStorage — every group just
      // starts open every time on this device.
    }
  }, []);

  function setGroupCollapsed(label: string, collapsed: boolean) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (collapsed) next.add(label);
      else next.delete(label);
      return next;
    });
    try {
      localStorage.setItem(NAV_GROUP_STORAGE_PREFIX + label, collapsed ? "1" : "0");
    } catch {
      // Nothing to persist to — won't be remembered next visit.
    }
  }

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

      {/* Sidebar (desktop) / drawer (mobile). Mobile open/close animates via
          a grid-rows 0fr↔1fr transition (measures its own content height,
          no guessed max-height) with a synced opacity fade, instead of the
          old instant block/hidden toggle — lg: forces it permanently open
          on desktop regardless of `open`. */}
      <aside
        className={`grid w-full shrink-0 bg-forest transition-[grid-template-rows] duration-300 ease-in-out lg:!grid-rows-[1fr] lg:w-64 ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div
          className={`min-h-0 overflow-hidden transition-opacity duration-200 lg:!opacity-100 ${
            open ? "opacity-100" : "opacity-0"
          }`}
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

          <nav className="flex flex-col gap-1.5 px-3 pb-3 lg:px-4">
            <NavLink item={NAV_TOP_ITEM} active={isActive(NAV_TOP_ITEM)} onNavigate={() => setOpen(false)} />

            {NAV_GROUPS.map((group) => {
              const containsActive = group.items.some(isActive);
              // A group the active page lives in always shows itself,
              // regardless of what was remembered — never hide where you
              // currently are behind a collapsed group.
              const groupOpen = containsActive || !collapsedGroups.has(group.label);
              return (
                <div key={group.label} className="mt-4">
                  <CollapsibleSection
                    title={
                      <span className="font-mono text-[10px] font-medium lowercase tracking-[0.18em] text-ivory/40">
                        {group.label}
                      </span>
                    }
                    open={groupOpen}
                    onOpenChange={(next) => setGroupCollapsed(group.label, !next)}
                    headerClassName="mb-1.5 rounded px-3 py-1 hover:bg-white/[0.04]"
                    bodyClassName="flex flex-col gap-1"
                    chevronClassName="text-ivory/40"
                  >
                    {group.items.map((item) => (
                      <NavLink key={item.href} item={item} active={isActive(item)} onNavigate={() => setOpen(false)} />
                    ))}
                  </CollapsibleSection>
                </div>
              );
            })}

            {/* Személyes rituálé — visually set apart from the business
                groups above: a warm background + gold left border even
                while inactive, not just on the active state everything
                else gets. */}
            <div className="mt-4 border-t border-ivory/10 pt-3">
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
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-bronze-light transition-colors hover:bg-forest-light/70 hover:text-ivory"
              >
                <NAV_LANDING_ITEM.icon size={17} strokeWidth={2} />
                {NAV_LANDING_ITEM.label}
              </Link>
            </div>
          </div>
          <div className="hidden px-6 pb-6 text-xs leading-relaxed text-ivory/40 lg:block">
            Zusammen — prémium svájci beszélgetőkártyák. Alapítói dashboard, v1.
          </div>
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
  // Active indicator (solid bronze fill + matching left border) is the
  // one constant across every group, ritual included — see stateClasses
  // below, where `active` is always checked first regardless of `ritual`.
  const baseClasses = "flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 text-sm font-medium transition-colors duration-150";
  const stateClasses = active
    ? "border-bronze bg-bronze text-white"
    : ritual
      ? "border-bronze/40 bg-bronze/10 text-ivory/90 hover:border-bronze/60 hover:bg-bronze/15"
      : "border-transparent text-ivory/75 hover:bg-white/[0.06] hover:text-ivory";

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
