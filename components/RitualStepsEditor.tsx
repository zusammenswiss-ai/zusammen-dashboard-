"use client";

import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

/**
 * Ordered step list for the Ritual Builder — array order *is* step
 * order (see rituals.steps in schema.sql), reordered with up/down
 * buttons rather than drag-and-drop since HTML5 DnD doesn't work on
 * iPad/iOS Safari (same reasoning as the Calendar touch fallback).
 */
export default function RitualStepsEditor({
  steps,
  onChange,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
}) {
  function updateStep(i: number, value: string) {
    const next = [...steps];
    next[i] = value;
    onChange(next);
  }
  function removeStep(i: number) {
    onChange(steps.filter((_, idx) => idx !== i));
  }
  function moveStep(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2.5 w-5 shrink-0 text-right text-xs font-medium text-muted">{i + 1}.</span>
          <textarea
            className="textarea min-h-[2.5rem] flex-1"
            value={step}
            onChange={(e) => updateStep(i, e.target.value)}
            placeholder={`Lépés ${i + 1}…`}
          />
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={() => moveStep(i, -1)}
              disabled={i === 0}
              className="rounded p-1 text-muted hover:bg-ivory-dim hover:text-forest disabled:opacity-30"
              aria-label="Lépés feljebb"
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              onClick={() => moveStep(i, 1)}
              disabled={i === steps.length - 1}
              className="rounded p-1 text-muted hover:bg-ivory-dim hover:text-forest disabled:opacity-30"
              aria-label="Lépés lejjebb"
            >
              <ArrowDown size={13} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => removeStep(i)}
            className="mt-1.5 shrink-0 rounded p-1 text-muted hover:text-red-600"
            aria-label="Lépés törlése"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...steps, ""])} className="btn btn-ghost self-start">
        <Plus size={14} /> Lépés hozzáadása
      </button>
    </div>
  );
}
