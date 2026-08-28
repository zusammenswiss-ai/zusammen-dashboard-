import type { Metadata } from "next";
import { Suspense } from "react";
import TogetherClient from "./TogetherClient";

// A private two-person page, not a marketing one like /landing — keep it
// out of search results even though nothing here is truly secret (see
// the schema.sql comment on together_settings for why the access code
// itself isn't a hard security boundary).
export const metadata: Metadata = {
  title: "Közös tér — Zusammen",
  description: "A közös út a Café to Connect megnyitójáig.",
  robots: { index: false, follow: false },
};

// TogetherClient reads ?code= via useSearchParams, which requires a
// Suspense boundary in the App Router — same reason app/landing/page.tsx
// keeps its client component separate rather than making this whole file
// "use client" (this one also needs to export the metadata above, which
// only a server component can do).
export default function TogetherPage() {
  return (
    <Suspense>
      <TogetherClient />
    </Suspense>
  );
}
