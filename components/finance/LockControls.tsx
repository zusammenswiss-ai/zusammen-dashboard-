"use client";

import { useState } from "react";
import { Stamp, Lock, History, X } from "lucide-react";
import type { UnlockHistoryEntry } from "@/lib/supabase/types";
import { formatDate } from "@/lib/format";

/**
 * "Rögzítés lezárása" / "Zárolás feloldása" — shared between Fix/Változó
 * költségek (ExpenseSection) and Bevételek (RevenueSection), both of
 * which carry identical is_locked/locked_at/unlock_history columns.
 * Same "seal" visual language as Gold Card Letters (Stamp icon, bronze =
 * commit an action), but the unlock path is deliberately understated —
 * a small muted text link, not a button — locking should be the easy,
 * inviting action; unlocking a "harder", more deliberate one.
 *
 * Purely presentational: the actual Supabase read/write for lock/unlock
 * lives in the parent section (ExpenseSection/RevenueSection), mirroring
 * how those files already own their own delete calls — this component
 * just awaits whatever async callback it's given and surfaces a thrown
 * error locally.
 */
export default function LockControls({
  isLocked,
  lockedAt,
  unlockHistory,
  onLock,
  onUnlock,
}: {
  isLocked: boolean;
  lockedAt: string | null;
  unlockHistory: UnlockHistoryEntry[];
  onLock: () => Promise<void>;
  onUnlock: (reason: string | null) => Promise<void>;
}) {
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLock(e: React.MouseEvent) {
    e.stopPropagation();
    setSaving(true);
    setError(null);
    try {
      await onLock();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült lezárni a rögzítést.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlockConfirm() {
    setSaving(true);
    setError(null);
    try {
      await onUnlock(reason.trim() || null);
      setShowUnlockConfirm(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült feloldani a zárolást.");
    } finally {
      setSaving(false);
    }
  }

  if (!isLocked) {
    return (
      <button
        type="button"
        onClick={handleLock}
        disabled={saving}
        className="text-muted/70 hover:text-bronze"
        title="Rögzítés lezárása"
      >
        <Stamp size={13} />
      </button>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <span
        className="badge bg-bronze/15 text-walnut"
        title={lockedAt ? `Lezárva: ${formatDate(lockedAt)}` : "Lezárva"}
      >
        <Lock size={10} className="mr-0.5 inline" /> Lezárva
      </span>
      {unlockHistory.length > 0 && (
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="text-[11px] text-muted underline decoration-dotted hover:text-forest"
        >
          Módosítási előzmény
        </button>
      )}
      <button
        type="button"
        onClick={() => setShowUnlockConfirm(true)}
        className="text-[11px] text-muted/60 underline decoration-dotted hover:text-muted"
      >
        Zárolás feloldása
      </button>

      {showUnlockConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
          onClick={() => setShowUnlockConfirm(false)}
        >
          <div className="animate-fade-in card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-base text-forest">Zárolás feloldása</h3>
              <button
                onClick={() => setShowUnlockConfirm(false)}
                className="rounded-md p-1 text-muted hover:bg-ivory-dim hover:text-forest"
                aria-label="Bezárás"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">
              Biztosan feloldod ezt a rögzített tételt? Ez a módosítás nyoma megmarad.
            </p>
            <label className="mt-3 block text-xs font-medium text-muted">Miért oldod fel? (opcionális)</label>
            <textarea
              className="textarea mt-1 min-h-16 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="pl. elírás javítása"
              autoFocus
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleUnlockConfirm()}
                className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Feloldás…" : "Feloldás megerősítése"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowUnlockConfirm(false)}>
                Mégse
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
          onClick={() => setShowHistory(false)}
        >
          <div className="animate-fade-in card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-1.5 font-serif text-base text-forest">
                <History size={15} className="text-bronze" /> Módosítási előzmény
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-md p-1 text-muted hover:bg-ivory-dim hover:text-forest"
                aria-label="Bezárás"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {[...unlockHistory].reverse().map((entry, i) => (
                <li key={i} className="rounded-md bg-ivory-dim px-3 py-2">
                  <p className="text-xs text-muted">{formatDate(entry.unlocked_at)}</p>
                  <p className="text-forest">{entry.reason || "Nincs megadva indoklás."}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </span>
  );
}
