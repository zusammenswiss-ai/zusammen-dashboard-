"use client";

import { useState } from "react";
import { Inbox, PlugZap, ListFilter, FileText, Tag } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import MailAccountsSection from "@/components/mail/MailAccountsSection";
import MailSyncButton from "@/components/mail/MailSyncButton";
import MailInbox from "@/components/mail/MailInbox";
import MailRulesSection from "@/components/mail/MailRulesSection";
import MailTemplatesSection from "@/components/mail/MailTemplatesSection";
import MailLabelsSection from "@/components/mail/MailLabelsSection";

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
 * Fázisokban épült (lásd a PR-eket): Fiókok, IMAP-szinkron, Postaláda
 * (nézetek/szállista/szálnézet, válasz+belső jegyzet, "Feladat" gomb,
 * csatolmány-letöltés, címkézés, sablonbeszúrás), a besorolási
 * szabálymotor UI-ja, és a gyorsválasz-sablonok/címkék karbantartása.
 */
export default function PostafiokPage() {
  const [tab, setTab] = useState<Tab>("inbox");

  return (
    <>
      <PageHeader
        title="Postafiók"
        subtitle="Saját Infomaniak postafiókok — küldés és a válaszok olvasása, a First 20 jelentkezőkhöz társítva."
        action={<MailSyncButton />}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`btn ${tab === key ? "btn-bronze" : "btn-ghost"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "inbox" && <MailInbox />}
      {tab === "accounts" && <MailAccountsSection />}
      {tab === "rules" && <MailRulesSection />}
      {tab === "templates" && <MailTemplatesSection />}
      {tab === "labels" && <MailLabelsSection />}
    </>
  );
}
