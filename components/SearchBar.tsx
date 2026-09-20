"use client";

import { Search } from "lucide-react";

/**
 * Shared live-filter search input — the same "icon + input pl-9" markup was
 * copy-pasted near-identically across ~10 list pages before this. `compact`
 * matches the smaller variant used inside dense filter rows (e.g. Pénzügyek
 * kiadás-lista); `className` controls the wrapper's width/flex behavior
 * since that varies by page (fixed max-w-xs vs. flex-1 inside a flex row).
 */
export default function SearchBar({
  value,
  onChange,
  placeholder,
  className = "relative w-full max-w-xs",
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={className}>
      <Search
        size={compact ? 14 : 15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        className={compact ? "input pl-8 !py-1.5 text-xs" : "input pl-9"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
