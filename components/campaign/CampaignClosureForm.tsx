"use client";

import { useEffect, useState } from "react";
import { NotebookPen, Check } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign } from "@/lib/supabase/types";
import CollapsibleSection from "@/components/CollapsibleSection";
import { usePersistedOpen } from "@/lib/usePersistedOpen";

/** Lezárási összegzés — amikor egy kampány állapota "Lezárva"-ra vált,
 * ez a kártya jelenik meg (a kampány részletoldal tetején, a fülek
 * fölött), hogy a founder rögtön, frissen rögzíthesse, mi működött és mi
 * nem — a későbbi visszanézéshez. autoOpen: a szülő (kampány oldal)
 * állítja true-ra közvetlenül a "Lezárva"-ra váltás után, hogy a kártya
 * azonnal nyitva legyen, ne kelljen külön rákattintani. */
export default function CampaignClosureForm({
  campaign,
  onSaved,
  autoOpen,
  onAutoOpenDone,
}: {
  campaign: Campaign;
  onSaved: (campaign: Campaign) => void;
  autoOpen?: boolean;
  onAutoOpenDone?: () => void;
}) {
  const [open, setOpen] = usePersistedOpen(`zusammen-collapsed-campaign-closure-${campaign.id}`, false);
  const [whatWorked, setWhatWorked] = useState(campaign.retrospective_what_worked ?? "");
  const [whatNot, setWhatNot] = useState(campaign.retrospective_what_not ?? "");
  const [lesson, setLesson] = useState(campaign.retrospective_lesson ?? "");
  const [nextStep, setNextStep] = useState(campaign.retrospective_next_step ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
      onAutoOpenDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const hasContent = Boolean(
    campaign.retrospective_what_worked ||
      campaign.retrospective_what_not ||
      campaign.retrospective_lesson ||
      campaign.retrospective_next_step
  );

  async function save() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("campaigns")
      .update({
        retrospective_what_worked: whatWorked.trim() || null,
        retrospective_what_not: whatNot.trim() || null,
        retrospective_lesson: lesson.trim() || null,
        retrospective_next_step: nextStep.trim() || null,
      })
      .eq("id", campaign.id)
      .select()
      .single();
    setSaving(false);
    if (!error && data) {
      onSaved(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div className="card mb-6 border-bronze/30 p-5">
      <CollapsibleSection
        title={
          <h2 className="flex items-center gap-2 font-serif text-lg text-forest">
            <NotebookPen size={16} className="text-bronze" /> Lezárási összegzés
          </h2>
        }
        right={!hasContent && <span className="badge bg-bronze/15 text-walnut">Kitöltendő</span>}
        open={open}
        onOpenChange={setOpen}
        headerClassName="mb-3"
      >
        <p className="mb-3 text-xs text-muted">
          Ez segít később visszanézni, mit érdemes megismételni, és mit másképp csinálni legközelebb.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Mi működött?</label>
            <textarea className="textarea min-h-20" value={whatWorked} onChange={(e) => setWhatWorked(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Mi nem működött?</label>
            <textarea className="textarea min-h-20" value={whatNot} onChange={(e) => setWhatNot(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Tanulság</label>
            <textarea className="textarea min-h-20" value={lesson} onChange={(e) => setLesson(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Következő lépés</label>
            <textarea className="textarea min-h-20" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? "Mentés…" : "Összegzés mentése"}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-forest">
              <Check size={13} /> Mentve
            </span>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}
