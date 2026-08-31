"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

/**
 * Shared accordion primitive — the one collapse/expand look-and-feel used
 * everywhere a list or preview in the Dashboard can get long: the sidebar
 * nav groups, Email-sablonok previews, Hírlevél feliratkozók, Beszállítók
 * kategóriák, egy évszak Kampányok listája, Dokumentumok kategóriánként,
 * Kártya-fájlok/Marketing anyagok nyelv-csoportjai. Same ▸/▾ chevron, same
 * ~200ms grid-rows transition (measures the content's own height, no
 * guessed max-height — same technique as the mobile nav drawer), same
 * open/close mechanics everywhere it's used.
 *
 * `storageKey`, when given, persists the open/closed state to
 * localStorage (per-browser, same convention as every other UI-only
 * preference in this app — e.g. the Naptár legend toggles) so it's
 * remembered next visit; omit it for a section that should always start
 * the same way (e.g. always closed by default, like an Email-sablon
 * preview).
 */
export default function CollapsibleSection({
  title,
  right,
  actions,
  defaultOpen = true,
  storageKey,
  open: controlledOpen,
  onOpenChange,
  headerClassName = "",
  bodyClassName = "",
  chevronClassName = "text-muted",
  children,
}: {
  /** Omit entirely for a headerless instance — just the animated
   * collapse/expand wrapper, driven by a trigger the caller already has
   * elsewhere (e.g. the Eye/EyeOff button on an Email-sablon row). Pass
   * `open` + `onOpenChange` (controlled) in that case. */
  title?: ReactNode;
  /** Extra non-interactive content at the right edge of the header (a
   * count badge, a date) — sits inside the same clickable toggle button
   * as the title, so it also triggers collapse/expand on click. */
  right?: ReactNode;
  /** Real action buttons (e.g. "+ Feliratkozó hozzáadása") that must NOT
   * toggle the section — rendered as a sibling next to the toggle
   * button, never nested inside it. */
  actions?: ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  /** Controlled mode — pass both to drive open/closed from the parent
   * (e.g. Nav.tsx forcing a group open when it contains the active page,
   * on top of whatever was remembered) instead of this component's own
   * internal + localStorage state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  headerClassName?: string;
  bodyClassName?: string;
  /** Override for a header on a dark background (e.g. the Nav sidebar),
   * where the default text-muted chevron would barely show. */
  chevronClassName?: string;
  children: ReactNode;
}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isControlled ? controlledOpen : internalOpen;

  useEffect(() => {
    if (isControlled || !storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setInternalOpen(stored === "1");
      }
    } catch {
      // Private browsing or a blocked localStorage — just starts at
      // defaultOpen every time on this device.
    }
    // Only ever read once, on mount, keyed by whichever storageKey this
    // instance was given.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle() {
    const next = !open;
    if (isControlled) {
      onOpenChange?.(next);
      return;
    }
    setInternalOpen(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // Nothing to persist to — just won't be remembered next visit.
      }
    }
  }

  return (
    <div>
      {title !== undefined && (
        <div className={`flex w-full items-center justify-between gap-2 ${headerClassName}`}>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            {open ? (
              <ChevronDown size={14} className={`shrink-0 ${chevronClassName}`} />
            ) : (
              <ChevronRight size={14} className={`shrink-0 ${chevronClassName}`} />
            )}
            {title}
            {right}
          </button>
          {actions}
        </div>
      )}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className={`min-h-0 overflow-hidden ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  );
}
