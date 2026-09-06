"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Where a Supabase Auth "reset your password" email link lands (sent from
 * /login's "Elfelejtett jelszó?" flow). Standalone, no dashboard chrome —
 * same reasoning as /login and /together.
 *
 * The link points here with a `?code=...` query param — createBrowserClient
 * (lib/supabase/client.ts) uses the PKCE flow, and @supabase/auth-js
 * auto-detects that code the instant the client is constructed (see its
 * _initialize()) and exchanges it for a real session itself; no manual
 * exchangeCodeForSession() call needed. It fires a "PASSWORD_RECOVERY" auth
 * event instead of the usual "SIGNED_IN" one, which is what this page waits
 * for below before showing the new-password form — updateUser() below would
 * otherwise fail with "Auth session missing" if called too early.
 *
 * proxy.ts treats this route as public (like /login), for the same reason:
 * the very first request here has no session cookie yet — only the
 * client-side exchange above creates one.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    if (!new URLSearchParams(window.location.search).has("code")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkInvalid(true);
      return;
    }

    // `settled` is a plain closure variable (not React state) so the event
    // handler, the getSession() fallback and the timeout below all see the
    // same up-to-date value without any stale-closure risk.
    let settled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setReady(true);
      }
    });

    // Fallback for the (rare) case the event already fired before this
    // listener was attached — e.g. a slow render on a fast network reply.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !settled) {
        settled = true;
        setReady(true);
      }
    });

    // Neither the event nor a session shows up within a few seconds →
    // the link's code was invalid, expired, or already used once.
    const timeout = setTimeout(() => {
      if (!settled) setLinkInvalid(true);
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;
    if (password.length < 8) {
      setError("A jelszónak legalább 8 karakter hosszúnak kell lennie.");
      return;
    }
    if (password !== confirm) {
      setError("A két jelszó nem egyezik.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/"), 1500);
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

        <div className="card flex flex-col gap-4 p-6">
          <div className="flex items-center gap-2 text-forest">
            <KeyRound size={16} className="text-bronze" />
            <h1 className="font-serif text-lg">Új jelszó beállítása</h1>
          </div>

          {linkInvalid ? (
            <p className="text-sm text-muted">
              Ez a link érvénytelen vagy lejárt. Kérj egy újat a{" "}
              <a href="/login" className="text-forest underline hover:text-bronze">
                bejelentkezési oldalon
              </a>
              .
            </p>
          ) : done ? (
            <p className="text-sm text-forest">✓ Jelszó frissítve — átirányítás a Dashboardra…</p>
          ) : !ready ? (
            <p className="text-sm text-muted">Link ellenőrzése…</p>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Új jelszó</label>
                <input
                  type="password"
                  required
                  autoFocus
                  autoComplete="new-password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Új jelszó megerősítése</label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button type="submit" disabled={saving} className="btn btn-primary justify-center">
                {saving ? "Mentés…" : "Jelszó mentése"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
