import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens, fetchGoogleAccountEmail } from "@/lib/google-oauth";
import { saveGmailConnection } from "@/lib/email/gmail-sender";
import { SITE_URL } from "@/lib/site-url";

// GET /api/auth/gmail/callback — where Google redirects back to after
// the founder approves (or denies) the gmail.send consent screen.
export const dynamic = "force-dynamic";

const STATE_COOKIE = "gmail_oauth_state";

function settingsRedirect(status: "connected" | "error", message?: string) {
  const url = new URL("/settings", SITE_URL);
  url.searchParams.set("gmail", status);
  if (message) url.searchParams.set("gmail_error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (error) {
    // e.g. the founder clicked "Cancel" on the consent screen.
    return settingsRedirect("error", "A Google engedélyezés megszakadt.");
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return settingsRedirect("error", "Érvénytelen vagy lejárt engedélyezési kérés — próbáld újra.");
  }

  try {
    const { accessToken, refreshToken, expiresInSeconds } = await exchangeCodeForTokens(code);
    const googleEmail = await fetchGoogleAccountEmail(accessToken);
    await saveGmailConnection({ googleEmail, refreshToken, accessToken, expiresInSeconds });
    return settingsRedirect("connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nem sikerült összekapcsolni a Gmail fiókot.";
    return settingsRedirect("error", message);
  }
}
