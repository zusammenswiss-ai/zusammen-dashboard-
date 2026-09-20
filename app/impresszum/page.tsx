import type { Metadata } from "next";
import Link from "next/link";
import LandingMark from "@/components/LandingMark";
import LegalDocumentContent from "@/components/LegalDocumentContent";
import { getSupabasePublicClient } from "@/lib/supabase/publicClient";
import { formatDate } from "@/lib/format";
import "../landing/landing.css";

export const metadata: Metadata = { title: "Impresszum — Zusammen" };

// Without this, Next.js would prerender the page once at build time and
// bake in whatever legal_documents.content was at that moment — an edit
// made afterwards in Beállítások wouldn't show up until the next deploy.
// Forcing dynamic rendering means every request reads the live row.
export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated legal page — content lives in the
 * legal_documents table (Beállítások → Jogi dokumentumok), not baked
 * into this file, so the founder can edit and lock it without a code
 * change. This route is a fixed Next.js folder rather than a slug-
 * driven catch-all: it always renders whichever row has
 * type = 'Impresszum', regardless of what that row's own `slug` field
 * is currently set to — `slug` only drives what OTHER pages link to it
 * with (see lib/legal-links.ts), not where this page itself lives. Also
 * excluded from proxy.ts's auth gate (same matcher entry as `landing`).
 */
export default async function ImpresszumPage() {
  const supabase = getSupabasePublicClient();
  const { data } = supabase
    ? await supabase.from("legal_documents").select("*").eq("type", "Impresszum").maybeSingle()
    : { data: null };

  return (
    <div className="landing-root">
      <div className="legal-page">
        <Link href="/landing" className="back">
          ← Vissza a ZUSAMMEN-hez
        </Link>
        <LandingMark size={64} />
        <h1>{data?.title ?? "Impresszum"}</h1>
        {data?.last_updated && <p className="updated">Utolsó módosítás: {formatDate(data.last_updated)}</p>}
        {data ? (
          <LegalDocumentContent content={data.content} />
        ) : (
          <p>A tartalom hamarosan elérhető.</p>
        )}
        <p>
          Lásd még: <Link href="/adatvedelem" className="inline">Adatvédelmi tájékoztató</Link>
        </p>
      </div>
    </div>
  );
}
