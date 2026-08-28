"use client";

import { useState } from "react";
import { ShieldAlert, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ANON_TABLE_NAMES } from "@/lib/supabase/types";
import { ErrorBanner } from "@/components/Feedback";

const CONFIRM_WORD = "TÖRLÉS";

// Kept out of the wipe — see lib/supabase/types.ts's ANON_TABLE_NAMES
// comment. together_settings holds the Közös tér access code and
// company_settings is the Márka-adatok/Email-aláírás/Pénznem row this
// very page just configured — wiping either as part of "delete my
// business data" would be a surprising, self-defeating side effect.
const KEPT_TABLES = new Set(["together_settings", "company_settings"]);
const WIPE_TABLES = ANON_TABLE_NAMES.filter((t) => !KEPT_TABLES.has(t));

/**
 * "Minden adat törlése" — deletes every row from every founder-entered
 * business/content table (see WIPE_TABLES above), keeping only account-
 * level config (Gmail connection — already excluded since it isn't in
 * ANON_TABLE_NAMES at all — Közös tér code, Márka-adatok). One exception
 * inside the loop: marketing_campaigns is the fixed 4-season config seeded
 * by schema.sql (unique per season), not founder-created rows, so instead
 * of deleting those rows this clears their editable text back to empty
 * rather than leaving the Marketing page's Évszakos stratégia tab broken.
 */
export default function DangerZoneSection() {
  const supabase = getSupabaseClient();
  const [expanded, setExpanded] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canConfirm = confirmText.trim() === CONFIRM_WORD;

  function cancel() {
    setExpanded(false);
    setConfirmText("");
    setError(null);
  }

  async function deleteEverything() {
    if (!supabase || !canConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      for (const table of WIPE_TABLES) {
        if (table === "marketing_campaigns") {
          const { error: resetError } = await supabase
            .from("marketing_campaigns")
            .update({ theme: null, product_focus: null });
          if (resetError) throw new Error(`${table}: ${resetError.message}`);
          continue;
        }
        const { error: deleteError } = await supabase.from(table).delete();
        if (deleteError) throw new Error(`${table}: ${deleteError.message}`);
      }
      setExpanded(false);
      setConfirmText("");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült törölni minden adatot.");
    } finally {
      setDeleting(false);
    }
  }

  // Inline borderColor, not a border-red-* Tailwind class — .card's own
  // `border: 1px solid var(--border)` shorthand is defined later in
  // globals.css than Tailwind's utilities, so a same-specificity utility
  // class loses that cascade tie and never visibly applies.
  return (
    <div className="card max-w-xl p-5 sm:p-6" style={{ borderColor: "#fecaca" }}>
      <div className="flex items-center gap-2">
        <ShieldAlert size={18} className="text-red-600" />
        <h2 className="font-serif text-lg text-red-700">Veszélyes zóna</h2>
      </div>
      <p className="mt-1.5 text-sm text-muted">
        Minden üzleti és tartalmi adat (Beszállítók, Feladatok, Megrendelések, Pénzügyek, Marketing-tartalom,
        Dokumentumok, Kártya-fájlok, Jövőbeli tervek, Igényfelmérés-válaszok, Megosztások, Személyes rituálé
        bejegyzések) véglegesen törlődik. A Gmail-összekapcsolás, a Közös tér kódja és a Márka-adatok megmaradnak.
        Ez nem vonható vissza — érdemes előbb exportálni fentebb.
      </p>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {done && (
        <p className="mt-4 rounded-lg bg-forest/5 px-3 py-2 text-sm text-forest">Minden adat törölve.</p>
      )}

      {!expanded ? (
        <button type="button" onClick={() => setExpanded(true)} className="btn btn-danger mt-4 w-fit">
          <Trash2 size={15} /> Minden adat törlése
        </button>
      ) : (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">
            A megerősítéshez írd be pontosan: <span className="font-mono font-semibold">{CONFIRM_WORD}</span>
          </p>
          <input
            className="input"
            style={{ borderColor: "#fca5a5" }}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={deleteEverything}
              disabled={!canConfirm || deleting}
              className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={15} /> {deleting ? "Törlés folyamatban…" : "Végleges, visszavonhatatlan törlés"}
            </button>
            <button type="button" onClick={cancel} disabled={deleting} className="btn btn-ghost">
              Mégse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
