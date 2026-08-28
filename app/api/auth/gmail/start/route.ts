import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { buildAuthorizeUrl, isGoogleOAuthConfigured } from "@/lib/google-oauth";

// GET /api/auth/gmail/start — "Gmail összekapcsolása" button on
// Beállítások links straight here. Generates a CSRF state token, stashes
// it in a short-lived cookie, then redirects to Google's consent screen;
// /api/auth/gmail/callback checks the state matches before trusting the
// returned authorization code.
export const dynamic = "force-dynamic";

const STATE_COOKIE = "gmail_oauth_state";

export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET nincs beállítva a szerveren." },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes is plenty for the founder to click through the consent screen
    path: "/",
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
