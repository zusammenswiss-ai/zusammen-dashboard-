"use client";

import { ArrowLeft } from "lucide-react";

/**
 * "← Vissza" — a consistently-labeled back affordance at the top of every
 * detail/expanded sub-view (kampány részletes nézet, feladat/kártya-fájl
 * detail modal, beszállító profil, egy kibontott termékkártya…), on top
 * of whatever close/collapse control the view already had (an X button,
 * or the same header row toggling it shut again). Always icon + text —
 * never an icon alone — so it reads clearly and stays easy to tap on
 * mobile, not just a small arrow glyph.
 */
export default function BackButton({ onClick, label = "Vissza" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 mb-3 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-ivory-dim hover:text-forest"
    >
      <ArrowLeft size={16} /> {label}
    </button>
  );
}
