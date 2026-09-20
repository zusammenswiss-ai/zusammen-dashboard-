// Plain anon-key Supabase client for public, unauthenticated Server
// Component reads — e.g. app/impresszum, app/adatvedelem, and
// app/landing's own legal-links fetch. No cookies, no session; relies
// entirely on the table's own "public read" RLS policy (see
// legal_documents in supabase/schema.sql). Distinct from serverClient.ts
// (service-role, bypasses RLS entirely, must stay server-secret-only)
// and from client.ts (the browser client, needs cookies for an
// authenticated session) — this one is safe to call from any Server
// Component since it only ever has the same read access a logged-out
// /landing visitor already gets via the anon key baked into the public
// JS bundle anyway.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function getSupabasePublicClient(): SupabaseClient<Database> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createClient<Database>(supabaseUrl, anonKey, { auth: { persistSession: false } });
}
