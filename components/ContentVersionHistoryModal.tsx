"use client";

import type { ReactNode } from "react";
import { X, History } from "lucide-react";
import { formatDate } from "@/lib/format";
import { CONTENT_STATUS_HU, CONTENT_STATUS_STYLES } from "@/lib/labels";
import type { VersionEntry } from "@/lib/content-version";
import BackButton from "@/components/BackButton";

/**
 * Read-only version-history viewer shared by Kártyák and Rituálék —
 * generic over the snapshot shape so each caller decides how to render
 * its own fields (a Card's question vs. a Ritual's steps), everything
 * else (list chrome, status badge, date, the "status-only change"
 * fallback line) stays identical between the two.
 */
export default function ContentVersionHistoryModal<TSnapshot>({
  title,
  entries,
  renderSnapshot,
  onClose,
}: {
  title: string;
  entries: VersionEntry<TSnapshot>[];
  renderSnapshot: (snapshot: TSnapshot) => ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-md flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h3 className="flex items-center gap-1.5 font-serif text-base text-forest">
            <History size={15} className="text-bronze" /> {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <BackButton onClick={onClose} label="Vissza" />
          {entries.length === 0 ? (
            <p className="text-sm text-muted">Még nincs korábbi verzió.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {[...entries].reverse().map((entry, i) => (
                <li key={i} className="rounded-md bg-ivory-dim px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-forest">{entry.version}</span>
                    <span className={`badge ${CONTENT_STATUS_STYLES[entry.status]}`}>
                      {CONTENT_STATUS_HU[entry.status]}
                    </span>
                    <span className="text-xs text-muted">{formatDate(entry.changed_at)}</span>
                  </div>
                  {entry.snapshot ? (
                    <div className="mt-1 text-xs text-muted">{renderSnapshot(entry.snapshot)}</div>
                  ) : (
                    <p className="mt-1 text-xs text-muted/70">Csak státuszváltás, a tartalom nem változott.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
