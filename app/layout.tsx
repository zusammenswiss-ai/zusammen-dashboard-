import type { Metadata } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/site-url";

// Fraunces (serif headings) and Inter (sans body) are self-hosted via plain
// @font-face rules in globals.css rather than next/font — see the comment
// there for why.
//
// This root layout is intentionally minimal: the founder dashboard chrome
// (sidebar nav, Supabase config banner) lives in app/(dashboard)/layout.tsx
// so that /landing — the customer-facing page — renders without it.

export const metadata: Metadata = {
  // Lets every route below use relative URLs in URL-based metadata fields
  // (e.g. app/landing/layout.tsx's openGraph.url / alternates) instead of
  // requiring each one to build an absolute URL by hand.
  metadataBase: new URL(SITE_URL),
  title: "Zusammen — Alapítói Dashboard",
  description: "Személyes indulási dashboard a Zusammen beszélgetőkártya-márkához.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
