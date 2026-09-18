// Shared "what do I show the user" helper for a catch block. A real
// thrown `Error` (or subclass) always has `.message`, but a Supabase
// query's own `{ data, error }` result — the `error` re-thrown as
// `if (queryError) throw queryError;`, the pattern used all over this
// app — is a PLAIN OBJECT (built from `JSON.parse`-ing the Postgrest
// response body), not an `Error` instance, since supabase-js only
// throws a real `PostgrestError` when `.throwOnError()` is explicitly
// used, which this app never does. `err instanceof Error` is false for
// that plain object, so a naive `err instanceof Error ? err.message :
// fallback` silently swallows the real database error (missing column,
// RLS denial, check-constraint violation, …) and always shows the
// generic fallback text instead — this is exactly that check, done
// right: it also accepts anything with a string `.message`, Error or not.
export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) {
    return err.message;
  }
  return fallback;
}
