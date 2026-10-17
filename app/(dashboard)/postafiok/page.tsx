"use client";

import { useEffect, useState } from "react";
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
  const [deepLinkThreadId, setDeepLinkThreadId] = useState<string | null>(null);

  // Deep link a "Levelek" szakaszokból (kampány/jelentkező/rendelés/eset/
  // beszállító oldaláról): /postafiok?thread=<id> — ugyanaz a minta, mint
  // a kampány-oldal ?tab=signups&signup=<id> deep linkje.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get("thread");
    if (threadId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab("inbox");
      setDeepLinkThreadId(threadId);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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

      {tab === "inbox" && <MailInbox initialThreadId={deepLinkThreadId} />}
      {tab === "accounts" && <MailAccountsSection />}
      {tab === "rules" && <MailRulesSection />}
      {tab === "templates" && <MailTemplatesSection />}
      {tab === "labels" && <MailLabelsSection />}
    </>
  );
}
