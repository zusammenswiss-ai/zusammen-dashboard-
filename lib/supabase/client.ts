"use client";

// Note: @supabase/supabase-js is pinned to an exact version in package.json.
// Versions beyond ~2.5x have a type-generation regression that breaks
// generic table typing (select/insert/update all resolve to `never`) once a
// Database type declares more than one table. Don't bump it with `^`/`~`
// without re-checking `npx tsc --noEmit` against a multi-table schema first.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient<Database> | null = null;

/**
 * Lazily creates a single browser Supabase client instance.
 * Returns null if env vars are missing so pages can render a helpful
 * "not configured yet" message instead of crashing at build time.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  if (!client) {
    client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
