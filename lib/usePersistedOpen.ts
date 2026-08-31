"use client";

import { useEffect, useState } from "react";

/**
 * Same per-browser localStorage persistence CollapsibleSection does
 * internally in its own uncontrolled mode — pulled out as a hook for the
 * handful of call sites that need to *drive* a CollapsibleSection in
 * controlled mode (e.g. Hírlevél feliratkozók force-expanding itself when
 * "+ Feliratkozó hozzáadása" is clicked while collapsed) instead of
 * letting the component manage its own open/closed state.
 */
export function usePersistedOpen(storageKey: string, defaultOpen = true) {
  const [open, setOpenState] = useState(defaultOpen);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setOpenState(stored === "1");
      }
    } catch {
      // Private browsing or a blocked localStorage — starts at
      // defaultOpen every time on this device.
    }
    // Only ever read once, on mount, keyed by whichever storageKey this
    // instance was given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setOpen(next: boolean) {
    setOpenState(next);
    try {
      localStorage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // Nothing to persist to — won't be remembered next visit.
    }
  }

  return [open, setOpen] as const;
}
