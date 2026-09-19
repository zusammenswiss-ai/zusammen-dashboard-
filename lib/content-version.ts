// Shared version-bump + history-entry helpers for Kártyák/Rituálék — see
// the "Rituals + Cards" block in schema.sql for the full versioning story.
// Each entity's own save handler decides *when* to call these (content
// changed vs. status-only), since only it knows its own field shape.
import type { ContentStatus } from "./supabase/types";

/**
 * "v1.0" -> "v1.1", "v1.9" -> "v1.10", "v2" -> "v3". Bumps the trailing
 * run of digits by one; a version string with no trailing digits just
 * gets ".1" appended so a save never fails on an unusual label.
 */
export function bumpVersion(current: string): string {
  const match = current.match(/^(.*?)(\d+)$/);
  if (!match) return `${current}.1`;
  const [, prefix, digits] = match;
  return `${prefix}${Number(digits) + 1}`;
}

export interface VersionEntry<TSnapshot> {
  version: string;
  status: ContentStatus;
  changed_at: string;
  snapshot: TSnapshot | null;
}

/**
 * One history entry logging the state a record is *leaving* — pass the
 * pre-edit version/status and, only when content fields actually
 * changed, a snapshot of them (null for a pure status change, so an
 * archive/publish flip doesn't duplicate the full content).
 */
export function buildVersionEntry<TSnapshot>(
  version: string,
  status: ContentStatus,
  snapshot: TSnapshot | null
): VersionEntry<TSnapshot> {
  return { version, status, changed_at: new Date().toISOString(), snapshot };
}
