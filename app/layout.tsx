import type { Metadata } from "next";
import Nav from "@/components/Nav";
import ConfigBanner from "@/components/ConfigBanner";
import "./globals.css";

// Fraunces (serif headings) and Inter (sans body) are self-hosted via plain
// @font-face rules in globals.css rather than next/font — see the comment
// there for why.

export const metadata: Metadata = {
  title: "Zusammen — Founder Dashboard",
  description: "Personal launch dashboard for the Zusammen conversation-card brand.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Nav />
          <div className="flex min-w-0 flex-1 flex-col">
            <ConfigBanner />
            <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
              <div className="mx-auto w-full max-w-6xl">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
