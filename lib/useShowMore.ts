import { useState } from "react";

/**
 * Shared "only show the first N, with a Továbbiak megjelenítése link"
 * behavior for any longer list in the Dashboard (Hírlevél feliratkozók,
 * Beszállítók/Dokumentumok within a category, a season's Kampányok…).
 * Resets implicitly whenever the caller re-mounts with a different key
 * (e.g. switching category) since it's just local component state — that
 * matches every list here starting collapsed again on a fresh view.
 */
export function useShowMore<T>(items: T[], initialCount = 8) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, initialCount);
  const hiddenCount = items.length - visible.length;
  return { visible, hasMore: hiddenCount > 0, hiddenCount, showAll, setShowAll };
}
