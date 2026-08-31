"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

/** Paired with lib/useShowMore.ts — same "+N Továbbiak megjelenítése" /
 * "Kevesebb megjelenítése" look everywhere a long list truncates itself. */
export default function ShowMoreButton({
  hiddenCount,
  showAll,
  onToggle,
}: {
  hiddenCount: number;
  showAll: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 flex items-center gap-1 text-xs font-medium text-bronze hover:underline"
    >
      {showAll ? (
        <>
          <ChevronUp size={13} /> Kevesebb megjelenítése
        </>
      ) : (
        <>
          <ChevronDown size={13} /> +{hiddenCount} továbbiak megjelenítése
        </>
      )}
    </button>
  );
}
