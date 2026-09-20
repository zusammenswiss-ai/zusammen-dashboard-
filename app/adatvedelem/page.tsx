import type { Metadata } from "next";
import Link from "next/link";
import LandingMark from "@/components/LandingMark";
import LegalDocumentContent from "@/components/LegalDocumentContent";
import { getSupabasePublicClient } from "@/lib/supabase/publicClient";
import { formatDate } from "@/lib/format";
import "../landing/landing.css";

export const metadata: Metadata = { title: "Adatvédelem — Zusammen" };

// See app/impresszum/page.tsx's comment — same reasoning, forces a
// fresh legal_documents read on every request instead of a build-time
// snapshot.
export const dynamic = "force-dynamic";

/** Public, unauthenticated legal page — see app/impresszum/page.tsx's
 * comment for the full story (same route-vs-slug reasoning applies
 * here). */
export default async function AdatvedelemPage() {
  const supabase = getSupabasePublicClient();
  const { data } = supabase
    ? await supabase.from("legal_documents").select("*").eq("type", "Adatvédelem").maybeSingle()
    : { data: null };

  return (
    <div className="landing-root">
      <div className="legal-page">
        <Link href="/landing" className="back">
          ← Vissza a ZUSAMMEN-hez
        </Link>
        <LandingMark size={64} />
        <h1>{data?.title ?? "Adatvédelmi tájékoztató"}</h1>
        {data?.last_updated && <p className="updated">Utolsó módosítás: {formatDate(data.last_updated)}</p>}
        {data ? (
          <LegalDocumentContent content={data.content} />
        ) : (
          <p>A tartalom hamarosan elérhető.</p>
        )}
        <p>
          Lásd még: <Link href="/impresszum" className="inline">Impresszum</Link>
        </p>
      </div>
    </div>
  );
}
