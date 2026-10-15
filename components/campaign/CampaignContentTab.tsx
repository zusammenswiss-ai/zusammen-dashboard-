"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import type { MarketingContent } from "@/lib/supabase/types";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/lib/format";

const CONTENT_TYPE_STYLES: Record<string, string> = {
  "Instagram poszt": "bg-forest/10 text-forest",
  "Instagram story": "bg-bronze/15 text-walnut",
  Email: "bg-teal/10 text-teal",
  Kampány: "bg-walnut/15 text-walnut",
};
const CONTENT_STATUS_STYLES: Record<string, string> = {
  Ötlet: "bg-ivory-dim text-walnut",
  Tervezve: "bg-bronze/15 text-walnut",
  Ütemezve: "bg-forest-light/15 text-forest",
  Kiküldve: "bg-forest/10 text-forest",
};

/** Tartalom fül — a kampányra szűrt Tartalom-naptár elemek. Az új
 * tartalom felvétele a Tartalom-naptár fülről történik (ott válaszd ki
 * ugyanezt a kampányt a "Kampány" mezőnél) — ez a fül a már hozzárendelt
 * elemeket mutatja, egy helyen, kampány-nézetben. */
export default function CampaignContentTab({ content }: { content: MarketingContent[] }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted">A kampányhoz rendelt Tartalom-naptár elemek.</p>
        <Link href="/marketing" className="flex items-center gap-1 text-xs font-medium text-bronze hover:underline">
          Új tartalom a Tartalom-naptárban <ArrowRight size={12} />
        </Link>
      </div>
      {content.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Még nincs tartalom ehhez a kampányhoz"
          description='A Tartalom-naptár fülön "+ Új tartalom"-nál válaszd ki ezt a kampányt a "Kampány" mezőnél.'
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {content.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-forest">{item.title}</p>
                {item.copy_text && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{item.copy_text}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={`badge ${CONTENT_TYPE_STYLES[item.content_type] ?? "bg-ivory-dim text-walnut"}`}>{item.content_type}</span>
                <span className={`badge ${CONTENT_STATUS_STYLES[item.status] ?? "bg-ivory-dim text-walnut"}`}>{item.status}</span>
                <span className="text-xs text-muted">{formatDate(item.scheduled_date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
