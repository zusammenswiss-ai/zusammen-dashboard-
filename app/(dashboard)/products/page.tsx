"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Tag,
  TriangleAlert,
  ChevronDown,
  ChevronUp,
  Upload,
  ImageOff,
  Layers,
  Truck,
  ArrowRight,
} from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CardAsset, Product, ProductStatus, Supplier } from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import UndoToast from "@/components/UndoToast";
import Lightbox from "@/components/Lightbox";
import BackButton from "@/components/BackButton";
import { useUndoAction } from "@/lib/useUndoAction";
import { PRODUCT_STATUSES, PRODUCT_STATUS_STYLES } from "@/lib/labels";
import { formatMoney, CURRENCY_OPTIONS } from "@/lib/currency";
import { DEFAULT_CURRENCY } from "@/lib/company-settings";
import { convertAmount, fetchExchangeRates, type ExchangeRates } from "@/lib/exchange-rates";
import type { CurrencyCode } from "@/lib/supabase/types";

const STORAGE_BUCKET = "product-images";

const EMPTY_FORM = {
  name: "",
  edition: "",
  status: PRODUCT_STATUSES[0] as ProductStatus,
  card_asset_id: "",
  supplier_id: "",
  cogs: "",
  cogs_currency: "CHF",
  sale_price: "",
  sale_price_currency: "CHF" as CurrencyCode,
  description: "",
  production_note: "",
};

function byRecency(a: Product, b: Product) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cardAssets, setCardAssets] = useState<Pick<CardAsset, "id" | "language" | "version">[]>([]);
  const [suppliers, setSuppliers] = useState<Pick<Supplier, "id" | "name">[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Live árfolyamok az Árrés kártyánkénti, valós számolásához — see
  // lib/exchange-rates.ts (same approach as Pénzügyek).
  const [rates, setRates] = useState<ExchangeRates | null>(null);

  const supabase = getSupabaseClient();
  const { pending: pendingUndo, schedule: scheduleUndo, undoNow } = useUndoAction();

  useEffect(() => {
    fetchExchangeRates().then((result) => {
      if (result.ok) setRates(result.rates);
    });
  }, []);

  const loadAll = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [productsRes, cardAssetsRes, suppliersRes, companySettingsRes] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("card_assets").select("id, language, version"),
      supabase.from("suppliers").select("id, name"),
      supabase.from("company_settings").select("currency").maybeSingle(),
    ]);
    if (productsRes.error) setError(productsRes.error.message);
    else setProducts(productsRes.data ?? []);
    if (!cardAssetsRes.error) setCardAssets(cardAssetsRes.data ?? []);
    if (!suppliersRes.error) setSuppliers(suppliersRes.data ?? []);
    setCurrency(companySettingsRes.data?.currency ?? DEFAULT_CURRENCY);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadAll();
  }, [supabase, loadAll]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setExistingImageUrl(null);
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(p: Product) {
    setShowForm(false);
    setEditingId(p.id);
    setImageFile(null);
    setExistingImageUrl(p.image_url);
    setForm({
      name: p.name,
      edition: p.edition ?? "",
      status: p.status,
      card_asset_id: p.card_asset_id ?? "",
      supplier_id: p.supplier_id ?? "",
      cogs: p.cogs != null ? String(p.cogs) : "",
      cogs_currency: p.cogs_currency ?? "CHF",
      sale_price: p.sale_price != null ? String(p.sale_price) : "",
      sale_price_currency: p.sale_price_currency,
      description: p.description ?? "",
      production_note: p.production_note ?? "",
    });
  }

  async function uploadImage(file: File): Promise<string | null> {
    if (!supabase) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function buildPayload(imageUrl: string | null) {
    return {
      name: form.name.trim(),
      edition: form.edition.trim() || null,
      status: form.status,
      card_asset_id: form.card_asset_id || null,
      supplier_id: form.supplier_id || null,
      cogs: form.cogs.trim() ? Number(form.cogs) : null,
      cogs_currency: form.cogs_currency || null,
      sale_price: form.sale_price.trim() ? Number(form.sale_price) : null,
      sale_price_currency: form.sale_price_currency,
      description: form.description.trim() || null,
      production_note: form.production_note.trim() || null,
      image_url: imageUrl,
    };
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile) : null;
      const { data, error: insertError } = await supabase
        .from("products")
        .insert(buildPayload(imageUrl))
        .select()
        .single();
      if (insertError) throw insertError;
      if (data) setProducts((prev) => [data, ...prev]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült létrehozni a terméket.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !editingId || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile) : existingImageUrl;
      const { data, error: updateError } = await supabase
        .from("products")
        .update(buildPayload(imageUrl))
        .eq("id", editingId)
        .select()
        .single();
      if (updateError) throw updateError;
      if (data) setProducts((prev) => prev.map((p) => (p.id === editingId ? data : p)));
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült menteni a terméket.");
    } finally {
      setSaving(false);
    }
  }

  function deleteProduct(p: Product) {
    if (!supabase) return;
    if (editingId === p.id) resetForm();
    setExpandedId((id) => (id === p.id ? null : id));
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    scheduleUndo(
      `"${p.name}" törölve.`,
      async () => {
        const { error: deleteError } = await supabase.from("products").delete().eq("id", p.id);
        if (deleteError) setError(deleteError.message);
      },
      () => setProducts((prev) => [...prev, p].sort(byRecency))
    );
  }

  const cardAssetById = new Map(cardAssets.map((c) => [c.id, c]));
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  const formFields = (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Név *</label>
          <input
            className="input"
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="pl. Connection Cards"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Edition</label>
          <input
            className="input"
            value={form.edition}
            onChange={(e) => setForm((f) => ({ ...f, edition: e.target.value }))}
            placeholder="pl. Pear Edition"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Státusz</label>
          <select
            className="select"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProductStatus }))}
          >
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Kártya-verzió</label>
          <select
            className="select"
            value={form.card_asset_id}
            onChange={(e) => setForm((f) => ({ ...f, card_asset_id: e.target.value }))}
          >
            <option value="">— Nincs —</option>
            {cardAssets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.language} · {c.version}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Beszállító</label>
          <select
            className="select"
            value={form.supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
          >
            <option value="">— Nincs —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Egységköltség (COGS)</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.cogs}
              onChange={(e) => setForm((f) => ({ ...f, cogs: e.target.value }))}
              placeholder="pl. 6.77"
            />
            <input
              className="input w-24 shrink-0"
              value={form.cogs_currency}
              onChange={(e) => setForm((f) => ({ ...f, cogs_currency: e.target.value.toUpperCase() }))}
              placeholder="CHF"
              maxLength={3}
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Eladási ár</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.sale_price}
              onChange={(e) => setForm((f) => ({ ...f, sale_price: e.target.value }))}
              placeholder="pl. 29"
            />
            <select
              className="select w-24 shrink-0"
              value={form.sale_price_currency}
              onChange={(e) => setForm((f) => ({ ...f, sale_price_currency: e.target.value as CurrencyCode }))}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Leírás</label>
        <textarea
          className="textarea min-h-16"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Opcionális…"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Gyártási megjegyzés</label>
        <textarea
          className="textarea min-h-16"
          value={form.production_note}
          onChange={(e) => setForm((f) => ({ ...f, production_note: e.target.value }))}
          placeholder="Csak akkor tölts ki, ha eltérő gyártási logika vonatkozik erre a termékre — ez adja a „Külön gyártási folyamat” jelvényt."
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Kép</label>
        <div className="flex items-center gap-3">
          {(imageFile || existingImageUrl) && (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-ivory-dim">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageFile ? URL.createObjectURL(imageFile) : (existingImageUrl as string)}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <label className="btn btn-ghost cursor-pointer text-xs">
            <Upload size={14} /> {imageFile || existingImageUrl ? "Kép cseréje" : "Kép feltöltése"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Mentés…" : editingId ? "Mentés" : "Termék létrehozása"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={resetForm}>
          Mégse
        </button>
      </div>
    </>
  );

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Termékek" />
        <EmptyState icon={Tag} title="Csatlakoztasd a Supabase-t a termékkatalógus használatához" />
      </>
    );
  }

  const groups = PRODUCT_STATUSES.map((status) => ({
    status,
    items: products.filter((p) => p.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <PageHeader
        title="Termékek"
        subtitle="A teljes termékkatalógus — összekötve a Kártya-fájlokkal, a Beszállítókkal és a Pénzügyek kalkulátorral."
        action={
          !showForm &&
          !editingId && (
            <button className="btn btn-bronze" onClick={startCreate}>
              <Plus size={16} /> Új termék hozzáadása
            </button>
          )
        }
      />

      {(showForm || editingId) && (
        <form
          onSubmit={editingId ? saveEdit : createProduct}
          className="card mb-6 flex flex-col gap-3 p-4 sm:p-5"
        >
          <p className="text-xs font-medium text-bronze">{editingId ? "Termék szerkesztése" : "Új termék"}</p>
          {formFields}
        </form>
      )}

      {!showForm && !editingId && error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : products.length === 0 ? (
        <EmptyState icon={Tag} title="Még nincs termék" description="Add hozzá az első terméket a katalógushoz." />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(({ status, items }) => (
            <div key={status}>
              <h2 className="mb-3 flex items-center gap-2 font-serif text-lg text-forest">
                {status}
                <span className="badge bg-ivory-dim text-walnut">{items.length}</span>
              </h2>
              <div className="flex flex-col gap-3">
                {items.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currency={currency}
                    rates={rates}
                    cardAsset={product.card_asset_id ? cardAssetById.get(product.card_asset_id) : undefined}
                    supplier={product.supplier_id ? supplierById.get(product.supplier_id) : undefined}
                    expanded={expandedId === product.id}
                    onToggle={() => setExpandedId((id) => (id === product.id ? null : product.id))}
                    onEdit={() => startEdit(product)}
                    onDelete={() => deleteProduct(product)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingUndo && <UndoToast message={pendingUndo.message} onUndo={undoNow} />}
    </>
  );
}

function ProductCard({
  product,
  currency,
  rates,
  cardAsset,
  supplier,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  product: Product;
  currency: CurrencyCode;
  rates: ExchangeRates | null;
  cardAsset?: Pick<CardAsset, "id" | "language" | "version">;
  supplier?: Pick<Supplier, "id" | "name">;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showLightbox, setShowLightbox] = useState(false);
  const hasProductionNote = Boolean(product.production_note);
  const hasMargin = product.sale_price != null && product.cogs != null;
  const cogsCurrency = (product.cogs_currency as CurrencyCode | null) ?? "CHF";
  const convertedSalePrice = convertAmount(product.sale_price ?? 0, product.sale_price_currency, currency, rates);
  const convertedCogs = convertAmount(product.cogs ?? 0, cogsCurrency, currency, rates);
  const margin = hasMargin ? convertedSalePrice - convertedCogs : null;
  const marginPct = hasMargin && convertedSalePrice ? ((margin as number) / convertedSalePrice) * 100 : null;
  // Only a real warning if the conversion itself failed (rates null) —
  // a currency mismatch is otherwise handled, not just flagged.
  const showRatesWarning = rates == null && Boolean(product.sale_price_currency !== currency || (product.cogs != null && cogsCurrency !== currency));

  return (
    <div className="card overflow-hidden">
      <div onClick={onToggle} className="flex cursor-pointer flex-col gap-3 p-4 sm:flex-row sm:items-start sm:p-5">
        {product.image_url ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowLightbox(true);
            }}
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-forest/5"
            aria-label="Kép megnyitása nagyban"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          </button>
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-forest/5">
            <ImageOff size={16} className="text-muted/40" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-forest">{product.name}</p>
            <span className={`badge ${PRODUCT_STATUS_STYLES[product.status]}`}>{product.status}</span>
            {hasProductionNote && (
              <span className="badge flex items-center gap-1 bg-yellow-100 text-yellow-800">
                <TriangleAlert size={11} /> Külön gyártási folyamat
              </span>
            )}
          </div>
          {product.edition && <p className="mt-1 text-xs text-muted">{product.edition}</p>}
          {product.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{product.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-forest"
            aria-label="Szerkesztés"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded-md p-1.5 text-muted hover:bg-ivory-dim hover:text-red-600"
            aria-label="Törlés"
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
        </div>
      </div>

      {expanded && (
        <div className="animate-fade-in border-t border-border bg-ivory-dim/40 p-4 sm:p-5">
          <BackButton onClick={onToggle} label="Vissza a listához" />
          {hasProductionNote && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2.5 text-sm text-yellow-900">
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              <span>{product.production_note}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Kártya-verzió</p>
              {cardAsset ? (
                <Link href="/card-assets" className="mt-1 flex items-center gap-1.5 text-sm text-forest hover:text-bronze">
                  <Layers size={14} /> {cardAsset.language} · {cardAsset.version} <ArrowRight size={13} />
                </Link>
              ) : (
                <p className="mt-1 text-sm text-muted">— Nincs összekapcsolva —</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Beszállító</p>
              {supplier ? (
                <Link href="/suppliers" className="mt-1 flex items-center gap-1.5 text-sm text-forest hover:text-bronze">
                  <Truck size={14} /> {supplier.name} <ArrowRight size={13} />
                </Link>
              ) : (
                <p className="mt-1 text-sm text-muted">— Nincs összekapcsolva —</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Egységköltség (COGS)</p>
              <p className="mt-1 text-sm text-forest">
                {product.cogs != null ? formatMoney(product.cogs, cogsCurrency) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Eladási ár</p>
              <p className="mt-1 text-sm text-forest">
                {product.sale_price != null ? formatMoney(product.sale_price, product.sale_price_currency) : "—"}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Árrés {(product.sale_price_currency !== currency || cogsCurrency !== currency) && `(${currency}-ra átváltva)`}
              </p>
              {hasMargin ? (
                <p className={`mt-1 text-sm font-medium ${(margin as number) < 0 ? "text-red-600" : "text-forest"}`}>
                  {formatMoney(margin as number, currency)}{" "}
                  <span className="text-xs font-normal text-muted">({(marginPct as number).toFixed(1)}%)</span>
                  {showRatesWarning && (
                    <span className="ml-2 text-xs font-normal text-yellow-700">
                      ⚠ nem sikerült élő árfolyamot lekérni, ez a szám átváltás nélküli
                    </span>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">— Add meg a COGS-t és az eladási árat a számításhoz —</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showLightbox && product.image_url && (
        <Lightbox src={product.image_url} alt={product.name} onClose={() => setShowLightbox(false)} />
      )}
    </div>
  );
}
