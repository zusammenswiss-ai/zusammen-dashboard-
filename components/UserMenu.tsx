"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRound, Settings, LogOut } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

/**
 * Persistent account menu — sign-out and a Beállítások shortcut, reachable
 * from every page via the nav (previously sign-out only lived inside
 * Beállítások' own AccountCard, so leaving that page was the only way
 * back to it). Same dropdown mechanics as NotificationBell (click-outside
 * to close, `absolute right-0 top-11` panel) for a consistent feel next
 * to it in the nav.
 */
export default function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const supabase = getSupabaseClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function signOut() {
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!supabase) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Fiók menü"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ivory/80 transition-colors hover:bg-forest-light hover:text-ivory"
      >
        <UserRound size={18} />
      </button>

      {open && (
        <div className="animate-fade-in absolute right-0 top-11 z-50 w-64 max-w-[90vw] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {email && (
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm text-forest">{email}</p>
            </div>
          )}
          <div className="flex flex-col p-1.5">
            <Link
              href="/settings"
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-forest transition-colors hover:bg-ivory-dim"
            >
              <Settings size={15} /> Beállítások
            </Link>
            <button
              onClick={() => void signOut()}
              disabled={signingOut}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-forest transition-colors hover:bg-ivory-dim disabled:opacity-50"
            >
              <LogOut size={15} /> {signingOut ? "Kijelentkezés…" : "Kijelentkezés"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
