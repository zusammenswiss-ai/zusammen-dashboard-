"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, CornerDownLeft, ExternalLink } from "lucide-react";
import { ALL_NAV_ITEMS, type NavItem } from "@/lib/nav-items";

/**
 * Cmd+K / Ctrl+K quick-switcher — lists every sidebar destination
 * (Nav.tsx and this component both read lib/nav-items.ts so the two
 * never drift apart), filterable by typing, Enter navigates. Styled by
 * hand (fixed overlay + card, same convention as EmailComposeModal etc.)
 * rather than cmdk's own Command.Dialog, which ships no CSS of its own
 * and would mean either way maintaining these styles ourselves.
 */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    // Also openable by clicking Nav.tsx's "Gyorskeresés" hint button — a
    // plain custom event rather than lifting state/context, since Nav
    // only ever needs to fire-and-forget an "open" request.
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpenEvent);
    };
  }, []);

  function go(item: NavItem) {
    setOpen(false);
    if (item.external) {
      window.open(item.href, "_blank", "noopener,noreferrer");
    } else {
      router.push(item.href);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-forest/40 px-4 pt-[14vh] backdrop-blur-[2px]"
      onClick={() => setOpen(false)}
    >
      <Command
        label="Gyorskereső"
        shouldFilter
        loop
        className="animate-fade-in card w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={16} className="shrink-0 text-muted" />
          <Command.Input
            autoFocus
            placeholder="Ugrás egy oldalra…"
            className="w-full bg-transparent text-sm text-forest outline-none placeholder:text-muted"
          />
          <kbd className="shrink-0 rounded border border-border bg-ivory-dim px-1.5 py-0.5 text-[10px] font-medium text-muted">
            Esc
          </kbd>
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">Nincs találat.</Command.Empty>
          {ALL_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Command.Item
                key={item.href}
                value={item.label}
                onSelect={() => go(item)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-forest data-[selected=true]:bg-ivory-dim"
              >
                <Icon size={16} className="shrink-0 text-bronze" />
                <span className="flex-1">{item.label}</span>
                {item.external ? (
                  <ExternalLink size={13} className="shrink-0 text-muted/50" />
                ) : (
                  <CornerDownLeft size={13} className="shrink-0 text-muted/50" />
                )}
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}
