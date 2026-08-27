// Base URL for absolute/relative metadata resolution (root layout's
// metadataBase, and the OG image route's own absolute URLs). Falls back to
// the default Vercel preview domain already referenced elsewhere in the
// README (e.g. the reminder-email cron URL) so things still resolve before
// a real production domain is wired up via the SITE_URL env var.
const FALLBACK_SITE_URL = "https://zusammen-dashboard.vercel.app";

// `metadataBase: new URL(SITE_URL)` runs at module-load time in the root
// layout, which every single route imports — an invalid SITE_URL (missing
// protocol, stray whitespace, whatever) would otherwise throw there and
// take the entire site down at build time, not just /landing. Validating
// here means a bad env var degrades to the fallback domain instead.
function resolveSiteUrl(): string {
  const raw = process.env.SITE_URL?.trim().replace(/\/$/, "");
  if (!raw) return FALLBACK_SITE_URL;
  try {
    new URL(raw);
    return raw;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_URL = resolveSiteUrl();
