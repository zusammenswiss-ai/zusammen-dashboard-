"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  FolderOpen,
  Download,
  ExternalLink,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Mail,
  Search,
  Pencil,
  Check,
  X,
} from "lucide-react";
import Link from "next/link";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Document } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import EmailComposeModal from "@/components/EmailComposeModal";
import Lightbox from "@/components/Lightbox";
import CollapsibleSection from "@/components/CollapsibleSection";
import ShowMoreButton from "@/components/ShowMoreButton";
import { useUndoAction } from "@/lib/useUndoAction";
import { useShowMore } from "@/lib/useShowMore";
import { formatDate } from "@/lib/format";
import { isImageFile, isPreviewableInBrowser, openFileLabel } from "@/lib/file-open";
import { resolveSignedUrlForPath, resolveSignedUrlsForPaths, EMAIL_LINK_EXPIRY_SECONDS } from "@/lib/signed-storage-url";
import { errorMessage } from "@/lib/errors";

function byDocumentRecency(a: Document, b: Document) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

const STATUSES = ["Piszkozat", "Felülvizsgálat alatt", "Végleges", "Archiválva"];
const STORAGE_BUCKET = "documents";

const EMPTY_FORM = {
  title: "",
  category: "",
  status: "Piszkozat",
  notes: "",
  related_task_id: "",
  related_supplier_id: "",
};

type SupplierOption = { id: string; name: string };
type TaskOption = { id: string; title: string };

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [composeFor, setComposeFor] = useState<{ doc: Document; signedUrl: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lightboxDoc, setLightboxDoc] = useState<Document | null>(null);
  // documents bucket is private (see supabase/schema.sql) — file_path
  // alone can't be fetched, it has to be exchanged for a signed URL
  // first. Keyed by file_path so a lookup doesn't need to re-derive
  // anything from the row.
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const loadDocuments = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [documentsRes, suppliersRes, tasksRes] = await Promise.all([
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("tasks").select("id, title").order("title"),
    ]);
    if (documentsRes.error) setError(documentsRes.error.message);
    else setDocuments(documentsRes.data ?? []);
    if (!suppliersRes.error) setSuppliers(suppliersRes.data ?? []);
    if (!tasksRes.error) setTasks(tasksRes.data ?? []);
    const paths = (documentsRes.data ?? []).map((d) => d.file_path);
    setSignedUrls(await resolveSignedUrlsForPaths(supabase, STORAGE_BUCKET, paths));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadDocuments();
  }, [supabase, loadDocuments]);

  async function addDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.title.trim()) return;
    setSaving(true);
    setError(null);

    let filePath: string | null = null;
    let fileName: string | null = null;

    try {
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;
        filePath = path;
        fileName = file.name;
      }

      const { data, error: insertError } = await supabase
        .from("documents")
        .insert({
          title: form.title.trim(),
          category: form.category.trim() || null,
          status: form.status,
          notes: form.notes.trim() || null,
          file_path: filePath,
          file_name: fileName,
          related_task_id: form.related_task_id || null,
          related_supplier_id: form.related_supplier_id || null,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      if (data) {
        setDocuments((prev) => [data, ...prev]);
        if (filePath) {
          const signedUrl = await resolveSignedUrlForPath(supabase, STORAGE_BUCKET, filePath);
          if (signedUrl) setSignedUrls((prev) => new Map(prev).set(filePath as string, signedUrl));
        }
      }
      setForm(EMPTY_FORM);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowForm(false);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni a dokumentumot."));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
    if (!supabase) return;
    const { error } = await supabase.from("documents").update({ status }).eq("id", id);
    if (error) setError(error.message);
  }

  async function updateDocument(
    id: string,
    patch: {
      title: string;
      category: string | null;
      notes: string | null;
      related_task_id: string | null;
      related_supplier_id: string | null;
    },
    newFile: File | null
  ) {
    if (!supabase) return;
    setError(null);
    try {
      let filePatch: { file_path: string; file_name: string } | null = null;
      if (newFile) {
        const existing = documents.find((d) => d.id === id);
        const safeName = newFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, newFile, { upsert: false });
        if (uploadError) throw uploadError;
        if (existing?.file_path) {
          await supabase.storage.from(STORAGE_BUCKET).remove([existing.file_path]);
        }
        filePatch = { file_path: path, file_name: newFile.name };
      }
      const { data, error } = await supabase
        .from("documents")
        .update({ ...patch, ...(filePatch ?? {}) })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setDocuments((prev) => prev.map((d) => (d.id === id ? data : d)));
        if (filePatch) {
          const signedUrl = await resolveSignedUrlForPath(supabase, STORAGE_BUCKET, filePatch.file_path);
          if (signedUrl) setSignedUrls((prev) => new Map(prev).set((filePatch as { file_path: string }).file_path, signedUrl));
        }
      }
      setEditingId(null);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült menteni a módosítást."));
    }
  }

  function deleteDocument(doc: Document) {
    if (!supabase) return;
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    scheduleUndo(
      `"${doc.title}" törölve.`,
      async () => {
        if (doc.file_path) {
          await supabase.storage.from(STORAGE_BUCKET).remove([doc.file_path]);
        }
        const { error } = await supabase.from("documents").delete().eq("id", doc.id);
        if (error) setError(error.message);
      },
      () => setDocuments((prev) => [...prev, doc].sort(byDocumentRecency))
    );
  }

  function fileUrl(doc: Document): string | null {
    if (!doc.file_path) return null;
    return signedUrls.get(doc.file_path) ?? null;
  }

  const supplierNameById = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const taskTitleById = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks]);

  // The compose modal's defaultBody/defaultSubject only ever seed its
  // initial useState — it doesn't react to prop changes after mount
  // (see components/EmailComposeModal.tsx) — so the link that goes into
  // the email body has to be resolved *before* the modal opens, not
  // patched in afterwards. It also gets its own long-lived (30-day)
  // signed URL rather than reusing the short-lived one used for in-
  // dashboard viewing, since the recipient might not open the email for
  // days.
  async function openCompose(doc: Document) {
    const signedUrl =
      supabase && doc.file_path
        ? await resolveSignedUrlForPath(supabase, STORAGE_BUCKET, doc.file_path, EMAIL_LINK_EXPIRY_SECONDS)
        : null;
    setComposeFor({ doc, signedUrl });
  }

  const filteredDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (d) => d.title.toLowerCase().includes(q) || (d.category ?? "").toLowerCase().includes(q)
    );
  }, [documents, query]);

  // Kategóriánként csoportosítva, ugyanaz a "szabad szöveg kategória →
  // 'Egyéb' fallback, ábécésorrend" minta, mint a Beszállítóknál — a
  // keresés a szűrt listát csoportosítja, nem a teljeset.
  const groupedDocuments = useMemo(() => {
    const map = new Map<string, Document[]>();
    for (const d of filteredDocuments) {
      const key = d.category?.trim() || "Egyéb";
      const list = map.get(key);
      if (list) list.push(d);
      else map.set(key, [d]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "hu"));
  }, [filteredDocuments]);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Dokumentumok" />
        <EmptyState icon={FolderOpen} title="Csatlakoztasd a Supabase-t a dokumentumok kezeléséhez" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dokumentumok"
        subtitle="Márkaanyagok, szerződések és referenciafájlok egy helyen."
        action={
          <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Dokumentum hozzáadása
          </button>
        }
      />

      {error && <ErrorBanner message={error} />}

      {!loading && documents.length > 0 && (
        <div className="relative mb-4 max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Dokumentumok keresése…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {showForm && (
        <form onSubmit={addDocument} className="card mb-6 flex flex-col gap-3 p-5 animate-fade-in">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
              <input
                className="input"
                required
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="pl. Beszállítói szerződés — Alpine Print Co."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
              <input
                className="input"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="pl. Jogi, Márka, Pénzügy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Állapot</label>
              <select
                className="select"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Fájl (opcionális)</label>
              <input
                ref={fileInputRef}
                type="file"
                className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Kapcsolódó feladat (opcionális)</label>
              <select
                className="select"
                value={form.related_task_id}
                onChange={(e) => setForm((f) => ({ ...f, related_task_id: e.target.value }))}
              >
                <option value="">— Nincs —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Kapcsolódó beszállító (opcionális)</label>
              <select
                className="select"
                value={form.related_supplier_id}
                onChange={(e) => setForm((f) => ({ ...f, related_supplier_id: e.target.value }))}
              >
                <option value="">— Nincs —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Jegyzetek</label>
            <textarea
              className="textarea min-h-20"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Kontextus, verzió, kivel kell egyeztetni…"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Dokumentum mentése"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Még nincs dokumentum"
          description="Töltsd fel a szerződéseket, márkairányelveket, vagy bármi mást, amit érdemes nyilvántartani."
        />
      ) : filteredDocuments.length === 0 ? (
        <EmptyState icon={Search} title="Nincs találat" description="Próbálj más keresőszót." />
      ) : (
        <div className="flex flex-col gap-6">
          {groupedDocuments.map(([category, items]) => (
            <DocumentCategoryGroup
              key={category}
              category={category}
              items={items}
              fileUrl={fileUrl}
              onUpdateStatus={updateStatus}
              onOpenLightbox={setLightboxDoc}
              onCompose={openCompose}
              onDelete={deleteDocument}
              editingId={editingId}
              onStartEdit={setEditingId}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={updateDocument}
              suppliers={suppliers}
              tasks={tasks}
              supplierNameById={supplierNameById}
              taskTitleById={taskTitleById}
            />
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}

      {lightboxDoc && fileUrl(lightboxDoc) && (
        <Lightbox src={fileUrl(lightboxDoc) as string} alt={lightboxDoc.title} onClose={() => setLightboxDoc(null)} />
      )}

      {composeFor && (
        <EmailComposeModal
          title={`Email küldése — ${composeFor.doc.title}`}
          defaultSubject={composeFor.doc.title}
          defaultBody={
            composeFor.signedUrl
              ? `Szia!\n\nMegosztom veled a következő dokumentumot: ${composeFor.doc.title}\n\n${composeFor.signedUrl}\n\n`
              : `Szia!\n\nA "${composeFor.doc.title}" dokumentummal kapcsolatban írok.\n\n`
          }
          onClose={() => setComposeFor(null)}
        />
      )}
    </>
  );
}

function DocumentCategoryGroup({
  category,
  items,
  fileUrl,
  onUpdateStatus,
  onOpenLightbox,
  onCompose,
  onDelete,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  suppliers,
  tasks,
  supplierNameById,
  taskTitleById,
}: {
  category: string;
  items: Document[];
  fileUrl: (doc: Document) => string | null;
  onUpdateStatus: (id: string, status: string) => void;
  onOpenLightbox: (doc: Document) => void;
  onCompose: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (
    id: string,
    patch: {
      title: string;
      category: string | null;
      notes: string | null;
      related_task_id: string | null;
      related_supplier_id: string | null;
    },
    newFile: File | null
  ) => void;
  suppliers: SupplierOption[];
  tasks: TaskOption[];
  supplierNameById: Map<string, string>;
  taskTitleById: Map<string, string>;
}) {
  const { visible, hiddenCount, showAll, setShowAll } = useShowMore(items, 8);
  return (
    <div>
      <CollapsibleSection
        title={<h2 className="font-serif text-lg text-forest">{category}</h2>}
        right={<span className="badge bg-ivory-dim text-walnut">{items.length}</span>}
        storageKey={`zusammen-collapsed-documents-category-${category}`}
        headerClassName="mb-3"
      >
        <div className="flex flex-col gap-3">
          {visible.map((doc) =>
            editingId === doc.id ? (
              <DocumentEditRow
                key={doc.id}
                doc={doc}
                onSave={onSaveEdit}
                onCancel={onCancelEdit}
                suppliers={suppliers}
                tasks={tasks}
              />
            ) : (
              <DocumentRow
                key={doc.id}
                doc={doc}
                url={fileUrl(doc)}
                onUpdateStatus={onUpdateStatus}
                onOpenLightbox={onOpenLightbox}
                onCompose={onCompose}
                onDelete={onDelete}
                onEdit={() => onStartEdit(doc.id)}
                supplierName={doc.related_supplier_id ? supplierNameById.get(doc.related_supplier_id) ?? null : null}
                taskTitle={doc.related_task_id ? taskTitleById.get(doc.related_task_id) ?? null : null}
              />
            )
          )}
        </div>
        {items.length > 8 && (
          <ShowMoreButton hiddenCount={hiddenCount} showAll={showAll} onToggle={() => setShowAll((v) => !v)} />
        )}
      </CollapsibleSection>
    </div>
  );
}

function DocumentRow({
  doc,
  url,
  onUpdateStatus,
  onOpenLightbox,
  onCompose,
  onDelete,
  onEdit,
  supplierName,
  taskTitle,
}: {
  doc: Document;
  url: string | null;
  onUpdateStatus: (id: string, status: string) => void;
  onOpenLightbox: (doc: Document) => void;
  onCompose: (doc: Document) => void;
  onDelete: (doc: Document) => void;
  onEdit: () => void;
  supplierName: string | null;
  taskTitle: string | null;
}) {
  const isImage = isImageFile(doc.file_name ?? url);
  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forest/5 text-bronze">
        {isImage ? <ImageIcon size={18} /> : <FileText size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-forest">{doc.title}</p>
          {doc.category && <span className="badge bg-ivory-dim text-walnut">{doc.category}</span>}
          {taskTitle && (
            <Link
              href="/tasks"
              onClick={(e) => e.stopPropagation()}
              className="badge bg-bronze/15 text-walnut hover:underline"
            >
              {taskTitle}
            </Link>
          )}
          {supplierName && (
            <Link
              href="/suppliers"
              onClick={(e) => e.stopPropagation()}
              className="badge bg-forest/10 text-forest hover:underline"
            >
              {supplierName}
            </Link>
          )}
        </div>
        {doc.notes && <p className="mt-1 line-clamp-1 text-xs text-muted">{doc.notes}</p>}
        <p className="mt-1 text-xs text-muted">
          {formatDate(doc.created_at)}
          {doc.file_name && (
            <span className="ml-2 inline-flex items-center gap-1">
              <Paperclip size={11} /> {doc.file_name}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <select
          className="select w-auto text-xs"
          value={doc.status ?? "Piszkozat"}
          onChange={(e) => onUpdateStatus(doc.id, e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {url && isImage && (
          <button
            onClick={() => onOpenLightbox(doc)}
            className="btn btn-ghost !px-2"
            aria-label="Kép megnyitása nagyban"
            title="Kép megnyitása nagyban"
          >
            <ImageIcon size={15} />
          </button>
        )}
        {url && !isImage && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost !px-2"
            aria-label={openFileLabel(doc.file_name ?? url)}
            title={openFileLabel(doc.file_name ?? url)}
          >
            {isPreviewableInBrowser(doc.file_name ?? url) ? <ExternalLink size={15} /> : <Download size={15} />}
          </a>
        )}
        <button onClick={onEdit} className="btn btn-ghost !px-2" aria-label="Szerkesztés" title="Szerkesztés">
          <Pencil size={15} />
        </button>
        <button onClick={() => onCompose(doc)} className="btn btn-ghost !px-2" aria-label="Email küldése">
          <Mail size={15} />
        </button>
        <button onClick={() => onDelete(doc)} className="btn btn-danger !px-2" aria-label="Dokumentum törlése">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

/** Inline edit for a document's metadata (title/kategória/jegyzetek/
 * kapcsolódó feladat/beszállító) plus an optional file swap — picking a
 * new file here replaces the stored one (old file removed from Storage)
 * instead of requiring a delete + re-create like before. */
function DocumentEditRow({
  doc,
  onSave,
  onCancel,
  suppliers,
  tasks,
}: {
  doc: Document;
  onSave: (
    id: string,
    patch: {
      title: string;
      category: string | null;
      notes: string | null;
      related_task_id: string | null;
      related_supplier_id: string | null;
    },
    newFile: File | null
  ) => void;
  onCancel: () => void;
  suppliers: SupplierOption[];
  tasks: TaskOption[];
}) {
  const [title, setTitle] = useState(doc.title);
  const [category, setCategory] = useState(doc.category ?? "");
  const [notes, setNotes] = useState(doc.notes ?? "");
  const [relatedTaskId, setRelatedTaskId] = useState(doc.related_task_id ?? "");
  const [relatedSupplierId, setRelatedSupplierId] = useState(doc.related_supplier_id ?? "");
  const [newFile, setNewFile] = useState<File | null>(null);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(
      doc.id,
      {
        title: title.trim(),
        category: category.trim() || null,
        notes: notes.trim() || null,
        related_task_id: relatedTaskId || null,
        related_supplier_id: relatedSupplierId || null,
      },
      newFile
    );
  }

  return (
    <form onSubmit={save} className="animate-fade-in card flex flex-col gap-3 border-bronze/40 bg-ivory-dim/40 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
          <input className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kapcsolódó feladat</label>
          <select className="select" value={relatedTaskId} onChange={(e) => setRelatedTaskId(e.target.value)}>
            <option value="">— Nincs —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kapcsolódó beszállító</label>
          <select
            className="select"
            value={relatedSupplierId}
            onChange={(e) => setRelatedSupplierId(e.target.value)}
          >
            <option value="">— Nincs —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Jegyzetek</label>
        <textarea className="textarea min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Fájl cseréje {doc.file_name && <span className="font-normal text-muted">(jelenlegi: {doc.file_name})</span>}
        </label>
        <input
          type="file"
          className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
          onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary">
          <Check size={14} /> Mentés
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <X size={14} /> Mégse
        </button>
      </div>
    </form>
  );
}
