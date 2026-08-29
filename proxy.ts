import { NextResponse, type NextRequest } from "next/server";

// Optional single-user protection: if DASHBOARD_USER and DASHBOARD_PASSWORD
// are both set as environment variables, every founder-dashboard page
// requires a browser Basic Auth prompt with those credentials. If either is
// unset, the dashboard stays open (useful for local dev).
//
// /landing is the public, customer-facing page and is always excluded — see
// the matcher below — so it (and the fonts/images it loads) stays reachable
// by visitors even when the dashboard itself is locked down.
//
// /api/reminder-email is also excluded: it's called by Vercel Cron with an
// `Authorization: Bearer <CRON_SECRET>` header (its own auth, checked inside
// the route itself), not Basic Auth — without this exclusion, turning on
// DASHBOARD_USER/DASHBOARD_PASSWORD would make this proxy reject the cron
// job's request before it ever reaches that check, silently breaking the
// daily reminder email.
//
// /api/og is excluded for the same reason /landing is: it's the social-
// preview image for that public page (app/landing/page.tsx's
// generateMetadata points og:image/twitter:image at it) — Facebook/Twitter/
// Slack's link-preview crawlers can't send Basic Auth credentials, so
// without this exclusion every shared /landing link would show a broken
// image the moment DASHBOARD_USER/DASHBOARD_PASSWORD are set.
//
// /api/calendar/ics is excluded too: it's the Naptár .ics subscription
// feed (Beállítások → "Naptár feliratkozás"), meant to be pasted into
// Google Calendar/Apple Naptár/a phone's calendar app — those poll the
// URL periodically and generally can't supply Basic Auth credentials
// either. It has its own gate instead (a ?token= checked inside the
// route against company_settings.ics_token), same soft-gate reasoning
// as the /together access code.
//
// /api/newsletter/unsubscribe is excluded for the same reason: it's the
// leiratkozás link at the bottom of every campaign email (see
// lib/email-campaign.ts), clicked by an external recipient's browser
// with no Basic Auth credentials to offer.
export function proxy(request: NextRequest) {
  const user = process.env.DASHBOARD_USER;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!user || !password) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const separatorIndex = decoded.indexOf(":");
      const suppliedUser = decoded.slice(0, separatorIndex);
      const suppliedPassword = decoded.slice(separatorIndex + 1);
      if (suppliedUser === user && suppliedPassword === password) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Zusammen Dashboard"' },
  });
}

export const config = {
  matcher:
    "/((?!_next/static|_next/image|favicon.ico|landing|fonts|images|api/reminder-email|api/og|api/calendar/ics|api/newsletter/unsubscribe).*)",
};
