"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Link2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { DemandLinkShare, ShareContact } from "@/lib/supabase/types";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmailComposeModal from "@/components/EmailComposeModal";
import { formatDate } from "@/lib/format";

// Deliberately NOT lib/site-url.ts's SITE_URL here — that constant reads
// process.env.SITE_URL, which (being a non-NEXT_PUBLIC_ variable) is
// never inlined into the client bundle, so from this "use client"
// component it would always resolve to the hardcoded fallback domain
// instead of whatever real domain is actually configured. This runs
// only from a click handler (never during SSR), so window is always
// available — and reflects the actual domain the founder is on.
function demandLink(): string {
  return `${window.location.origin}/landing`;
}

export default function DemandLinkSharesSection() {
  const [shares, setShares] = useState<DemandLinkShare[]>([]);
  const [contacts, setContacts] = useState<ShareContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [compose, setCompose] = useState<{ contactId: string | null; name: string; email: string } | null>(null);

  const supabase = getSupabaseClient();

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [sharesRes, contactsRes] = await Promise.all([
      supabase.from("demand_link_shares").select("*").order("created_at", { ascending: false }),
      supabase.from("share_contacts").select("*").order("name", { ascending: true }),
    ]);
    if (sharesRes.error) setError(sharesRes.error.message);
    else if (contactsRes.error) setError(contactsRes.error.message);
    else {
      setShares(sharesRes.data ?? []);
      setContacts(contactsRes.data ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  function startCompose() {
    const contact = contacts.find((c) => c.id === selectedContactId);
    const name = contact?.name ?? manualName.trim();
    const email = contact?.email ?? manualEmail.trim();
    if (!email) {
      setError("Add meg a címzett email címét, vagy válassz egy kapcsolatot.");
      return;
    }
    setError(null);
    setCompose({ contactId: contact?.id ?? null, name, email });
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-lg text-forest">Demand-test link megosztásai</h2>
          <p className="mt-1 text-sm text-muted">Napló arról, kinek küldted el eddig a /landing igényfelmérés linket.</p>
        </div>
        <button className="btn btn-bronze shrink-0" onClick={() => setShowForm((v) => !v)}>
          <Plus size={16} /> Új megosztás
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {showForm && (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-border p-4 animate-fade-in">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Meglévő kapcsolatból</label>
            <select
              className="select"
              value={selectedContactId}
              onChange={(e) => {
                setSelectedContactId(e.target.value);
                setManualName("");
                setManualEmail("");
              }}
            >
              <option value="">— válassz, vagy add meg alább kézzel —</option>
              {contacts
                .filter((c) => c.email)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
            </select>
          </div>
          {!selectedContactId && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Név</label>
                <input
                  className="input"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Címzett neve"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Email *</label>
                <input
                  type="email"
                  className="input"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="cimzett@example.com"
                />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" onClick={startCompose}>
              Email megírása
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>
              Mégse
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : shares.length === 0 ? (
        <p className="mt-5 text-sm text-muted">Még nem osztottad meg a linket senkivel.</p>
      ) : (
        <ul className="mt-5 flex flex-col divide-y divide-border">
          {shares.map((share) => (
            <li key={share.id} className="flex items-center gap-3 py-2.5">
              <Link2 size={14} className="shrink-0 text-bronze" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-forest">{share.recipient_name || share.recipient_email}</p>
                {share.recipient_name && <p className="truncate text-xs text-muted">{share.recipient_email}</p>}
              </div>
              <span className="shrink-0 text-xs text-muted">{formatDate(share.created_at)}</span>
            </li>
          ))}
        </ul>
      )}

      {compose && (
        <EmailComposeModal
          title={`Demand-link megosztása — ${compose.name || compose.email}`}
          defaultTo={compose.email}
          defaultSubject="Zusammen — próbáld ki te is!"
          defaultBody={`Szia${compose.name ? ` ${compose.name}` : ""}!\n\nSzeretném megosztani veled a Zusammen kártyáinkat — próbáld ki itt, és mondd el a véleményed:\n${demandLink()}\n\n`}
          onClose={() => setCompose(null)}
          onSent={({ to, body }) => {
            if (!supabase) return;
            void supabase
              .from("demand_link_shares")
              .insert({
                contact_id: compose.contactId,
                recipient_name: compose.name || null,
                recipient_email: to,
                email_text: body,
              })
              .select()
              .single()
              .then(({ data }) => {
                if (data) setShares((prev) => [data, ...prev]);
                setShowForm(false);
                setSelectedContactId("");
                setManualName("");
                setManualEmail("");
              });
          }}
        />
      )}
    </section>
  );
}
