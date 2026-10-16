"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Download, FileText } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { First20Signup, Document } from "@/lib/supabase/types";
import { resolveSignedUrlsForPaths } from "@/lib/signed-storage-url";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/errors";

const DOCUMENTS_BUCKET = "documents";
const DOCUMENT_TYPES = ["Számla", "Levelezés", "Egyéb"];

/** Dokumentumok fül — ugyanaz a feltöltési minta, mint a kampány
 * Dokumentumok füle (CampaignDocumentsTab), de a jelentkezőhöz kötve
 * (documents.signup_id). A kampány saját Dokumentumok füle is mutatja
 * ezeket, jelentkezőre szűrve (lásd Document.signup_id kommentjét). */
export default function SignupDocumentsTab({
  signup,
  documents,
  onChanged,
}: {
  signup: First20Signup;
  documents: Document[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(DOCUMENT_TYPES[0]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    (async () => {
      const paths = documents.map((d) => d.file_path);
      setSignedUrls(await resolveSignedUrlsForPaths(supabase, DOCUMENTS_BUCKET, paths));
    })();
  }, [documents]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !title.trim() || !file) return;
    setSaving(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("documents").insert({
        title: title.trim(),
        category,
        file_path: path,
        file_name: file.name,
        signup_id: signup.id,
      });
      if (insertError) throw insertError;
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült feltölteni a dokumentumot."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(doc: Document) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (doc.file_path) await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.file_path]);
    const { error: deleteError } = await supabase.from("documents").delete().eq("id", doc.id);
    if (deleteError) setError(deleteError.message);
    else onChanged();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-base text-forest">Dokumentumok</h3>
        <button className="btn btn-bronze !px-3 !py-1.5 text-xs" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} /> Fájl feltöltése
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {showForm && (
        <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
              <input className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Típus</label>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Fájl *</label>
              <input
                ref={fileInputRef}
                type="file"
                required
                className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Feltöltés…" : "Mentés"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="Még nincs dokumentum ehhez a jelentkezőhöz" />
      ) : (
        <div className="flex flex-col gap-1.5">
          {documents.map((doc) => {
            const url = doc.file_path ? signedUrls.get(doc.file_path) ?? null : null;
            return (
              <div key={doc.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-forest">{doc.title}</span>
                    {doc.category && <span className="badge bg-ivory-dim text-walnut">{doc.category}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted">{formatDate(doc.created_at)}</span>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted/70 hover:text-forest" title="Megnyitás">
                      <Download size={13} />
                    </a>
                  )}
                  <button onClick={() => deleteDocument(doc)} className="text-muted/70 hover:text-red-600" title="Törlés">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
