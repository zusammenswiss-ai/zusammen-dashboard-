// Postafiók — szál feloldás/létrehozás. Szerver-only (service-role
// kliens). Phase 3: csak a First 20 jelentkezőhöz kötött, kézi/kampány-
// eredetű szál-feloldás készül itt — a bejövő levelek szabály-alapú
// besorolása (mail_rules) egy következő fázisban (IMAP-szinkron) épül
// erre rá.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServerDatabase } from "@/lib/supabase/types";

/** Megkeresi a jelentkezőhöz már létező, MÉG NEM lezárt szálat
 * (mail_thread_links entity_type='signup'), vagy létrehoz egy újat
 * "marketing" területtel, ha nincs. Egy jelentkezőhöz így egyetlen
 * folyamatos szál tartozik a Készlet/Emlékeztető/Visszajelzés-kérés/
 * Rendelés-visszaigazolás leveleken át — ez felel meg a feladat "a
 * jelentkező részletnézetének E-mailek szakaszában... egy szálban
 * látszanak" követelményének. Ha a szál korábban "Kész"-re lett zárva,
 * egy új kimenő levél (akárcsak egy bejövő válasz, 5/B/c pont) újra
 * megnyitja. */
export async function findOrCreateSignupThread(
  supabase: SupabaseClient<ServerDatabase>,
  signupId: string,
  subject: string
): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  const { data: links, error: linksError } = await supabase
    .from("mail_thread_links")
    .select("thread_id")
    .eq("entity_type", "signup")
    .eq("entity_id", signupId);
  if (linksError) return { ok: false, error: linksError.message };

  const threadIds = (links ?? []).map((l) => l.thread_id);
  if (threadIds.length > 0) {
    const { data: threads, error: threadsError } = await supabase
      .from("mail_threads")
      .select("id, status")
      .in("id", threadIds)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (threadsError) return { ok: false, error: threadsError.message };
    const open = threads?.find((t) => t.status !== "done") ?? threads?.[0];
    if (open) {
      if (open.status === "done") {
        await supabase.from("mail_threads").update({ status: "in_progress", closed_at: null, closed_by: null }).eq("id", open.id);
        await supabase.from("mail_activity").insert({ thread_id: open.id, actor: "system", action: "reopened", detail: { reason: "new_outgoing_message" } });
      }
      return { ok: true, threadId: open.id };
    }
  }

  const { data: newThread, error: createError } = await supabase
    .from("mail_threads")
    .insert({ subject, area: "marketing", area_is_manual: false, status: "in_progress" })
    .select("id")
    .single();
  if (createError || !newThread) return { ok: false, error: createError?.message || "Nem sikerült szálat létrehozni." };

  const { error: linkError } = await supabase
    .from("mail_thread_links")
    .insert({ thread_id: newThread.id, entity_type: "signup", entity_id: signupId });
  if (linkError) return { ok: false, error: linkError.message };

  await supabase.from("mail_activity").insert({ thread_id: newThread.id, actor: "system", action: "created", detail: { source: "first20_signup", signup_id: signupId } });

  return { ok: true, threadId: newThread.id };
}
