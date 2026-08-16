"use client";

import { useState } from "react";
import { X, Trash2, Plus } from "lucide-react";
import type { Supplier, SupplierProduct, ContractStatus } from "@/lib/supabase/types";
import { CONTRACT_STATUS_HU } from "@/lib/labels";
import { ErrorBanner } from "@/components/Feedback";

const CONTRACT_STATUSES: ContractStatus[] = ["None", "Signed", "Failed", "Expired"];

export type SupplierDraft = {
  name: string;
  category: string;
  country: string;
  website: string;
  contact_email: string;
  phone: string;
  whatsapp: string;
  products: SupplierProduct[];
  contacted: boolean;
  reply_received: boolean;
  notes: string;
  email_text: string;
  contract_status: ContractStatus;
  contract_valid_until: string;
};

function toDraft(supplier: Supplier | null): SupplierDraft {
  return {
    name: supplier?.name ?? "",
    category: supplier?.category ?? "",
    country: supplier?.country ?? "",
    website: supplier?.website ?? "",
    contact_email: supplier?.contact_email ?? "",
    phone: supplier?.phone ?? "",
    whatsapp: supplier?.whatsapp ?? "",
    products: supplier?.products ?? [],
    contacted: supplier?.contacted ?? false,
    reply_received: supplier?.reply_received ?? false,
    notes: supplier?.notes ?? "",
    email_text: supplier?.email_text ?? "",
    contract_status: supplier?.contract_status ?? "None",
    contract_valid_until: supplier?.contract_valid_until ?? "",
  };
}

function emptyProduct(): SupplierProduct {
  return { id: crypto.randomUUID(), name: "", price: "", moq: "", note: "" };
}

/** Full profile view/edit for a supplier — used both for "Új beszállító
 * hozzáadása" (supplier=null) and for editing an existing one. */
export default function SupplierProfileModal({
  supplier,
  onClose,
  onSave,
  onDelete,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (draft: SupplierDraft) => Promise<{ error?: string } | void>;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<SupplierDraft>(() => toDraft(supplier));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = supplier === null;

  function set<K extends keyof SupplierDraft>(key: K, value: SupplierDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function updateProduct(id: string, patch: Partial<SupplierProduct>) {
    setDraft((d) => ({
      ...d,
      products: d.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function addProduct() {
    setDraft((d) => ({ ...d, products: [...d.products, emptyProduct()] }));
  }

  function removeProduct(id: string) {
    setDraft((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) }));
  }

  async function save() {
    if (!draft.name.trim()) {
      setError("A név mező nem lehet üres.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave({ ...draft, name: draft.name.trim() });
    setSaving(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest/40 px-4 py-8 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="animate-fade-in card flex max-h-full w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-5">
          <h2 className="font-serif text-lg text-forest">{isNew ? "Új beszállító" : supplier.name}</h2>
          <button onClick={onClose} className="shrink-0 rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && <ErrorBanner message={error} />}

          <Section title="Alap adatok">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Név *">
                <input
                  className="input"
                  required
                  autoFocus={isNew}
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="pl. Alpine Print Co."
                />
              </Field>
              <Field label="Kategória">
                <input
                  className="input"
                  value={draft.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="pl. Kártyagyártás"
                />
              </Field>
              <Field label="Ország">
                <input
                  className="input"
                  value={draft.country}
                  onChange={(e) => set("country", e.target.value)}
                  placeholder="pl. Svájc"
                />
              </Field>
            </div>
          </Section>

          <Section title="Elérhetőségek">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Weboldal">
                <input
                  className="input"
                  value={draft.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className="input"
                  value={draft.contact_email}
                  onChange={(e) => set("contact_email", e.target.value)}
                  placeholder="kapcsolat@beszallito.com"
                />
              </Field>
              <Field label="Telefon">
                <input
                  className="input"
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+41 …"
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  className="input"
                  value={draft.whatsapp}
                  onChange={(e) => set("whatsapp", e.target.value)}
                  placeholder="+41 …"
                />
              </Field>
            </div>
          </Section>

          <Section title="Termékek / szolgáltatások">
            {draft.products.length > 0 && (
              <div className="mb-1.5 hidden grid-cols-[2fr_1fr_1fr_2fr_auto] gap-2 px-1 text-xs font-medium text-muted sm:grid">
                <span>Termék / szolgáltatás</span>
                <span>Becsült ár</span>
                <span>MOQ</span>
                <span>Megjegyzés</span>
                <span />
              </div>
            )}
            <div className="flex flex-col gap-2">
              {draft.products.map((product) => (
                <div key={product.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_2fr_auto]">
                  <input
                    className="input"
                    value={product.name}
                    onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                    placeholder="pl. Kártya 90×60mm"
                  />
                  <input
                    className="input"
                    value={product.price}
                    onChange={(e) => updateProduct(product.id, { price: e.target.value })}
                    placeholder="pl. 1.20 CHF/db"
                  />
                  <input
                    className="input"
                    value={product.moq}
                    onChange={(e) => updateProduct(product.id, { moq: e.target.value })}
                    placeholder="pl. 500 db"
                  />
                  <input
                    className="input"
                    value={product.note}
                    onChange={(e) => updateProduct(product.id, { note: e.target.value })}
                    placeholder="Megjegyzés"
                  />
                  <button
                    onClick={() => removeProduct(product.id)}
                    className="btn btn-danger !px-2 justify-self-start"
                    aria-label="Termék eltávolítása"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addProduct} className="btn btn-ghost mt-2 !py-1.5 text-xs">
              <Plus size={13} /> Újabb termék hozzáadása
            </button>
          </Section>

          <Section title="Kapcsolat állapota">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-forest">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-bronze"
                  checked={draft.contacted}
                  onChange={(e) => set("contacted", e.target.checked)}
                />
                Megkeresve
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-forest">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-bronze"
                  checked={draft.reply_received}
                  onChange={(e) => set("reply_received", e.target.checked)}
                />
                Válasz érkezett
              </label>
            </div>

            <div className="mt-3">
              <Field label="Kiküldött email">
                <textarea
                  className="textarea min-h-20 font-mono text-xs"
                  value={draft.email_text}
                  onChange={(e) => set("email_text", e.target.value)}
                  placeholder="Illeszd be ide a releváns email levelezést, vagy küldj emailt a beszállító listából…"
                />
              </Field>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Szerződés">
                <select
                  className="select"
                  value={draft.contract_status}
                  onChange={(e) => set("contract_status", e.target.value as ContractStatus)}
                >
                  {CONTRACT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {CONTRACT_STATUS_HU[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Érvényesség dátuma">
                <input
                  type="date"
                  className="input"
                  value={draft.contract_valid_until}
                  onChange={(e) => set("contract_valid_until", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section title="Általános megjegyzés" last>
            <textarea
              className="textarea min-h-24"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Bármi más, amit érdemes tudni erről a beszállítóról…"
            />
          </Section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          {!isNew && onDelete ? (
            <button onClick={onDelete} className="btn btn-danger" aria-label="Beszállító törlése">
              <Trash2 size={15} /> Törlés
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost" disabled={saving}>
              Mégse
            </button>
            <button onClick={save} className="btn btn-primary" disabled={saving}>
              {saving ? "Mentés…" : "Mentés"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={last ? "" : "mb-5 border-b border-border pb-5"}>
      <h3 className="mb-3 font-serif text-sm text-forest">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
