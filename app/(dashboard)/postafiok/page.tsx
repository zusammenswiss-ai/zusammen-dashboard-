"use client";

import { useState } from "react";
import { Inbox, PlugZap, ListFilter, FileText, Tag } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import MailAccountsSection from "@/components/mail/MailAccountsSection";

type Tab = "inbox" | "accounts" | "rules" | "templates" | "labels";

const TABS: { key: Tab; label: string; icon: typeof Inbox }[] = [
  { key: "inbox", label: "Postaláda", icon: Inbox },
  { key: "accounts", label: "Fiókok", icon: PlugZap },
  { key: "rules", label: "Szabályok", icon: ListFilter },
  { key: "templates", label: "Sablonok", icon: FileText },
  { key: "labels", label: "Címkék", icon: Tag },
];

/**
 * Postafiók — saját Infomaniak IMAP/SMTP postafiókok a Dashboardból.
 * Fázisokban épül (lásd a PR-eket): ez a 2. fázis csak a Fiókok fület
 * teszi élessé (CRUD + "Kapcsolat tesztelése"); a Postaláda (3-paneles
 * levelezőnézet), Szabályok, Sablonok és Címkék fülek a következő
 * fázisokban készülnek — a végleges útvonal-struktúra már most áll, hogy
 * ne kelljen később linket/útvonalat váltani.
 */
export default function PostafiokPage() {
  const [tab, setTab] = useState<Tab>("inbox");

  return (
    <>
      <PageHeader
        title="Postafiók"
        subtitle="Saját Infomaniak postafiókok — küldés és a válaszok olvasása, a First 20 jelentkezőkhöz társítva."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`btn ${tab === key ? "btn-bronze" : "btn-ghost"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "inbox" && (
        <EmptyState
          icon={Inbox}
          title="A postaláda nézet hamarosan elkészül"
          description="Elsőként állíts be egy postafiókot a 'Fiókok' fülön — utána itt fognak megjelenni a beérkezett és elküldött levelek, szálakba rendezve."
        />
      )}
      {tab === "accounts" && <MailAccountsSection />}
      {tab === "rules" && (
        <EmptyState icon={ListFilter} title="A besorolási szabályok hamarosan elkészülnek" description="Terület, kapcsolt elem, felelős és feladat automatikus beállítása bejövő levelek alapján." />
      )}
      {tab === "templates" && (
        <EmptyState icon={FileText} title="A gyorsválasz-sablonok hamarosan elkészülnek" description="Területenkénti, változókkal ({{first_name}} stb.) kitölthető válaszsablonok." />
      )}
      {tab === "labels" && <EmptyState icon={Tag} title="A címkék hamarosan elkészülnek" description="Szabadon létrehozható, színes címkék a levélszálakhoz." />}
    </>
  );
}
