import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanySettings, CurrencyCode, Database } from "@/lib/supabase/types";

// Fallback used wherever email_signature is empty — both by the
// EmailSignatureCard's placeholder and by /api/send-email, which
// appends the real (or this default) signature to every send. Kept in
// exactly one place so the two can't disagree about what "default"
// means.
export const DEFAULT_EMAIL_SIGNATURE = "Zusammen — Where conversations become memories.";
export const DEFAULT_CURRENCY: CurrencyCode = "CHF";

/**
 * Reads the company_settings singleton row (or null if it hasn't been
 * created yet — every consumer treats that the same as "all defaults").
 * Generic over the client so both the browser (anon key) client used by
 * Beállítások/Naptár/Áttekintés/Pénzügyek and the server-side anon
 * client built inline in /api/send-email (see that route for why it's
 * not lib/supabase/client.ts) can share this one query.
 */
export async function getCompanySettings(
  supabase: SupabaseClient<Database>
): Promise<CompanySettings | null> {
  const { data } = await supabase
    .from("company_settings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
