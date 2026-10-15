"use client";

import { useState } from "react";
import { X, FlaskConical, Sun, FileQuestion } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Campaign, CampaignType, Season } from "@/lib/supabase/types";
import { CAMPAIGN_TYPES, SEASON_HU } from "@/lib/labels";
import { slugify } from "@/lib/slug";
import { errorMessage } from "@/lib/errors";

const SEASON_ORDER: Season[] = ["Spring", "Summer", "Autumn", "Winter"];

type TemplateKey = "product_test" | "seasonal" | "blank";

const TEMPLATES: {
  key: TemplateKey;
  label: string;
  description: string;
  icon: typeof FlaskConical;
  defaultType: CampaignType;
  tasks: string[];
}[] = [
  {
    key: "product_test",
    label: "Terméktesztelés",
    description: "Kis kör élő termékteszt — landing oldal, email-sablonok, személyes megkeresés, heti mérés.",
    icon: FlaskConical,
    defaultType: "First 20",
    tasks: [
      "Landing oldal élesítése",
      "E-mail sablonok elkészítése (Brevo)",
      "Készlet-PDF-ek feltöltése",
      "Személyes megkeresés",
      "Instagram-posztok",
      "Heti mérés",
      "Összegzés",
    ],
  },
  {
    key: "seasonal",
    label: "Szezonális kampány",
    description: "Egy évszakhoz kötött push — stratégiától az utólagos értékelésig.",
    icon: Sun,
    defaultType: "Szezonális",
    tasks: [
      "Stratégia és cél meghatározása",
      "Vizuálok elkészítése",
      "Tartalom-naptár összeállítása",
      "E-mail sorozat megírása",
      "Indítás",
      "Mérés",
      "Utólagos értékelés",
    ],
  },
  {
    key: "blank",
    label: "Üres kampány",
    description: "Kezdj a nulláról, saját feladatokkal.",
    icon: FileQuestion,
    defaultType: "Egyéb",
    tasks: [],
  },
];

/** "+ Új kampány" — sablonválasztás (alapfeladatokkal) + a kampány alap
 * mezői. A sablon alapfeladatai a létrehozás után azonnal felkerülnek a
 * kampányhoz (tasks.campaign_id), ugyanúgy, mintha kézzel vette volna
 * fel őket a founder — utána szabadon szerkeszthetők/törölhetők. */
export default function NewCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: (campaign: Campaign) => void }) {
  const [step, setStep] = useState<"template" | "details">("template");
  const [templateKey, setTemplateKey] = useState<TemplateKey>("blank");
  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("Egyéb");
  const [season, setSeason] = useState<Season | "">("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickTemplate(key: TemplateKey) {
    setTemplateKey(key);
    const template = TEMPLATES.find((t) => t.key === key);
    if (template) setType(template.defaultType);
    setStep("details");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { data: created, error: insertError } = await supabase
        .from("campaigns")
        .insert({
          name: name.trim(),
          slug: slugify(name),
          type,
          season: season || null,
          goal: goal.trim() || null,
          start_date: startDate || null,
          end_date: endDate || null,
          status: "Ötlet",
        })
        .select()
        .single();
      if (insertError) throw insertError;
      if (!created) throw new Error("Nem sikerült létrehozni a kampányt.");

      const template = TEMPLATES.find((t) => t.key === templateKey);
      if (template && template.tasks.length > 0) {
        const { error: tasksError } = await supabase.from("tasks").insert(
          template.tasks.map((title) => ({
            title,
            category: "Marketing",
            task_type: "Kampány" as const,
            campaign_id: created.id,
          }))
        );
        if (tasksError) throw tasksError;
      }
      onCreated(created);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült létrehozni a kampányt."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]" onClick={onClose}>
      <div className="animate-fade-in card flex max-h-full w-full max-w-lg flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-serif text-lg text-forest">Új kampány</h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>

        {step === "template" ? (
          <div className="flex flex-col gap-2 p-5">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => pickTemplate(t.key)}
                className="flex items-start gap-3 rounded-lg border border-border p-4 text-left hover:border-bronze/50 hover:bg-ivory-dim/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bronze/15 text-bronze">
                  <t.icon size={17} />
                </span>
                <span>
                  <span className="block font-medium text-forest">{t.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{t.description}</span>
                  {t.tasks.length > 0 && (
                    <span className="mt-1 block text-[11px] text-muted/80">{t.tasks.length} alapfeladattal indul</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Kampány neve *</label>
                <input className="input" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder='pl. "Karácsonyi ajándékcsomagok"' />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
                  <select className="select" value={type} onChange={(e) => setType(e.target.value as CampaignType)}>
                    {CAMPAIGN_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Évszak</label>
                  <select className="select" value={season} onChange={(e) => setSeason(e.target.value as Season | "")}>
                    <option value="">Nincs</option>
                    {SEASON_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {SEASON_HU[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Cél</label>
                <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="pl. 20 jelentkező 7 nap alatt" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Kezdés</label>
                  <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Vége</label>
                  <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex gap-2 border-t border-border p-4">
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Létrehozás…" : "Kampány létrehozása"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setStep("template")}>
                Vissza
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
