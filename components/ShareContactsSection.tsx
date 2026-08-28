"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Mail, Users, MessageSquare } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ShareContact, ShareContactCategory } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import EmailComposeModal from "@/components/EmailComposeModal";
import ContactCorrespondence from "@/components/ContactCorrespondence";
import { useUndoAction } from "@/lib/useUndoAction";
import UndoToast from "@/components/UndoToast";

const CATEGORIES: ShareContactCategory[] = ["Sajtó", "Influencer", "Ismerős", "Egyéb"];

const CATEGORY_STYLES: Record<ShareContactCategory, string> = {
  Sajtó: "bg-slate/10 text-slate",
  Influencer: "bg-mauve/10 text-mauve",
  Ismerős: "bg-walnut/10 text-walnut",
  Egyéb: "bg-ivory-dim text-muted",
};

function byRecency(a: ShareContact, b: ShareContact) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

const EMPTY_FORM = { name: "", email: "", category: "Egyéb" as ShareContactCategory, notes: "" };

export default function ShareContactsSection() {
  const [contacts, setContacts] = useState<ShareContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [composeFor, setComposeFor] = useState<ShareContact | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("share_contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setContacts(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from("share_contacts")
      .insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        category: form.category,
        notes: form.notes.trim() || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) setContacts((prev) => [data, ...prev]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  function markContacted(id: string) {
    if (!supabase) return;
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, contacted: true } : c)));
    void supabase.from("share_contacts").update({ contacted: true }).eq("id", id);
  }

  function deleteContact(id: string) {
    if (!supabase) return;
    const removed = contacts.find((c) => c.id === id);
    if (!removed) return;
    setContacts((prev) => prev.filter((c) => c.id !== id));
    scheduleUndo(
      `"${removed.name}" törölve.`,
      async () => {
        const { error } = await supabase.from("share_contacts").delete().eq("id", id);
        if (error) setError(error.message);
      },
      () => setContacts((prev) => [...prev, removed].sort(byRecency))
    );
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-lg text-forest">Kapcsolatok</h2>
          <p className="mt-1 text-sm text-muted">Sajtó, influencerek és ismerősök, akikkel érdemes megosztani a Zusamment.</p>
        </div>
        <button className="btn btn-bronze shrink-0" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Kapcsolat hozzáadása
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {showForm && (
        <form onSubmit={addContact} className="mt-5 flex flex-col gap-3 rounded-lg border border-border p-4 animate-fade-in">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Név *</label>
              <input
                className="input"
                required
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Kapcsolat neve"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="cimzett@example.com"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Kategória</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: c }))}
                  className={`badge cursor-pointer border ${
                    form.category === c ? "border-bronze bg-bronze text-white" : "border-border bg-white text-muted"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Jegyzet</label>
            <textarea
              className="textarea min-h-16"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Bármi, amit érdemes tudni erről a kapcsolatról…"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Mentés…" : "Kapcsolat mentése"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner />
      ) : contacts.length === 0 ? (
        <div className="mt-5">
          <EmptyState icon={Users} title="Még nincs kapcsolat rögzítve" description="Adj hozzá sajtó-, influencer- vagy ismerős-kontaktokat." />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <div key={contact.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-forest">{contact.name}</p>
                  {contact.email && <p className="truncate text-xs text-muted">{contact.email}</p>}
                </div>
                <button
                  onClick={() => deleteContact(contact.id)}
                  className="shrink-0 text-muted hover:text-red-600"
                  aria-label="Kapcsolat törlése"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <span className={`badge w-fit ${CATEGORY_STYLES[contact.category]}`}>{contact.category}</span>
              {contact.notes && <p className="text-sm text-muted">{contact.notes}</p>}
              {contact.contacted && <span className="w-fit text-xs font-medium text-forest">Megkeresve</span>}
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  onClick={() => setComposeFor(contact)}
                  className="btn btn-ghost w-fit text-xs"
                  disabled={!contact.email}
                  title={contact.email ? undefined : "Nincs email cím megadva"}
                >
                  <Mail size={13} /> Email küldése
                </button>
                {contact.email && (
                  <button
                    onClick={() => setExpandedId((prev) => (prev === contact.id ? null : contact.id))}
                    className="btn btn-ghost w-fit text-xs"
                  >
                    <MessageSquare size={13} /> Levelezés
                  </button>
                )}
              </div>
              {expandedId === contact.id && contact.email && (
                <div className="mt-1 animate-fade-in">
                  <ContactCorrespondence
                    email={contact.email}
                    onReplyDetected={() => {
                      if (!contact.contacted) markContacted(contact.id);
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {composeFor && (
        <EmailComposeModal
          title={`Email küldése — ${composeFor.name}`}
          defaultTo={composeFor.email ?? ""}
          defaultSubject="Zusammen — szeretnék megosztani veled valamit"
          defaultBody={`Szia ${composeFor.name}!\n\n`}
          onClose={() => setComposeFor(null)}
          onSent={({ to, body }) => {
            const supabaseClient = getSupabaseClient();
            if (!supabaseClient) return;
            void supabaseClient
              .from("share_contacts")
              .update({ contacted: true, email_text: body, email: to })
              .eq("id", composeFor.id)
              .then(() => {
                setContacts((prev) =>
                  prev.map((c) => (c.id === composeFor.id ? { ...c, contacted: true, email_text: body, email: to } : c))
                );
              });
          }}
        />
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </section>
  );
}
