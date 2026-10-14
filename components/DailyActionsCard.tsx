"use client";

import { useState } from "react";
import Link from "next/link";
import { ListTodo, FileUp, X, Sparkles } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { TaskItem, Document } from "@/lib/supabase/types";
import { errorMessage } from "@/lib/errors";

const STORAGE_BUCKET = "documents";

function todayLabel(): string {
  return new Intl.DateTimeFormat("hu-HU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

/**
 * "Mit csinálunk ma?" üdvözlő-sáv az Áttekintés tetején — gyors Feladat/
 * Dokumentum felvétel, anélkül hogy el kellene navigálni a Feladatok/
 * Dokumentumok oldalra. Csak a legszükségesebb mezőket kéri; részletesebb
 * szerkesztés (kategória, jegyzet, kapcsolt beszállító stb.) továbbra is
 * a saját oldalán történik — a mentés utáni lista onnan nyitja meg.
 */
export default function DailyActionsCard({
  onTaskCreated,
  onDocumentCreated,
}: {
  onTaskCreated: (task: TaskItem) => void;
  onDocumentCreated: (doc: Document) => void;
}) {
  const [open, setOpen] = useState<"task" | "document" | null>(null);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={17} className="text-bronze" />
          <div>
            <h2 className="font-serif text-lg text-forest">Mit csinálunk ma?</h2>
            <p className="mt-0.5 text-xs capitalize text-muted">{todayLabel()}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => setOpen("task")} className="btn btn-primary !px-3 !py-1.5 text-xs">
            <ListTodo size={14} /> Feladat
          </button>
          <button type="button" onClick={() => setOpen("document")} className="btn btn-ghost !px-3 !py-1.5 text-xs">
            <FileUp size={14} /> Dokumentum
          </button>
        </div>
      </div>

      {open === "task" && (
        <QuickTaskModal
          onClose={() => setOpen(null)}
          onCreated={(task) => {
            onTaskCreated(task);
            setOpen(null);
          }}
        />
      )}
      {open === "document" && (
        <QuickDocumentModal
          onClose={() => setOpen(null)}
          onCreated={(doc) => {
            onDocumentCreated(doc);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function QuickTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: (task: TaskItem) => void }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !title.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({ title: title.trim(), due_date: dueDate || null })
      .select()
      .single();
    setSaving(false);
    if (insertError) {
      setError(errorMessage(insertError, "Nem sikerült létrehozni a feladatot."));
      return;
    }
    if (data) onCreated(data);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <form onSubmit={submit} className="animate-fade-in card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-serif text-lg text-forest">Új feladat</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
            <input
              className="input"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="pl. Hívd fel a nyomdát"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Határidő</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-muted">
          Prioritás, kategória és a többi mező a{" "}
          <Link href="/tasks" className="text-forest underline">
            Feladatok
          </Link>{" "}
          oldalon állítható.
        </p>
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Mentés…" : "Létrehozás"}
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Mégse
          </button>
        </div>
      </form>
    </div>
  );
}

function QuickDocumentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (doc: Document) => void }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    const finalTitle = title.trim();
    if (!supabase || !finalTitle) return;
    setSaving(true);
    setError(null);
    try {
      let filePath: string | null = null;
      let fileName: string | null = null;
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
        .insert({ title: finalTitle, file_path: filePath, file_name: fileName })
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) onCreated(data);
    } catch (err) {
      setError(errorMessage(err, "Nem sikerült feltölteni a dokumentumot."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <form onSubmit={submit} className="animate-fade-in card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-serif text-lg text-forest">Dokumentum feltöltése</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Bezárás"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Fájl</label>
            <input
              type="file"
              className="input file:mr-3 file:rounded-md file:border-0 file:bg-forest file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ivory"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Cím *</label>
            <input
              className="input"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="pl. Beszállítói szerződés"
            />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-muted">
          Kategóriát, jegyzetet a{" "}
          <Link href="/documents" className="text-forest underline">
            Dokumentumok
          </Link>{" "}
          oldalon adhatsz hozzá.
        </p>
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Mentés…" : "Feltöltés"}
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Mégse
          </button>
        </div>
      </form>
    </div>
  );
}
