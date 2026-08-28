"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Mail, Users, Search, Upload, Download } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Supplier, SupplierInsert, PriceQuote } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import EmailComposeModal from "@/components/EmailComposeModal";
import SupplierProfileModal, { type SupplierDraft } from "@/components/SupplierProfileModal";
import { useUndoAction } from "@/lib/useUndoAction";
import { CONTRACT_STATUS_HU } from "@/lib/labels";
import { toCSV, downloadCSV } from "@/lib/csv";

function bySupplierRecency(a: Supplier, b: Supplier) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

const CSV_TEMPLATE = `name,category,country,website,email,phone,whatsapp,products,notes
Alpine Print Co.,Kártyagyártás,Svájc,https://alpineprint.example,info@alpineprint.example,+41 44 123 45 67,+41 79 123 45 67,"Kártya 90x60mm; Doboz; Matrica",Mintát kértünk
`;

function downloadCsvTemplate() {
  downloadCSV("beszallitok-minta.csv", CSV_TEMPLATE);
}

const EXPORT_HEADERS = [
  "name",
  "category",
  "country",
  "website",
  "email",
  "phone",
  "whatsapp",
  "products",
  "contacted",
  "reply_received",
  "contract_status",
  "contract_valid_until",
  "notes",
];

function exportSuppliersCSV(suppliers: Supplier[]) {
  const rows = suppliers.map((s) => [
    s.name,
    s.category,
    s.country,
    s.website,
    s.contact_email,
    s.phone,
    s.whatsapp,
    s.products.map((p) => p.name).join("; "),
    s.contacted,
    s.reply_received,
    s.contract_status,
    s.contract_valid_until,
    s.notes,
  ]);
  downloadCSV("beszallitok.csv", toCSV(EXPORT_HEADERS, rows));
}

// Minimal CSV parser — handles quoted fields, embedded commas, and ""
// escapes, which is enough for a typical Excel/Sheets export.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function draftToInsert(draft: SupplierDraft): SupplierInsert {
  return {
    name: draft.name,
    category: draft.category.trim() || null,
    country: draft.country.trim() || null,
    website: draft.website.trim() || null,
    contact_email: draft.contact_email.trim() || null,
    phone: draft.phone.trim() || null,
    whatsapp: draft.whatsapp.trim() || null,
    products: draft.products.filter((p) => p.name.trim()),
    contacted: draft.contacted,
    reply_received: draft.reply_received,
    notes: draft.notes.trim() || null,
    email_text: draft.email_text.trim() || null,
    contract_status: draft.contract_status,
    contract_valid_until: draft.contract_valid_until || null,
  };
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [profileFor, setProfileFor] = useState<Supplier | "new" | null>(null);
  const [composeFor, setComposeFor] = useState<Supplier | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [priceQuotes, setPriceQuotes] = useState<PriceQuote[]>([]);
  const [cardAssets, setCardAssets] = useState<{ id: string; language: string; version: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();
  const { pending: pendingUndoQuote, schedule: scheduleUndoQuote, undoNow: undoNowQuote } = useUndoAction();

  const loadSuppliers = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setSuppliers(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadSuppliers();
  }, [supabase, loadSuppliers]);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const [quotesRes, assetsRes] = await Promise.all([
        supabase.from("price_quotes").select("*").order("created_at", { ascending: false }),
        supabase.from("card_assets").select("id, language, version"),
      ]);
      setPriceQuotes(quotesRes.data ?? []);
      setCardAssets(
        (assetsRes.data ?? []).map((a) => ({ id: a.id, language: a.language, version: a.version }))
      );
    })();
  }, [supabase]);

  async function createSupplier(draft: SupplierDraft): Promise<{ error?: string } | void> {
    if (!supabase) return { error: "Nincs adatbázis-kapcsolat." };
    const { data, error } = await supabase.from("suppliers").insert(draftToInsert(draft)).select().single();
    if (error) return { error: error.message };
    if (data) setSuppliers((prev) => [data, ...prev]);
  }

  async function updateSupplier(id: string, patch: Partial<Supplier>) {
    setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    if (!supabase) return;
    const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
    if (error) setError(error.message);
  }

  async function saveProfile(draft: SupplierDraft): Promise<{ error?: string } | void> {
    if (profileFor === "new") return createSupplier(draft);
    if (profileFor) await updateSupplier(profileFor.id, draftToInsert(draft));
  }

  function deleteSupplier(id: string) {
    if (!supabase) return;
    const removed = suppliers.find((s) => s.id === id);
    if (!removed) return;
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    scheduleUndo(
      `"${removed.name}" törölve.`,
      async () => {
        const { error } = await supabase.from("suppliers").delete().eq("id", id);
        if (error) setError(error.message);
      },
      () => setSuppliers((prev) => [...prev, removed].sort(bySupplierRecency))
    );
  }

  async function handleCsvFile(file: File) {
    if (!supabase) return;
    setImportMessage(null);
    setError(null);

    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      setError("A CSV fájl üres, vagy hiányzik belőle a fejléc sor.");
      return;
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const colIndex = (name: string) => header.indexOf(name);
    if (colIndex("name") === -1) {
      setError('A CSV fejlécében kötelező a "name" oszlop.');
      return;
    }

    const records: SupplierInsert[] = rows
      .slice(1)
      .map((r) => {
        const get = (col: string) => {
          const i = colIndex(col);
          return i >= 0 ? (r[i] ?? "").trim() : "";
        };
        const productsStr = get("products");
        const products = productsStr
          ? productsStr
              .split(";")
              .map((p) => p.trim())
              .filter(Boolean)
              .map((n) => ({ id: crypto.randomUUID(), name: n, price: "", moq: "", note: "" }))
          : [];
        return {
          name: get("name"),
          category: get("category") || null,
          country: get("country") || null,
          website: get("website") || null,
          contact_email: get("email") || null,
          phone: get("phone") || null,
          whatsapp: get("whatsapp") || null,
          products,
          notes: get("notes") || null,
        };
      })
      .filter((r) => r.name);

    if (records.length === 0) {
      setError("Nem található érvényes beszállító-sor a CSV-ben (hiányzik a név oszlop értéke?).");
      return;
    }

    setImporting(true);
    const { data, error } = await supabase.from("suppliers").insert(records).select();
    setImporting(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      setSuppliers((prev) => [...data, ...prev].sort(bySupplierRecency));
      setImportMessage(`${data.length} beszállító importálva.`);
    }
  }

  function deletePriceQuote(quote: PriceQuote) {
    if (!supabase) return;
    setPriceQuotes((prev) => prev.filter((q) => q.id !== quote.id));
    scheduleUndoQuote(
      "Árajánlat törölve.",
      async () => {
        const { error } = await supabase.from("price_quotes").delete().eq("id", quote.id);
        if (error) setError(error.message);
      },
      () => setPriceQuotes((prev) => [quote, ...prev])
    );
  }

  // Mirrors the same exclusivity rule as the Kártya-fájlok page: only one
  // quote per card asset can be marked as the accepted one.
  async function toggleQuoteSelected(quote: PriceQuote) {
    if (!supabase) return;
    const nextSelected = !quote.is_selected;
    setPriceQuotes((prev) =>
      prev.map((q) => {
        if (q.id === quote.id) return { ...q, is_selected: nextSelected };
        if (nextSelected && q.card_asset_id === quote.card_asset_id) return { ...q, is_selected: false };
        return q;
      })
    );
    if (nextSelected) {
      const { error } = await supabase
        .from("price_quotes")
        .update({ is_selected: false })
        .eq("card_asset_id", quote.card_asset_id)
        .neq("id", quote.id);
      if (error) setError(error.message);
    }
    const { error } = await supabase.from("price_quotes").update({ is_selected: nextSelected }).eq("id", quote.id);
    if (error) setError(error.message);
  }

  const cardAssetOptions = useMemo(
    () => cardAssets.map((a) => ({ id: a.id, label: `${a.language} — ${a.version}` })),
    [cardAssets]
  );
  const cardAssetLabelById = useMemo(
    () => new Map(cardAssets.map((a) => [a.id, `${a.language} — ${a.version}`])),
    [cardAssets]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q) ||
        (s.country ?? "").toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Supplier[]>();
    for (const s of filtered) {
      const key = s.category?.trim() || "Egyéb";
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "hu"));
  }, [filtered]);

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Beszállítók" />
        <EmptyState icon={Users} title="Csatlakoztasd a Supabase-t a beszállítók kezeléséhez" />
      </>
    );
  }

  const profileSupplier = profileFor === "new" ? null : profileFor;

  return (
    <>
      <PageHeader
        title="Beszállítók"
        subtitle="Gyártói és beszállítói kapcsolatok a Zusammen kártyapaklikhoz."
        action={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload size={16} /> {importing ? "Importálás…" : "Beszállítók importálása CSV-ből"}
            </button>
            {suppliers.length > 0 && (
              <button className="btn btn-ghost" onClick={() => exportSuppliersCSV(suppliers)}>
                <Download size={16} /> Exportálás CSV-be
              </button>
            )}
            <button className="btn btn-bronze" onClick={() => setProfileFor("new")}>
              <Plus size={16} /> Új beszállító hozzáadása
            </button>
          </div>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleCsvFile(file);
          e.target.value = "";
        }}
      />

      {error && <ErrorBanner message={error} />}
      {importMessage && (
        <div className="mb-4 rounded-lg border border-forest/20 bg-forest/5 px-4 py-2.5 text-sm text-forest">
          {importMessage}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {!loading && suppliers.length > 0 && (
          <div className="relative max-w-xs flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-9"
              placeholder="Beszállítók keresése…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
        <button onClick={downloadCsvTemplate} className="text-xs font-medium text-bronze hover:underline">
          Minta CSV letöltése
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Még nincs beszállító"
          description="Add hozzá a gyártókat és nyomdákat, akiket a Zusammen indulásához megkeresel, vagy importálj egy CSV listát."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-serif text-lg text-forest">{category}</h2>
                <span className="badge bg-ivory-dim text-walnut">{items.length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {items.map((supplier) => (
                  <SupplierRow
                    key={supplier.id}
                    supplier={supplier}
                    onOpen={() => setProfileFor(supplier)}
                    onUpdate={(patch) => updateSupplier(supplier.id, patch)}
                    onDelete={() => deleteSupplier(supplier.id)}
                    onEmail={() => setComposeFor(supplier)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
      {pendingUndoQuote && <UndoToast message={pendingUndoQuote.message} onUndo={undoNowQuote} />}

      {profileFor && (
        <SupplierProfileModal
          supplier={profileSupplier}
          quotes={profileSupplier ? priceQuotes.filter((q) => q.supplier_id === profileSupplier.id) : []}
          cardAssetOptions={cardAssetOptions}
          cardAssetLabelById={cardAssetLabelById}
          onClose={() => setProfileFor(null)}
          onSave={saveProfile}
          onDelete={
            profileSupplier
              ? () => {
                  deleteSupplier(profileSupplier.id);
                  setProfileFor(null);
                }
              : undefined
          }
          onQuoteCreated={(quote) => setPriceQuotes((prev) => [quote, ...prev])}
          onToggleQuoteSelected={toggleQuoteSelected}
          onDeleteQuote={deletePriceQuote}
          onReplyDetected={
            profileSupplier ? () => updateSupplier(profileSupplier.id, { reply_received: true }) : undefined
          }
        />
      )}

      {composeFor && (
        <EmailComposeModal
          title={`Email küldése — ${composeFor.name}`}
          defaultTo={composeFor.contact_email ?? ""}
          defaultSubject="Megkeresés — Zusammen"
          defaultBody={`Kedves ${composeFor.name} csapat!\n\n`}
          onClose={() => setComposeFor(null)}
          onSent={({ to, body }) =>
            updateSupplier(composeFor.id, {
              contacted: true,
              email_text: body,
              contact_email: to,
            })
          }
        />
      )}
    </>
  );
}

function SupplierRow({
  supplier,
  onOpen,
  onUpdate,
  onDelete,
  onEmail,
}: {
  supplier: Supplier;
  onOpen: () => void;
  onUpdate: (patch: Partial<Supplier>) => void;
  onDelete: () => void;
  onEmail: () => void;
}) {
  return (
    <div className="card flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="min-w-0">
          <p className="truncate font-medium text-forest">{supplier.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {supplier.country && <span className="text-xs text-muted">{supplier.country}</span>}
            {supplier.products.length > 0 && (
              <span className="badge bg-ivory-dim text-walnut">
                {supplier.products.length} termék
              </span>
            )}
            {supplier.contract_status !== "None" && (
              <span className="badge bg-forest/10 text-forest">{CONTRACT_STATUS_HU[supplier.contract_status]}</span>
            )}
          </div>
        </div>
      </button>

      <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-forest">
        <input
          type="checkbox"
          className="h-4 w-4 accent-bronze"
          checked={supplier.contacted}
          onChange={(e) => onUpdate({ contacted: e.target.checked })}
        />
        Megkeresve
      </label>
      <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-forest">
        <input
          type="checkbox"
          className="h-4 w-4 accent-bronze"
          checked={supplier.reply_received}
          onChange={(e) => onUpdate({ reply_received: e.target.checked })}
        />
        Válaszolt
      </label>

      <button onClick={onEmail} className="btn btn-ghost shrink-0 !px-2" aria-label="Email küldése">
        <Mail size={15} />
      </button>

      <button onClick={onDelete} className="btn btn-danger shrink-0 !px-2" aria-label="Beszállító törlése">
        <Trash2 size={15} />
      </button>
    </div>
  );
}
