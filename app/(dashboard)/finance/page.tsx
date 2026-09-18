"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, LayoutGrid, Target, Receipt, Repeat, FileText, TrendingUp, Gauge, FileSpreadsheet, Download } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  Budget,
  CompanySettings,
  CurrencyCode,
  Expense,
  Invoice,
  Order,
  Product,
  Revenue,
  VatReturn,
} from "@/lib/supabase/types";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import OverviewTab from "@/components/finance/OverviewTab";
import BudgetTab from "@/components/finance/BudgetTab";
import ExpenseSection from "@/components/finance/ExpenseSection";
import RevenueSection from "@/components/finance/RevenueSection";
import CashFlowTab from "@/components/finance/CashFlowTab";
import VatTab from "@/components/finance/VatTab";
import InvoicingTab from "@/components/finance/InvoicingTab";
import ExportTab from "@/components/finance/ExportTab";
import { DEFAULT_CURRENCY } from "@/lib/company-settings";
import { fetchExchangeRates, type ExchangeRates } from "@/lib/exchange-rates";
import { resolveSignedUrls } from "@/lib/signed-storage-url";

const RECEIPT_BUCKET = "receipts";

type Tab = "overview" | "budget" | "fixed" | "variable" | "revenue" | "cashflow" | "vat" | "invoicing" | "export";

const TABS: { key: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { key: "overview", label: "Áttekintés", icon: LayoutGrid },
  { key: "budget", label: "Költségvetés", icon: Target },
  { key: "fixed", label: "Fix költségek", icon: Repeat },
  { key: "variable", label: "Változó költségek", icon: Receipt },
  { key: "revenue", label: "Bevételek", icon: FileText },
  { key: "cashflow", label: "Cash Flow", icon: TrendingUp },
  { key: "vat", label: "ÁFA/MWST", icon: Gauge },
  { key: "invoicing", label: "Számlázás", icon: FileSpreadsheet },
  { key: "export", label: "Export", icon: Download },
];

/**
 * Pénzügyek & Számvitel — teljes, szerkeszthető modul, al-fülekbe
 * szervezve (lásd TABS fent). Ez az oldal tölti be és tartja karban a
 * megosztott state-et (products/orders/expenses/revenue/budgets/
 * invoices/company_settings), minden fül csak a rá vonatkozó szeletet
 * kapja meg propokban — ugyanaz a minta, mint a Marketing oldal
 * tab-jainál.
 */
export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vatReturns, setVatReturns] = useState<VatReturn[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [ratesError, setRatesError] = useState<string | null>(null);
  // receipts bucket is private (see supabase/schema.sql) —
  // expense.receipt_url is a getPublicUrl()-shaped string that needs
  // exchanging for a signed URL before it'll actually load.
  const [receiptSignedUrls, setReceiptSignedUrls] = useState<Map<string, string>>(new Map());

  const supabase = getSupabaseClient();
  const currency: CurrencyCode = companySettings?.currency ?? DEFAULT_CURRENCY;

  const loadAll = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const [productsRes, ordersRes, expensesRes, revenueRes, budgetsRes, invoicesRes, vatRes, suppliersRes, settingsRes] =
      await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: true }),
        supabase.from("orders").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("revenue").select("*"),
        supabase.from("budgets").select("*"),
        supabase.from("invoices").select("*"),
        supabase.from("vat_returns").select("*"),
        supabase.from("suppliers").select("id, name").order("name"),
        supabase.from("company_settings").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
    if (productsRes.error) setError(productsRes.error.message);
    else setProducts(productsRes.data ?? []);
    if (!ordersRes.error) setOrders(ordersRes.data ?? []);
    if (!expensesRes.error) setExpenses(expensesRes.data ?? []);
    if (!revenueRes.error) setRevenue(revenueRes.data ?? []);
    if (!budgetsRes.error) setBudgets(budgetsRes.data ?? []);
    if (!invoicesRes.error) setInvoices(invoicesRes.data ?? []);
    if (!vatRes.error) setVatReturns(vatRes.data ?? []);
    if (!suppliersRes.error) setSuppliers(suppliersRes.data ?? []);
    setCompanySettings(settingsRes.data ?? null);

    const receiptUrls = (expensesRes.data ?? []).map((e) => e.receipt_url);
    setReceiptSignedUrls(await resolveSignedUrls(supabase, RECEIPT_BUCKET, receiptUrls));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void loadAll();
  }, [supabase, loadAll]);

  useEffect(() => {
    fetchExchangeRates().then((result) => {
      if (result.ok) setRates(result.rates);
      else setRatesError(result.error);
    });
  }, []);

  async function updateUnits(id: string, units: number) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, planned_units: units } : p)));
    if (!supabase) return;
    const { error: updateError } = await supabase.from("products").update({ planned_units: units }).eq("id", id);
    if (updateError) setError(updateError.message);
  }

  function addExpense(expense: Expense) {
    setExpenses((prev) => [expense, ...prev]);
    if (expense.receipt_url) {
      resolveSignedUrls(supabase!, RECEIPT_BUCKET, [expense.receipt_url]).then((resolved) =>
        setReceiptSignedUrls((prev) => new Map([...prev, ...resolved]))
      );
    }
  }
  function updateExpense(expense: Expense) {
    setExpenses((prev) => prev.map((e) => (e.id === expense.id ? expense : e)));
  }
  function deleteExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }
  function onReceiptResolved(storedUrl: string) {
    if (!supabase) return;
    resolveSignedUrls(supabase, RECEIPT_BUCKET, [storedUrl]).then((resolved) =>
      setReceiptSignedUrls((prev) => new Map([...prev, ...resolved]))
    );
  }

  function addRevenue(r: Revenue) {
    setRevenue((prev) => [r, ...prev]);
  }
  function updateRevenue(r: Revenue) {
    setRevenue((prev) => prev.map((x) => (x.id === r.id ? r : x)));
  }
  function deleteRevenue(id: string) {
    setRevenue((prev) => prev.filter((r) => r.id !== id));
  }

  function addBudget(b: Budget) {
    setBudgets((prev) => [b, ...prev]);
  }
  function deleteBudget(id: string) {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  function addInvoice(inv: Invoice) {
    setInvoices((prev) => [inv, ...prev]);
  }
  function updateInvoice(inv: Invoice) {
    setInvoices((prev) => prev.map((x) => (x.id === inv.id ? inv : x)));
  }
  function deleteInvoice(id: string) {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  }

  function patchSettings(patch: Partial<CompanySettings>) {
    setCompanySettings((prev) => (prev ? { ...prev, ...patch } : (patch as CompanySettings)));
  }
  function upsertVatReturn(row: VatReturn) {
    setVatReturns((prev) => (prev.some((r) => r.id === row.id) ? prev.map((r) => (r.id === row.id ? row : r)) : [...prev, row]));
  }

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.name, cogs: p.cogs, cogs_currency: p.cogs_currency })),
    [products]
  );

  if (!isSupabaseConfigured) {
    return (
      <>
        <PageHeader title="Pénzügyek" />
        <EmptyState icon={Calculator} title="Csatlakoztasd a Supabase-t a kalkulátor használatához" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Pénzügyek" subtitle="Fix/változó költségek, bevételek, költségvetés, cash flow, ÁFA/MWST és számlázás — egy helyen." />

      {error && <ErrorBanner message={error} />}
      {ratesError && (
        <p className="mb-4 text-xs text-yellow-700">
          ⚠ Nem sikerült lekérni az élő árfolyamokat ({ratesError}) — az eltérő pénznemű tételek emiatt
          átváltás nélkül, a saját számukkal szerepelnek az összesítésekben.
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`btn !py-1.5 text-xs ${tab === key ? "btn-bronze" : "btn-ghost"}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {tab === "overview" && (
            <OverviewTab products={products} orders={orders} expenses={expenses} revenue={revenue} currency={currency} rates={rates} onUpdateUnits={updateUnits} />
          )}
          {tab === "budget" && (
            <BudgetTab budgets={budgets} expenses={expenses} revenue={revenue} currency={currency} rates={rates} onAdd={addBudget} onDelete={deleteBudget} />
          )}
          {tab === "fixed" && (
            <ExpenseSection
              title="Fix költségek"
              type="Fix költség"
              expenses={expenses}
              suppliers={suppliers}
              products={productOptions}
              receiptSignedUrls={receiptSignedUrls}
              onAdd={addExpense}
              onUpdate={updateExpense}
              onDelete={deleteExpense}
              onReceiptResolved={onReceiptResolved}
            />
          )}
          {tab === "variable" && (
            <ExpenseSection
              title="Változó költségek"
              type="Változó költség"
              expenses={expenses}
              suppliers={suppliers}
              products={productOptions}
              receiptSignedUrls={receiptSignedUrls}
              showFilters
              onAdd={addExpense}
              onUpdate={updateExpense}
              onDelete={deleteExpense}
              onReceiptResolved={onReceiptResolved}
            />
          )}
          {tab === "revenue" && (
            <RevenueSection
              title="Bevételek"
              revenue={revenue}
              products={productOptions}
              onAdd={addRevenue}
              onUpdate={updateRevenue}
              onDelete={deleteRevenue}
            />
          )}
          {tab === "cashflow" && (
            <CashFlowTab
              expenses={expenses}
              revenue={revenue}
              bankBalance={companySettings?.bank_balance ?? null}
              currency={currency}
              rates={rates}
              onBankBalanceSaved={(value) => patchSettings({ bank_balance: value })}
            />
          )}
          {tab === "vat" && (
            <VatTab
              revenue={revenue}
              rates={rates}
              vatRegistered={companySettings?.vat_registered ?? false}
              vatReturns={vatReturns}
              onVatRegisteredSaved={(value) => patchSettings({ vat_registered: value })}
              onVatReturnSaved={upsertVatReturn}
            />
          )}
          {tab === "invoicing" && (
            <InvoicingTab
              invoices={invoices}
              settings={companySettings}
              onSettingsSaved={patchSettings}
              onInvoiceCreated={addInvoice}
              onInvoiceUpdated={updateInvoice}
              onInvoiceDeleted={deleteInvoice}
              onRevenueCreated={addRevenue}
            />
          )}
          {tab === "export" && <ExportTab expenses={expenses} revenue={revenue} budgets={budgets} />}
        </>
      )}
    </>
  );
}
