"use client";

import { useEffect, useState } from "react";
import { Send, Eye, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { EmailTemplate, MarketingContent } from "@/lib/supabase/types";
import { personalizeTemplate } from "@/lib/email-campaign";

type Audience = "demand" | "newsletter";

/** e) Email kampány küldése — sablon + tárgy + címzett-kör(ök) kiválasztása,
 * "Előnézet" (kitöltött sablon egy teszt névvel, ugyanazzal a
 * personalizeTemplate függvénnyel, mint amit a valódi küldés is használ —
 * lásd lib/email-campaign.ts), és "Küldés", ami ténylegesen kimegy a
 * Brevo API-n keresztül (app/api/marketing/send-campaign). */
export default function EmailCampaignSendForm({
  templates,
  demandCount,
  newsletterCount,
  onSent,
}: {
  templates: EmailTemplate[];
  demandCount: number;
  newsletterCount: number;
  onSent: (contentItem: MarketingContent) => void;
}) {
  const [brevoConfigured, setBrevoConfigured] = useState<boolean | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [audiences, setAudiences] = useState<Set<Audience>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/marketing/brevo-status")
      .then((res) => res.json())
      .then((data: { configured: boolean }) => setBrevoConfigured(data.configured))
      .catch(() => setBrevoConfigured(false));
  }, []);

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
              disabled={!selectedTemplate}
              onClick={() => setPreviewOpen(true)}
            >
              <Eye size={15} /> Előnézet
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

      {previewOpen && selectedTemplate && (
        <PreviewModal
          subject={subject}
          html={personalizeTemplate(selectedTemplate.html_content, { firstName: "Éva", unsubscribeUrl: "#" })}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function PreviewModal({ subject, html, onClose }: { subject: string; html: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted">Előnézet — teszt névvel (Éva)</p>
            <p className="font-serif text-lg text-forest">{subject || "(nincs tárgy megadva)"}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost !px-2">
            <X size={16} />
          </button>
        </div>
        <iframe title="Sablon előnézet" srcDoc={html} className="min-h-[50vh] w-full flex-1" sandbox="" />
      </div>
    </div>
  );
}
