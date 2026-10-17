"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

const STALE_AFTER_MS = 5 * 60 * 1000;

/** "Frissítés" gomb + automata szinkron, ha az utolsó szinkron 5 percnél
 * régebbi (feladat 3. pont, "Mikor fut" bullet). A mail_sync_state
 * táblát közvetlenül, a böngésző Supabase-klienssel olvassa (authenticated
 * read RLS, lásd supabase/schema.sql) — magát a szinkront a service-role
 * oldali /api/mail/sync route végzi. Egyelőre csak egy státusz-sor, a
 * teljes levéllista (Postaláda fül) egy következő fázisban épül rá. */
export default function MailSyncButton() {
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const supabase = getSupabaseClient();

  const loadLastSync = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("mail_sync_state").select("last_synced_at").order("last_synced_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
    setLastSyncedAt(data?.last_synced_at ?? null);
  }, [supabase]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/mail/sync", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "A szinkron nem futott le.");
      const totalProcessed = (data.summaries ?? []).reduce(
        (sum: number, s: { folders: { processed: number }[] }) => sum + s.folders.reduce((fs: number, f: { processed: number }) => fs + f.processed, 0),
        0
      );
      const errors = (data.summaries ?? []).flatMap((s: { accountName: string; folders: { folder: string; error: string | null }[] }) =>
        s.folders.filter((f) => f.error).map((f) => `${s.accountName} (${f.folder}): ${f.error}`)
      );
      setLastResult(errors.length > 0 ? `${totalProcessed} új levél — hiba: ${errors.join("; ")}` : `${totalProcessed} új levél feldolgozva.`);
      await loadLastSync();
    } catch (err) {
      setError(errorMessage(err, "A szinkron nem futott le."));
    } finally {
      setSyncing(false);
    }
  }, [loadLastSync]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLastSync();
  }, [loadLastSync]);

  useEffect(() => {
    if (lastSyncedAt === undefined) return; // még nem töltöttük be
    const stale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > STALE_AFTER_MS;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stale) void runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncedAt]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={() => void runSync()} disabled={syncing} className="btn btn-ghost">
        {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Frissítés
      </button>
      <p className="text-[11px] text-muted">
        {lastSyncedAt ? `Utolsó szinkron: ${formatDate(lastSyncedAt)}` : lastSyncedAt === null ? "Még nem volt szinkron" : ""}
      </p>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      {!error && lastResult && <p className="text-[11px] text-muted">{lastResult}</p>}
    </div>
  );
}
