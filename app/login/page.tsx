"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

/** The founder dashboard's real login gate (Supabase Auth, email + jelszó)
 * — standalone, no dashboard chrome (lives outside the (dashboard) route
 * group, same reasoning as /landing and /together). proxy.ts redirects
 * every dashboard page here when there's no session, with a `?next=`
 * pointing back at whatever page was requested; a session already present
 * gets redirected away from here straight to `/` by that same proxy check,
 * so this page never needs to worry about the "already logged in" case
 * itself. */
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setSaving(false);
      setError(
        signInError.message === "Invalid login credentials"
          ? "Hibás email cím vagy jelszó."
          : signInError.message
      );
      return;
    }
    // The session cookie is already set (synchronously, via document.cookie)
    // by the time signInWithPassword resolves, so a normal client-side
    // navigation is enough — proxy.ts re-runs for the new route and sees it.
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") ? next : "/");
  }

  // "Elfelejtett jelszó?" — sends Supabase's own reset email, pointing back
  // at /reset-password (a separate public page, see app/reset-password —
  // it does the actual "set a new password" step once the link is
  // clicked). The confirmation message is deliberately the same whether or
  // not the address has an account, so this can't be used to check which
  // emails are registered.
  async function submitForgot(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setSaving(true);
    setError(null);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSaving(false);
    setResetSent(true);
  }

  function switchMode(next: "signin" | "forgot") {
    setMode(next);
    setError(null);
    setResetSent(false);
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ivory px-4">
        <p className="text-sm text-muted">Csatlakoztasd a Supabase-t a bejelentkezéshez.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ivory px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-bronze font-serif text-2xl font-semibold text-white">
            Z
          </span>
          <div>
            <p className="font-serif text-2xl text-forest">Zusammen</p>
            <p className="text-sm text-muted">Alapítói Dashboard</p>
          </div>
        </div>

        {mode === "signin" ? (
          <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2 text-forest">
              <LockKeyhole size={16} className="text-bronze" />
              <h1 className="font-serif text-lg">Bejelentkezés</h1>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Email cím</label>
              <input
                type="email"
                required
                autoFocus
                autoComplete="username"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="zusammen.swiss@gmail.com"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-medium text-muted">Jelszó</label>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs text-muted underline hover:text-forest"
                >
                  Elfelejtett jelszó?
                </button>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button type="submit" disabled={saving} className="btn btn-primary justify-center">
              {saving ? "Bejelentkezés…" : "Bejelentkezés"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitForgot} className="card flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2 text-forest">
              <LockKeyhole size={16} className="text-bronze" />
              <h1 className="font-serif text-lg">Jelszó visszaállítása</h1>
            </div>

            {resetSent ? (
              <p className="text-sm text-muted">
                Ha létezik fiók ezzel az email címmel, elküldtük rá a jelszó-visszaállító linket — nézd meg a
                postaládát (és a spam mappát is).
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Email cím</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="username"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="zusammen.swiss@gmail.com"
                  />
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <button type="submit" disabled={saving} className="btn btn-primary justify-center">
                  {saving ? "Küldés…" : "Visszaállító link küldése"}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-center text-xs text-muted underline hover:text-forest"
            >
              Vissza a bejelentkezéshez
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
