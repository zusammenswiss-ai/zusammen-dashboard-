"use client";

import { useState } from "react";
import { Users, Plus, Trash2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { NewsletterSubscriber } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";

/** Minimal add/list/delete UI for newsletter_subscribers — the table the
 * founder asked for "a jövőbeli, közvetlen feliratkozásokhoz" (future
 * direct sign-ups) has no other way to get populated yet (no public
 * sign-up form exists), so this exists to make the "newsletter
 * feliratkozók" checkbox on EmailCampaignSendForm actually usable now
 * rather than being permanently empty. */
export default function NewsletterSubscribersSection({
  subscribers,
  onAdd,
  onDelete,
}: {
  subscribers: NewsletterSubscriber[];
  onAdd: (subscriber: NewsletterSubscriber) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-bronze" />
          <h2 className="font-serif text-lg text-forest">
            Hírlevél feliratkozók {subscribers.length > 0 && `(${subscribers.length})`}
          </h2>
        </div>
        <button className="btn btn-bronze !px-3 !py-1.5 text-xs" onClick={() => setShowForm((v) => !v)}>
          <Plus size={14} /> Feliratkozó hozzáadása
        </button>
      </div>

      {showForm && (
        <SubscriberForm
          onCreated={(s) => {
            onAdd(s);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {subscribers.length === 0 ? (
        <EmptyState icon={Users} title="Még nincs hírlevél feliratkozó" description="Add hozzá kézzel, vagy várd az első közvetlen feliratkozást." />
      ) : (
        <div className="flex flex-col gap-1.5">
          {subscribers.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium text-forest">{s.name || s.email}</span>
                {s.name && <span className="ml-1.5 text-xs text-muted">{s.email}</span>}
                {s.unsubscribed && <span className="badge ml-1.5 bg-gray-200 text-gray-700">Leiratkozott</span>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted">{formatDate(s.subscribed_at)}</span>
                <button onClick={() => onDelete(s.id)} className="text-muted/70 hover:text-red-600" title="Törlés">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriberForm({
  onCreated,
  onCancel,
}: {
  onCreated: (subscriber: NewsletterSubscriber) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase || !email.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("newsletter_subscribers")
      .insert({ name: name.trim() || null, email: email.trim().toLowerCase() })
      .select()
      .single();
    if (insertError) setError(insertError.message);
    else if (data) onCreated(data);
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="mb-4 flex animate-fade-in flex-wrap items-end gap-2 rounded-md border border-border p-3">
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-muted">Név</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="opcionális" />
      </div>
      <div className="flex-1">
        <label className="mb-1 block text-xs font-medium text-muted">Email *</label>
        <input type="email" required autoFocus className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nev@pelda.ch" />
      </div>
      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? "Mentés…" : "Hozzáadás"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Mégse
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
