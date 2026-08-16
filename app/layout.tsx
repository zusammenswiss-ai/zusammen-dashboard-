import type { Metadata } from "next";
import "./globals.css";

// Fraunces (serif headings) and Inter (sans body) are self-hosted via plain
// @font-face rules in globals.css rather than next/font — see the comment
// there for why.
//
// This root layout is intentionally minimal: the founder dashboard chrome
// (sidebar nav, Supabase config banner) lives in app/(dashboard)/layout.tsx
// so that /landing — the customer-facing page — renders without it.

export const metadata: Metadata = {
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
