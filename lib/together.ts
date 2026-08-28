// Shared helpers for the Közös tér (/together) feature — the access-code
// generator used by the admin Settings page, and the localStorage
// identity helpers used by app/together itself. Kept in one place so the
// two consumers can't drift on the code's format or the storage keys.

// Excludes visually-ambiguous characters (0/O, 1/I/L) — this code gets
// typed by hand on a phone, so every character needs to be unambiguous
// at a glance.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

/** Generates a fresh 6-character access code (browser-side, no server round-trip needed). */
export function generateAccessCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export function normalizeAccessCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

const STORAGE_CODE_KEY = "together_access_code";
const STORAGE_NAME_KEY = "together_viewer_name";

export function getStoredAccessCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_CODE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAccessCode(code: string): void {
  try {
    localStorage.setItem(STORAGE_CODE_KEY, code);
  } catch {
    // localStorage can be unavailable (private mode, disabled) — the
    // session still works for this page load, just re-asks next time.
  }
}

export function getStoredViewerName(): string | null {
  try {
    return localStorage.getItem(STORAGE_NAME_KEY);
  } catch {
    return null;
  }
}

export function setStoredViewerName(name: string): void {
  try {
    localStorage.setItem(STORAGE_NAME_KEY, name);
  } catch {
    // See getStoredAccessCode — non-fatal, just re-asks next time.
  }
}

export function clearTogetherIdentity(): void {
  try {
    localStorage.removeItem(STORAGE_CODE_KEY);
    localStorage.removeItem(STORAGE_NAME_KEY);
  } catch {
    // Nothing to clean up if storage was never reachable.
  }
}
