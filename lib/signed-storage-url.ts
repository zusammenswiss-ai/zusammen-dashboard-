// Every founder-only Storage bucket that used to be `public: true` is now
// private (see supabase/schema.sql's "Row Level Security" note) — a bare
// file_url/image_url/screenshot_url stored in the database is no longer
// enough on its own to actually fetch the file, it needs to be exchanged
// for a short-lived signed URL first. Two buckets stay public on purpose
// and never go through this file: gold-card-letters/journey-memories
// (read by /together's visitor, who never holds a Supabase Auth session
// to request a signed URL with) and email-assets (its logo URL is
// embedded straight into campaign HTML sent to external recipients —
// their mail client fetches it anonymously, no way to authenticate it).
//
// Upload code doesn't change at all: it still calls getPublicUrl() to
// build the string that gets stored in the row — that call is a pure,
// local string-builder (no network request, no check that the bucket is
// actually public), so it keeps working exactly as before as a stable,
// parseable "canonical form" for a stored path. Only *reading* a file
// back changes — this module pulls the bare path back out of that
// stored string and exchanges it for a real, working signed URL.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Long enough that a page left open for a while doesn't need to
// re-resolve mid-use, short enough that a signed URL copied out of the
// dashboard somewhere doesn't stay live indefinitely.
const DEFAULT_EXPIRY_SECONDS = 60 * 60; // 1 hour

// An emailed link (Dokumentumok "Email küldése") needs to outlive the
// dashboard session that generated it — the recipient might not open
// their inbox for days.
export const EMAIL_LINK_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Pulls the bare Storage path back out of a stored `.../object/public/
 * <bucket>/<path>`-shaped URL. Returns null for anything not shaped like
 * that (so callers fail soft — an empty/legacy value just renders
 * nothing — rather than requesting a signed URL for a bogus path). */
export function pathFromStoredUrl(storedUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = storedUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(storedUrl.slice(idx + marker.length));
}

/** Resolves one bare Storage path to a signed URL. Every bucket except
 * `documents` stores a getPublicUrl()-shaped string in its row (use
 * resolveSignedUrl for those); `documents.file_path` is the one place
 * that stores the bare path directly, so it calls this straight. */
export async function resolveSignedUrlForPath(
  supabase: SupabaseClient<Database>,
  bucket: string,
  path: string | null | undefined,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Batch version of resolveSignedUrlForPath — one Storage API call for a
 * whole list of bare paths instead of one round-trip per row. Returns a
 * Map keyed by the *original* path, mirroring resolveSignedUrls below. */
export async function resolveSignedUrlsForPaths(
  supabase: SupabaseClient<Database>,
  bucket: string,
  paths: (string | null | undefined)[],
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<Map<string, string>> {
  const validPaths = [...new Set(paths.filter((p): p is string => !!p))];
  const result = new Map<string, string>();
  if (validPaths.length === 0) return result;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(validPaths, expiresIn);
  if (error || !data) return result;
  for (const row of data) {
    if (row.error || !row.signedUrl || !row.path) continue;
    result.set(row.path, row.signedUrl);
  }
  return result;
}

/** Resolves one stored (getPublicUrl()-shaped) URL to a signed one — for
 * one-off spots (a single detail view, an emailed link) where a batch
 * call would be overkill. See resolveSignedUrls below for a whole list
 * at once, and resolveSignedUrlForPath above for a bare path instead of
 * a stored URL (only `documents` needs that form). */
export async function resolveSignedUrl(
  supabase: SupabaseClient<Database>,
  bucket: string,
  storedUrl: string | null | undefined,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<string | null> {
  if (!storedUrl) return null;
  const path = pathFromStoredUrl(storedUrl, bucket);
  return resolveSignedUrlForPath(supabase, bucket, path, expiresIn);
}

/** Batch-resolves every stored URL in one Storage API call instead of
 * one round-trip per row — the right choice whenever a whole list
 * renders at once (Kártya-fájlok, Termékek, Marketing anyagok, …).
 * Returns a Map keyed by the *original* stored URL (not the bare path),
 * so a caller can look a result up with the same value straight off its
 * row (`signedUrls.get(item.image_url)`) without re-deriving anything.
 * Silently skips any input not shaped like a stored URL for this bucket. */
export async function resolveSignedUrls(
  supabase: SupabaseClient<Database>,
  bucket: string,
  storedUrls: (string | null | undefined)[],
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<Map<string, string>> {
  const pathToOriginal = new Map<string, string>();
  for (const url of storedUrls) {
    if (!url) continue;
    const path = pathFromStoredUrl(url, bucket);
    if (path) pathToOriginal.set(path, url);
  }
  const result = new Map<string, string>();
  if (pathToOriginal.size === 0) return result;
  const byPath = await resolveSignedUrlsForPaths(supabase, bucket, [...pathToOriginal.keys()], expiresIn);
  for (const [path, signedUrl] of byPath) {
    const original = pathToOriginal.get(path);
    if (original) result.set(original, signedUrl);
  }
  return result;
}
