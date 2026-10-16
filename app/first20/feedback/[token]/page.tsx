import type { Metadata } from "next";
import FeedbackClient from "./FeedbackClient";

export const metadata: Metadata = { title: "Zusammen — Visszajelzés" };

// Public, unauthenticated — see app/api/first20/feedback/[token]/route.ts
// for why this is token-gated rather than Supabase-Auth-gated. Already
// excluded from proxy.ts's login gate (shares the "first20" matcher
// token with /first20 itself). Minimal, functional page by design — not
// a restyle of /first20's own marketing copy (out of scope for this
// task), just the one thing the "Visszajelzés kérése" email needs to
// link to.
export default async function First20FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <FeedbackClient token={token} />;
}
