"use client";

import { Rocket, Mail, StickyNote, FileText, ListTodo, FileHeart, PackageCheck } from "lucide-react";
import type { First20Signup, First20Email, First20SignupNote, Document, TaskItem } from "@/lib/supabase/types";
import { FIRST20_EMAIL_TYPE_LABEL } from "@/lib/first20-signup-status";
import { formatDate } from "@/lib/format";

type TimelineEntry = {
  at: string;
  icon: typeof Rocket;
  text: string;
};

/** Egységes időrendi napló — nem egy saját tábla, csak a már betöltött
 * adatok (e-mailek, jegyzetek, dokumentumok, feladatok, visszajelzés,
 * rendelés) összefésülése és dátum szerinti rendezése, lásd a feladat
 * "A teljes jelentkező időrendi 'Napló' nézete" pontját. */
export default function SignupTimelineTab({
  signup,
  emails,
  notes,
  documents,
  tasks,
}: {
  signup: First20Signup;
  emails: First20Email[];
  notes: First20SignupNote[];
  documents: Document[];
  tasks: TaskItem[];
}) {
  const entries: TimelineEntry[] = [
    { at: signup.created_at, icon: Rocket, text: "Jelentkezett" },
    ...emails.map((e) => ({
      at: e.sent_at ?? e.created_at,
      icon: Mail,
      text: `${FIRST20_EMAIL_TYPE_LABEL[e.type]} e-mail — ${e.status === "sent" ? "elküldve" : e.status === "failed" ? "sikertelen" : "küldés alatt"}`,
    })),
    ...notes.map((n) => ({ at: n.created_at, icon: StickyNote, text: `Jegyzet${n.author ? ` (${n.author})` : ""}: ${n.body}` })),
    ...documents.map((d) => ({ at: d.created_at, icon: FileText, text: `Dokumentum feltöltve: ${d.title}` })),
    ...tasks.map((t) => ({ at: t.created_at, icon: ListTodo, text: `Feladat létrehozva: ${t.title}` })),
    ...(signup.feedback_received_at ? [{ at: signup.feedback_received_at, icon: FileHeart, text: "Visszajelzés beérkezett" }] : []),
    ...(signup.ordered_at ? [{ at: signup.ordered_at, icon: PackageCheck, text: "Rendelés leadva" }] : []),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="flex flex-col gap-1.5">
      {entries.map((entry, i) => {
        const Icon = entry.icon;
        return (
          <div key={i} className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5 text-sm">
            <Icon size={15} className="mt-0.5 shrink-0 text-bronze" />
            <p className="flex-1 text-forest">{entry.text}</p>
            <span className="shrink-0 text-xs text-muted">{formatDate(entry.at)}</span>
          </div>
        );
      })}
    </div>
  );
}
