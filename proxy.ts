import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Optional single-user protection: if DASHBOARD_USER and DASHBOARD_PASSWORD
// are both set as environment variables, every founder-dashboard page
// requires a browser Basic Auth prompt with those credentials. If either is
// unset, this extra network-level layer is skipped (useful for local dev) —
// the Supabase Auth login below is the mandatory gate either way.
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
function checkBasicAuth(request: NextRequest): NextResponse | null {
  const user = process.env.DASHBOARD_USER;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!user || !password) {
    return null;
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
        return null;
      }
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Zusammen Dashboard"' },
  });
}

// Routes that never require a founder login, even though they're not
// excluded from this proxy entirely (Basic Auth above still applies to
// them if DASHBOARD_USER/PASSWORD are set): /login itself (obviously —
// nobody can log in from behind a login wall), and /together, the
// partner-shared page gated by its own access code (Beállítások →
// "Közös tér linkje"), never by a Supabase Auth account.
function isPublicRoute(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/together");
}

// Real, mandatory login gate — every other dashboard page needs an
// authenticated Supabase Auth session (see app/login/page.tsx). Uses
// @supabase/ssr's createServerClient so the session cookie set by the
// browser client (lib/supabase/client.ts, also switched to @supabase/ssr)
// is readable here; setAll below both keeps the request's own cookies
// current for any Server Component reading them further down the chain,
// and refreshes the response's cookies so a near-expiry session gets
// silently renewed rather than bouncing the founder to /login mid-session.
async function checkSupabaseAuth(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase not configured yet (fresh checkout, no env vars) — every page
  // already renders its own "csatlakoztasd a Supabase-t" empty state in
  // that case, so there's nothing to gate here either.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (pathname === "/login") {
    // Already logged in — no reason to show the login form again.
    if (user) return NextResponse.redirect(new URL("/", request.url));
    return response;
  }

  if (isPublicRoute(pathname)) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export async function proxy(request: NextRequest) {
  const basicAuthResponse = checkBasicAuth(request);
  if (basicAuthResponse) return basicAuthResponse;

  return checkSupabaseAuth(request);
}

export const config = {
  matcher:
    "/((?!_next/static|_next/image|favicon.ico|landing|fonts|images|api/reminder-email|api/og|api/calendar/ics|api/newsletter/unsubscribe).*)",
};
