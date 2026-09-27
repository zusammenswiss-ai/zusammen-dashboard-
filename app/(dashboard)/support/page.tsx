"use client";

import { useState } from "react";
import { Inbox, ListTodo, FileText, HelpCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import TicketsSection from "@/components/support/TicketsSection";
import SupportTodosSection from "@/components/support/SupportTodosSection";
import SupportTemplatesSection from "@/components/support/SupportTemplatesSection";
import SupportFaqsSection from "@/components/support/SupportFaqsSection";

type Tab = "tickets" | "todos" | "templates" | "faqs";

const TABS: { key: Tab; label: string; icon: typeof Inbox }[] = [
  { key: "tickets", label: "Megkeresések", icon: Inbox },
  { key: "todos", label: "Saját feladatok", icon: ListTodo },
  { key: "templates", label: "Sablonválaszok", icon: FileText },
  { key: "faqs", label: "GYIK", icon: HelpCircle },
];

/**
 * Ügyfélszolgálat — teljesen önálló modul, szándékosan elkülönítve a
 * Feladatok/Kanban modultól (lásd supabase/schema.sql support_tickets
 * kommentjét): saját adatstruktúra, saját al-lista, hogy az ügyfél-
 * megkeresések és az ügyfélszolgálati teendők ne keveredjenek a márka/
 * termék-szintű feladatokkal. Kézi nyilvántartás — nincs email-fiók
 * összekapcsolás.
 */
export default function SupportPage() {
  const [tab, setTab] = useState<Tab>("tickets");

  return (
    <>
      <PageHeader
        title="Ügyfélszolgálat"
        subtitle="Ügyfél-megkeresések, saját teendők, sablonválaszok és GYIK — egy helyen, függetlenül a Feladatok modultól."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`btn !py-1.5 text-xs ${tab === key ? "btn-bronze" : "btn-ghost"}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === "tickets" && <TicketsSection />}
      {tab === "todos" && <SupportTodosSection />}
      {tab === "templates" && <SupportTemplatesSection />}
      {tab === "faqs" && <SupportFaqsSection />}
    </>
  );
}
