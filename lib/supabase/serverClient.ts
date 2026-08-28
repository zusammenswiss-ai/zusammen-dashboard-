// Server-only Supabase client, authenticated with the service-role key —
// bypasses Row Level Security entirely. Used ONLY to read/write
// gmail_connection (see supabase/schema.sql), which deliberately has no
// anon RLS policy since it holds an encrypted OAuth refresh token.
//
// NEVER import this file from a "use client" component or anywhere that
// could end up in a browser bundle — SUPABASE_SERVICE_ROLE_KEY is a real
// secret (full read/write access to every table, RLS or not), unlike the
// public anon key used everywhere else in this app. It's only read here,
// server-side, inside API routes under app/api/auth/gmail/ and
// lib/email/gmail-sender.ts.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ServerDatabase } from "./types";

let client: SupabaseClient<ServerDatabase> | null = null;

export function getSupabaseServiceClient(): SupabaseClient<ServerDatabase> | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }
  if (!client) {
    client = createClient<ServerDatabase>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}
