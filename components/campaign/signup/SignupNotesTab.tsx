"use client";

import { useState } from "react";
import { Plus, Trash2, StickyNote } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { First20Signup, First20SignupNote } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";

/** Jegyzetek fül — szabad szöveg, időbélyeggel és szerzővel, ugyanaz a
 * minta, mint a kampány Napló füle (CampaignLogTab), csak "típus"
 * mező nélkül (az itt nem volt kérve) és jelentkezőhöz kötve. */
export default function SignupNotesTab({
  signup,
  notes,
  onChanged,
}: {
  signup: First20Signup;
  notes: First20SignupNote[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !body.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("first20_signup_notes").insert({
      signup_id: signup.id,
      body: body.trim(),
      author: author.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setBody("");
    setShowForm(false);
    onChanged();
  }

  async function deleteNote(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("first20_signup_notes").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else onChanged();
  }

  return (
    <div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="mb-4 flex items-center justify-end">
        <button className="btn btn-bronze" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Jegyzet
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-col gap-3 rounded-md border border-border p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Szöveg *</label>
            <textarea className="textarea min-h-20" required autoFocus value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Szerző</label>
            <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="opcionális" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Mentés"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="Még nincs jegyzet ehhez a jelentkezőhöz" />
      ) : (
        <div className="flex flex-col gap-1.5">
          {notes.map((note) => (
            <div key={note.id} className="rounded-md border border-border px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">{note.author || "—"}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{formatDate(note.created_at)}</span>
                  <button onClick={() => deleteNote(note.id)} className="text-muted/70 hover:text-red-600" title="Törlés">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-forest">{note.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
