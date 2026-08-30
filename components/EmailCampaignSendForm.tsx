"use client";

import { useEffect, useState } from "react";
import { Send, Eye, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { EmailTemplate, MarketingContent } from "@/lib/supabase/types";

type Audience = "demand" | "newsletter";

type PreviewData = {
  recipient: { email: string; name: string | null };
  isSample: boolean;
  subject: string;
  html: string;
};

/** e) Email kampány küldése — sablon + tárgy + címzett-kör(ök) kiválasztása,
 * "Előnézet" (a tényleges első címzett valós adataival kitöltve, a
 * /api/marketing/preview-campaign route-on keresztül, ami ugyanazt a
 * lib/email-campaign.ts-beli recipient-feloldást és personalizeTemplate-et
 * futtatja, mint a valódi küldés — így az előnézet garantáltan ugyanazt
 * mutatja, mint ami kimegy), és "Küldés", ami ténylegesen kimegy a Brevo
 * API-n keresztül (app/api/marketing/send-campaign). */
export default function EmailCampaignSendForm({
  templates,
  demandCount,
  newsletterCount,
  onSent,
  presetTemplateId,
}: {
  templates: EmailTemplate[];
  demandCount: number;
  newsletterCount: number;
  onSent: (contentItem: MarketingContent) => void;
  // Set by EmailTemplatesSection's "Kampányhoz csatolás" button so
  // picking a sablon up there jumps straight into this form pre-selected
  // instead of making the founder find it again in the dropdown.
  presetTemplateId?: string | null;
}) {
  const [brevoConfigured, setBrevoConfigured] = useState<boolean | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [audiences, setAudiences] = useState<Set<Audience>>(new Set());
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/marketing/brevo-status")
      .then((res) => res.json())
      .then((data: { configured: boolean }) => setBrevoConfigured(data.configured))
      .catch(() => setBrevoConfigured(false));
  }, []);

  useEffect(() => {
    if (presetTemplateId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTemplateId(presetTemplateId);
    }
  }, [presetTemplateId]);

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const totalRecipients =
    (audiences.has("demand") ? demandCount : 0) + (audiences.has("newsletter") ? newsletterCount : 0);

  function toggleAudience(a: Audience) {
    setAudiences((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  async function openPreview() {
    if (!templateId) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/marketing/preview-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, subject, audiences: Array.from(audiences) }),
      });
      const data = await res.json();
      if (data.ok) setPreview(data);
      else setPreviewError(data.error || "Nem sikerült előnézetet készíteni.");
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Hálózati hiba az előnézet közben.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function send() {
    if (!templateId || !subject.trim() || audiences.size === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/marketing/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, subject: subject.trim(), audiences: Array.from(audiences) }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, message: `${data.sent} email sikeresen kiküldve.${data.failed ? ` (${data.failed} sikertelen.)` : ""}` });
        if (data.contentItem) onSent(data.contentItem);
        setSubject("");
        setAudiences(new Set());
      } else {
        setResult({ ok: false, message: data.error || `Nem sikerült kiküldeni (${data.failed ?? "?"} hiba).` });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Hálózati hiba a küldés közben." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Send size={16} className="text-bronze" />
        <h2 className="font-serif text-lg text-forest">Email kampány küldése</h2>
      </div>

      {brevoConfigured === false && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>
            Brevo nincs beállítva — a <code>BREVO_API_KEY</code> szerver környezeti változó hiányzik. Kérj egy API
            kulcsot a founder-től (Brevo → Settings → SMTP &amp; API), és állítsd be Vercelen. Addig az Előnézet
            működik, a Küldés nem.
          </span>
        </div>
      )}

      {templates.length === 0 ? (
        <p className="text-sm text-muted">Előbb tölts fel egy email sablont fent.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Sablon *</label>
            <select className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Válassz sablont…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Tárgy *</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="pl. Ünnepi ajánlatunk neked, {{first_name}}!" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Kinek menjen ki *</label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-sm text-forest">
                <input type="checkbox" checked={audiences.has("demand")} onChange={() => toggleAudience("demand")} />
                Demand-test feliratkozók ({demandCount})
              </label>
              <label className="flex items-center gap-1.5 text-sm text-forest">
                <input type="checkbox" checked={audiences.has("newsletter")} onChange={() => toggleAudience("newsletter")} />
                Hírlevél feliratkozók ({newsletterCount})
              </label>
            </div>
            {audiences.size > 0 && (
              <p className="mt-1 text-xs text-muted">
                Kb. {totalRecipients} címzett (a duplikált email címek és a leiratkozottak automatikusan kiszűrve).
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!selectedTemplate || audiences.size === 0 || previewLoading}
              onClick={openPreview}
              title={audiences.size === 0 ? "Előbb válaszd ki, kinek menjen ki, hogy valós feliratkozó adataival tudjunk előnézetet mutatni" : undefined}
            >
              <Eye size={15} /> {previewLoading ? "Betöltés…" : "Előnézet"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={sending || !templateId || !subject.trim() || audiences.size === 0 || brevoConfigured === false}
              onClick={send}
            >
              <Send size={15} /> {sending ? "Küldés…" : "Küldés"}
            </button>
          </div>
          {previewError && <p className="text-xs text-red-600">{previewError}</p>}

          {result && (
            <div
              className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                result.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
              }`}
            >
              {result.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}
              <span>{result.message}</span>
            </div>
          )}
        </div>
      )}

      {preview && <PreviewModal preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function PreviewModal({ preview, onClose }: { preview: PreviewData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">
              {preview.isSample
                ? "Előnézet — minta adatokkal (még nincs valós feliratkozó a kiválasztott körben)"
                : `Előnézet — valós feliratkozó: ${preview.recipient.name ? `${preview.recipient.name} · ` : ""}${preview.recipient.email}`}
            </p>
            <p className="font-serif text-lg text-forest">{preview.subject || "(nincs tárgy megadva)"}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost !px-2">
            <X size={16} />
          </button>
        </div>
        <iframe title="Sablon előnézet" srcDoc={preview.html} className="min-h-[50vh] w-full flex-1" sandbox="" />
      </div>
    </div>
  );
}
