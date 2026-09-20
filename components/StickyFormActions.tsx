"use client";

import type { ReactNode } from "react";

/**
 * Bottom action bar for the app's longest inline (non-modal) forms —
 * Termékek, Kiadás/Számla hozzáadása, Új tartalom — so Mentés/Mégse stay
 * reachable on a phone without scrolling past the whole form. Sticks to
 * the bottom of the viewport while the form scrolls by on mobile/tablet;
 * on desktop (lg+) these forms are short enough relative to the screen
 * that it just renders inline like every other form's button row.
 */
export default function StickyFormActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 rounded-b-md border-t border-border bg-card px-4 py-3 lg:static lg:mx-0 lg:mb-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
      {children}
    </div>
  );
}
