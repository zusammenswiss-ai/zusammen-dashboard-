"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Mail, ScrollText } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { landingT } from "@/lib/landing-i18n";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";

// The /landing survey stores answers as whatever language the visitor was
// using (German or English option text) — these canonical Hungarian
// labels let German and English answers to the same question merge into
// one bucket instead of showing up as separate look-alike rows.
const BUY_HU = ["Igen, azonnal", "Talán, attól függ", "Valószínűleg nem"];
const PRICE_HU = ["20 CHF alatt", "20–35 CHF", "35–50 CHF", "50 CHF felett"];
const BOX_ITEM_HU: Record<string, string> = {
  "travel-pouch": "Travel Pouch",
  "memory-cards": "Memory Cards",
  "connection-passport": "Connection Passport",
  "wax-seal-kit": "Viaszpecsétes levélkészlet",
  "premium-pen": "Prémium toll",
};

function canonicalLabel(raw: string, deOptions: string[], enOptions: string[], huLabels: string[]): string {
  const deIdx = deOptions.indexOf(raw);
  if (deIdx >= 0) return huLabels[deIdx];
  const enIdx = enOptions.indexOf(raw);
  if (enIdx >= 0) return huLabels[enIdx];
  return raw;
}

type Stats = {
  totalResponses: number;
  letterCount: number;
  buyCounts: Record<string, number>;
  priceCounts: Record<string, number>;
  boxCounts: Record<string, number>;
  ideas: string[];
  emails: string[];
};

export default function DemandPage() {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [responsesRes, lettersRes] = await Promise.all([
      supabase.from("landing_responses").select("*"),
      supabase.from("landing_letters").select("id"),
    ]);
    if (responsesRes.error) {
      setError(responsesRes.error.message);
      setLoading(false);
      return;
    }

    const records = responsesRes.data ?? [];
    const buyCounts: Record<string, number> = {};
    const priceCounts: Record<string, number> = {};
    const boxCounts: Record<string, number> = {};
    const ideas: string[] = [];
    const emails: string[] = [];

    for (const r of records) {
      if (r.would_buy) {
        const label = canonicalLabel(r.would_buy, landingT.de.survey.q1Options, landingT.en.survey.q1Options, BUY_HU);
        buyCounts[label] = (buyCounts[label] ?? 0) + 1;
      }
      if (r.price_range) {
        const label = canonicalLabel(
          r.price_range,
          landingT.de.survey.q2Options,
          landingT.en.survey.q2Options,
          PRICE_HU
        );
        priceCounts[label] = (priceCounts[label] ?? 0) + 1;
      }
      if (r.idea) ideas.push(r.idea);
      if (r.email) emails.push(r.email);
      for (const key of r.box_items ?? []) {
        const label = BOX_ITEM_HU[key] ?? key;
        boxCounts[label] = (boxCounts[label] ?? 0) + 1;
      }
    }

    setStats({
      totalResponses: records.length,
      letterCount: lettersRes.data?.length ?? 0,
      buyCounts,
      priceCounts,
      boxCounts,
      ideas,
      emails,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isSupabaseConfigured) void load();
  }, [load]);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Igényfelmérés" />
        <EmptyState icon={ClipboardList} title="Csatlakoztasd a Supabase-t az igényfelmérés megtekintéséhez" />
      </>
    );
  }

  const hasData = !!stats && (stats.totalResponses > 0 || stats.letterCount > 0);

  return (
    <>
      <PageHeader
        title="Igényfelmérés"
        subtitle="Élő visszajelzések a /landing oldal látogatóitól — kérdőív-válaszok és Gold Card levelek."
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : !stats || !hasData ? (
        <EmptyState
          icon={ClipboardList}
          title="Még nincs visszajelzés"
          description="Amint valaki kitölti a /landing oldal kérdőívét vagy megír egy Gold Card levelet, itt fog megjelenni."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={ClipboardList} label="Kitöltött kérdőívek" value={stats.totalResponses} />
            <StatCard icon={Mail} label="Megadott emailek" value={stats.emails.length} />
            <StatCard icon={ScrollText} label="Megírt Gold Card levelek" value={stats.letterCount} />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BarSection title="Megvennéd?" counts={stats.buyCounts} order={BUY_HU} />
            <BarSection title="Árérzékenység" counts={stats.priceCounts} order={PRICE_HU} />
          </div>

          {Object.keys(stats.boxCounts).length > 0 && (
            <div className="mt-6">
              <BarSection title="Mit szeretnének látni a csomagban" counts={stats.boxCounts} />
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="font-serif text-lg text-forest">Ötletek, amiket írtak</h2>
              {stats.ideas.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Még senki nem írt szabad szöveges ötletet.</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-border">
                  {stats.ideas.map((idea, i) => (
                    <li key={i} className="py-2.5 text-sm text-forest">
                      {idea}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-5">
              <h2 className="font-serif text-lg text-forest">Megadott emailek</h2>
              {stats.emails.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Még senki nem adott meg emailt.</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-border">
                  {stats.emails.map((email, i) => (
                    <li key={i} className="py-2.5 text-sm text-forest">
                      {email}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function BarSection({
  title,
  counts,
  order,
}: {
  title: string;
  counts: Record<string, number>;
  order?: string[];
}) {
  const entries = Object.entries(counts);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const rows = order
    ? order.filter((k) => counts[k] !== undefined).map((k) => [k, counts[k]] as const)
    : entries.sort((a, b) => b[1] - a[1]);

  return (
    <div className="card p-5">
      <h2 className="font-serif text-lg text-forest">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Még nincs adat.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-forest">{label}</span>
                <span className="text-muted">{value}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ivory-dim">
                <div
                  className="h-full rounded-full bg-bronze"
                  style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
