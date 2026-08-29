"use client";

import { useState } from "react";
import { FileCode, Plus, Trash2, Eye, EyeOff, Image as ImageIcon } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { EmailTemplate } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";

const STORAGE_BUCKET = "email-assets";
const LOGO_PLACEHOLDER = /YOUR_LOGO_URL/g;

/** d) Email sablonok — raw HTML templates uploaded for campaigns (see
 * EmailCampaignSendForm), stored verbatim in email_templates.html_content.
 * A logo file can be attached at upload time — it's pushed to the
 * email-assets Storage bucket and every YOUR_LOGO_URL placeholder in the
 * HTML is swapped for the real link before the row is ever saved, so the
 * template that ends up in the DB is already send-ready. */
export default function EmailTemplatesSection({
  templates,
  onAdd,
  onDelete,
}: {
  templates: EmailTemplate[];
  onAdd: (template: EmailTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode size={16} className="text-bronze" />
          <h2 className="font-serif text-lg text-forest">Email sablonok</h2>
        </div>
        <button className="btn btn-bronze !px-3 !py-1.5 text-xs" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} /> Új sablon
        </button>
      </div>

      {showForm && (
        <TemplateForm
          onCreated={(t) => {
            onAdd(t);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {templates.length === 0 ? (
        <EmptyState icon={FileCode} title="Még nincs feltöltött sablon" description="Tölts fel egy HTML email sablont a kampányokhoz." />
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((t) => (
            <TemplateRow key={t.id} template={t} onDelete={() => onDelete(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateRow({ template, onDelete }: { template: EmailTemplate; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-forest">{template.name}</p>
          <p className="text-xs text-muted">Feltöltve: {formatDate(template.created_at)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => setExpanded((v) => !v)} className="btn btn-ghost !px-2 text-xs" title="HTML előnézet">
            {expanded ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button onClick={onDelete} className="btn btn-ghost !px-2 text-xs text-muted/70 hover:text-red-600" title="Törlés">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border bg-ivory-dim/50 p-2">
          <iframe title={`${template.name} előnézet`} srcDoc={template.html_content} className="h-64 w-full rounded bg-white" sandbox="" />
        </div>
      )}
    </div>
  );
}

function TemplateForm({
  onCreated,
  onCancel,
}: {
  onCreated: (template: EmailTemplate) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function readHtmlFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setHtmlContent(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !name.trim() || !htmlContent.trim()) {
      setError("Adj meg egy nevet, és tölts fel (vagy illessz be) egy HTML sablont.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let finalHtml = htmlContent;
      if (logoFile) {
        const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `logos/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, logoFile, { upsert: false });
        if (uploadError) throw uploadError;
        const logoUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        finalHtml = finalHtml.replace(LOGO_PLACEHOLDER, logoUrl);
      }

      const { data, error: insertError } = await supabase
        .from("email_templates")
        .insert({ name: name.trim(), html_content: finalHtml })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) onCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni a sablont.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Sablon neve *</label>
        <input className="input" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. Karácsonyi kampány 2026" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">HTML fájl feltöltése</label>
        <input
          type="file"
          accept=".html,text/html"
          className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readHtmlFile(file);
          }}
        />
        <p className="mt-1 text-xs text-muted">
          Vagy illeszd be közvetlenül lent. Használhatod a <code>{"{{first_name}}"}</code> és <code>{"{{unsubscribe_url}}"}</code> helyőrzőket, illetve a{" "}
          <code>YOUR_LOGO_URL</code> szöveget a lenti logó helyén.
        </p>
        <textarea
          className="textarea mt-2 min-h-32 font-mono text-xs"
          value={htmlContent}
          onChange={(e) => setHtmlContent(e.target.value)}
          placeholder="<html>…</html>"
        />
      </div>
      <div>
        <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted">
          <ImageIcon size={13} /> Logó feltöltése (opcionális — lecseréli a YOUR_LOGO_URL helyőrzőt)
        </label>
        <input
          type="file"
          accept="image/*"
          className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
          onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : "Sablon mentése"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Mégse
        </button>
      </div>
    </form>
  );
}
