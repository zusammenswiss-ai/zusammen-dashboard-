// Base URL for absolute/relative metadata resolution (root layout's
// metadataBase, and the OG image route's own absolute URLs). Falls back to
// the default Vercel preview domain already referenced elsewhere in the
// README (e.g. the reminder-email cron URL) so things still resolve before
// a real production domain is wired up via the SITE_URL env var.
export const SITE_URL = (process.env.SITE_URL?.replace(/\/$/, "") || "https://zusammen-dashboard.vercel.app") as string;
