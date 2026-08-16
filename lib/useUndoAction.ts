"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PendingAction = {
  message: string;
  undo: () => void;
};

/**
 * Powers "optimistic delete + Visszavonás (undo)" flows: call `schedule`
 * with a toast message, the action to actually commit (e.g. the Supabase
 * delete), and the action that undoes the optimistic local change. The
 * commit runs automatically after `delayMs` unless `undoNow` is called
 * first. Starting a new action while one is still pending immediately
 * commits the previous one, so at most one undo window is ever open.
 */
export function useUndoAction(delayMs = 6000) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef<(() => void) | null>(null);
  const undoRef = useRef<(() => void) | null>(null);

  const flushPending = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const commit = commitRef.current;
    commitRef.current = null;
    undoRef.current = null;
    setPending(null);
    commit?.();
  }, []);

  // If the page unmounts (e.g. navigating away) while a delete is still
  // pending, commit it now instead of silently losing it — the item was
  // already removed from view, so it must actually get deleted.
  useEffect(() => () => flushPending(), [flushPending]);

  const schedule = useCallback(
    (message: string, commit: () => void, undo: () => void) => {
      flushPending();
      commitRef.current = commit;
      undoRef.current = undo;
      timeoutRef.current = setTimeout(() => {
        commitRef.current = null;
        undoRef.current = null;
        timeoutRef.current = null;
        setPending(null);
        commit();
      }, delayMs);
      setPending({ message, undo });
    },
    [delayMs, flushPending]
  );

  const undoNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    commitRef.current = null;
    const undo = undoRef.current;
    undoRef.current = null;
    setPending(null);
    undo?.();
  }, []);

  return { pending, schedule, undoNow };
}
