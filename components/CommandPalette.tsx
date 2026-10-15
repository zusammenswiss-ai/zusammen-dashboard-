"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Search, CornerDownLeft, ExternalLink, Rocket as CampaignIcon, ListTodo, Images } from "lucide-react";
import { ALL_NAV_ITEMS, type NavItem } from "@/lib/nav-items";
import { getSupabaseClient } from "@/lib/supabase/client";

type SearchResults = {
  campaigns: { id: string; name: string; slug: string | null }[];
  tasks: { id: string; title: string }[];
  assets: { id: string; title: string }[];
};

const EMPTY_RESULTS: SearchResults = { campaigns: [], tasks: [], assets: [] };

/**
 * Cmd+K / Ctrl+K quick-switcher — lists every sidebar destination
 * (Nav.tsx and this component both read lib/nav-items.ts so the two
 * never drift apart), filterable by typing, Enter navigates. Styled by
 * hand (fixed overlay + card, same convention as EmailComposeModal etc.)
 * rather than cmdk's own Command.Dialog, which ships no CSS of its own
 * and would mean either way maintaining these styles ourselves.
 *
 * Beyond the static nav list, typing also searches live data — kampányok,
 * feladatok és marketing anyagok — so Barbi doesn't have to remember which
 * oldal egy adott kampányt/feladatot tartalmazza.
 */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(EMPTY_RESULTS);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const timeout = setTimeout(async () => {
      const [campaignsRes, tasksRes, assetsRes] = await Promise.all([
        supabase.from("campaigns").select("id, name, slug").ilike("name", `%${query}%`).limit(5),
        supabase.from("tasks").select("id, title").ilike("title", `%${query}%`).limit(5),
        supabase.from("marketing_assets").select("id, title").ilike("title", `%${query}%`).limit(5),
      ]);
      setResults({
        campaigns: campaignsRes.data ?? [],
        tasks: tasksRes.data ?? [],
        assets: assetsRes.data ?? [],
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [search]);

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

  function close() {
    setOpen(false);
    setSearch("");
  }

  function go(item: NavItem) {
    close();
    if (item.external) {
      window.open(item.href, "_blank", "noopener,noreferrer");
    } else {
      router.push(item.href);
    }
  }

  function goTo(href: string) {
    close();
    router.push(href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-forest/40 px-4 pt-[14vh] backdrop-blur-[2px]"
      onClick={close}
    >
      <Command
        label="Gyorskereső"
        shouldFilter
        loop
        className="animate-fade-in card w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search size={16} className="shrink-0 text-muted" />
          <Command.Input
            autoFocus
            value={search}
            onValueChange={setSearch}
            placeholder="Ugrás egy oldalra, kampányra, feladatra, anyagra…"
            className="w-full bg-transparent text-sm text-forest outline-none placeholder:text-muted"
          />
          <kbd className="shrink-0 rounded border border-border bg-ivory-dim px-1.5 py-0.5 text-[10px] font-medium text-muted">
            Esc
          </kbd>
        </div>
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">Nincs találat.</Command.Empty>

          {results.campaigns.length > 0 && (
            <Command.Group heading="Kampányok" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted">
              {results.campaigns.map((c) => (
                <Command.Item
                  key={`campaign-${c.id}`}
                  value={`campaign ${c.name}`}
                  onSelect={() => goTo(c.slug ? `/marketing/kampanyok/${c.slug}` : "/marketing")}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-forest data-[selected=true]:bg-ivory-dim"
                >
                  <CampaignIcon size={16} className="shrink-0 text-bronze" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <CornerDownLeft size={13} className="shrink-0 text-muted/50" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {results.tasks.length > 0 && (
            <Command.Group heading="Feladatok" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted">
              {results.tasks.map((t) => (
                <Command.Item
                  key={`task-${t.id}`}
                  value={`task ${t.title}`}
                  onSelect={() => goTo(`/tasks?open=${t.id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-forest data-[selected=true]:bg-ivory-dim"
                >
                  <ListTodo size={16} className="shrink-0 text-bronze" />
                  <span className="flex-1 truncate">{t.title}</span>
                  <CornerDownLeft size={13} className="shrink-0 text-muted/50" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {results.assets.length > 0 && (
            <Command.Group heading="Marketing anyagok" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted">
              {results.assets.map((a) => (
                <Command.Item
                  key={`asset-${a.id}`}
                  value={`asset ${a.title}`}
                  onSelect={() => goTo("/marketing?tab=assets")}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-forest data-[selected=true]:bg-ivory-dim"
                >
                  <Images size={16} className="shrink-0 text-bronze" />
                  <span className="flex-1 truncate">{a.title}</span>
                  <CornerDownLeft size={13} className="shrink-0 text-muted/50" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

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
