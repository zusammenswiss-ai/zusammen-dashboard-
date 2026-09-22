"use client";

import { useEffect, useState } from "react";
import { Download, Check, Upload } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardExportVersion, CardTemplate } from "@/lib/supabase/types";
import { resolveSignedUrls } from "@/lib/signed-storage-url";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

const STORAGE_BUCKET = "card-designer";

const KIND_LABELS: Record<CardExportVersion["kind"], string> = {
  fronts_only: "Csak előlapok",
  front_back_pairs: "Előlap+hátlap",
};

function byRecency(a: CardExportVersion, b: CardExportVersion) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/** Verzió-előzmény — minden Exportálás egy dátumozott sort hagy itt,
 * sosem vész el (lásd ExportPanel + schema.sql card_export_versions
 * komment). Letöltés + "Gyártónak elküldve" jelölés kártyánként. */
export default function VersionHistoryList({
  versions,
  templates,
  onVersionsChange,
}: {
  versions: CardExportVersion[];
  templates: CardTemplate[];
  onVersionsChange: (next: CardExportVersion[]) => void;
}) {
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const templateById = new Map(templates.map((t) => [t.id, t]));

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || versions.length === 0) return;
    resolveSignedUrls(
      supabase,
      STORAGE_BUCKET,
      versions.map((v) => v.file_url)
    ).then(setSignedUrls);
  }, [versions]);

  async function toggleSent(version: CardExportVersion) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const nextSent = !version.sent_to_manufacturer;
    const { data, error: updateError } = await supabase
      .from("card_export_versions")
      .update({ sent_to_manufacturer: nextSent, sent_at: nextSent ? new Date().toISOString().slice(0, 10) : null })
      .eq("id", version.id)
      .select()
      .single();
    if (updateError) {
      setError(errorMessage(updateError, "Nem sikerült frissíteni a küldés-állapotot."));
      return;
    }
    if (data) onVersionsChange(versions.map((v) => (v.id === data.id ? data : v)));
  }

  const sorted = [...versions].sort(byRecency);

  if (sorted.length === 0) {
    return (
      <p className="text-xs text-muted">
        Még nincs egyetlen export sem — az &quot;Exportálás indítása&quot; gomb hozza létre az első verziót.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {sorted.map((v) => {
        const signedUrl = signedUrls.get(v.file_url);
        const template = v.template_id ? templateById.get(v.template_id) : undefined;
        return (
          <div
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="badge bg-ivory-dim text-walnut">{v.language}</span>
                <span className="badge bg-ivory-dim text-walnut">{KIND_LABELS[v.kind]}</span>
                <span className="badge bg-bronze/10 text-walnut">{v.format.toUpperCase()}</span>
                <span className="badge bg-ivory-dim text-walnut">{v.card_count} kártya</span>
                {template && <span className="badge bg-ivory-dim text-walnut">{template.name}</span>}
                {v.source === "manual_upload" && (
                  <span className="badge flex items-center gap-1 bg-walnut/15 text-walnut">
                    <Upload size={10} /> Kézi feltöltés
                  </span>
                )}
                {v.sent_to_manufacturer && (
                  <span className="badge bg-forest/10 text-forest">
                    Gyártónak elküldve{v.sent_at ? ` — ${formatDate(v.sent_at)}` : ""}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">{formatDate(v.created_at)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => void toggleSent(v)} className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
                <Check size={13} /> {v.sent_to_manufacturer ? "Küldés visszavonása" : "Gyártónak elküldve"}
              </button>
              {signedUrl ? (
                <a href={signedUrl} download className="btn btn-ghost !px-2.5 !py-1.5 text-xs">
                  <Download size={13} /> Letöltés
                </a>
              ) : (
                <span className="btn btn-ghost !px-2.5 !py-1.5 text-xs opacity-50">
                  <Download size={13} /> Letöltés
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
