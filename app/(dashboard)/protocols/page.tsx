"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, ClipboardList } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { CurrencyCode, Protocol } from "@/lib/supabase/types";
import { DEFAULT_CURRENCY } from "@/lib/company-settings";
import { fetchExchangeRates, type ExchangeRates } from "@/lib/exchange-rates";
import { useUserRole } from "@/lib/user-role";
import { formatDate } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { Spinner, ErrorBanner } from "@/components/Feedback";
import EmptyState from "@/components/EmptyState";
import SearchBar from "@/components/SearchBar";
import ProtocolDetailModal from "@/components/protocols/ProtocolDetailModal";
import { errorMessage } from "@/lib/errors";

function byDateDesc(a: Protocol, b: Protocol) {
  return b.entry_date.localeCompare(a.entry_date);
}

function searchableText(p: Protocol): string {
  return [p.topics, p.decisions, p.risks, p.next_focus, ...p.action_items.map((i) => i.text)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function summaryLine(p: Protocol): string {
  const focus = p.next_focus?.split("\n").find((l) => l.trim());
  return focus?.trim() || "— nincs rögzített következő heti fókusz —";
}

/**
 * Jegyzőkönyvek — heti/rendszeres megbeszélés-jegyzőkönyv, szándékosan
 * önálló modul (lásd supabase/schema.sql protocols kommentjét), csak két
 * ponton kötve a Feladatok modulhoz: a "Következő heti fókusz → Feladat
 * létrehozása" gombbal, és az akciópontok opcionális, szabad szöveges
 * hivatkozás-mezőjével — egyik sem élő, kétirányú szinkron.
 */
export default function ProtocolsPage() {
  const supabase = getSupabaseClient();
  const { isFounder } = useUserRole();
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [protocolsRes, settingsRes] = await Promise.all([
      supabase.from("protocols").select("*"),
      supabase.from("company_settings").select("currency").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (protocolsRes.error) setError(errorMessage(protocolsRes.error, "Nem sikerült betölteni a jegyzőkönyveket."));
    setProtocols(protocolsRes.data ?? []);
    setCurrency(settingsRes.data?.currency ?? DEFAULT_CURRENCY);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (supabase) void load();
  }, [supabase, load]);

  useEffect(() => {
    fetchExchangeRates().then((result) => {
      if (result.ok) setRates(result.rates);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...protocols]
      .filter((p) => !q || p.entry_date.includes(q) || searchableText(p).includes(q))
      .sort(byDateDesc);
  }, [protocols, search]);

  const openProtocol = openId === "new" ? null : (protocols.find((p) => p.id === openId) ?? null);

  if (!isSupabaseConfigured) return null;

  return (
    <>
      <PageHeader
        title="Jegyzőkönyvek"
        subtitle="Heti/rendszeres megbeszélés-jegyzőkönyvek — befagyasztott statisztika-pillanatképpel, döntésekkel és akciópontokkal."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Keresés dátum, téma, döntés, akciópont szerint…" />
        {isFounder && (
          <button
            type="button"
            className="btn btn-bronze !px-3 !py-1.5 text-xs"
            onClick={() => {
              setCreating(true);
              setOpenId("new");
            }}
          >
            <Plus size={14} /> Új jegyzőkönyv
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={protocols.length === 0 ? "Még nincs rögzített jegyzőkönyv" : "Nincs a keresésnek megfelelő bejegyzés"}
          description={protocols.length === 0 ? "Az „Új jegyzőkönyv” gombbal kezdheted el a heti megbeszélések rögzítését." : undefined}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenId(p.id)}
              className="flex w-full flex-col items-start gap-0.5 rounded-md border border-border px-4 py-3 text-left text-sm hover:border-bronze/40"
            >
              <span className="font-medium text-forest">{formatDate(p.entry_date)}</span>
              <span className="line-clamp-1 text-xs text-muted">{summaryLine(p)}</span>
            </button>
          ))}
        </div>
      )}

      {(openId !== null) && (
        <ProtocolDetailModal
          protocol={creating ? null : openProtocol}
          isFounder={isFounder}
          currency={currency}
          rates={rates}
          onSaved={(saved) => {
            setProtocols((prev) => {
              const exists = prev.some((p) => p.id === saved.id);
              return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
            });
            setCreating(false);
            setOpenId(saved.id);
          }}
          onDeleted={(id) => {
            setProtocols((prev) => prev.filter((p) => p.id !== id));
          }}
          onClose={() => {
            setOpenId(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}
