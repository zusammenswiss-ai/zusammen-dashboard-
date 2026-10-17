// Symmetric encryption for mail_accounts.password_encrypted (the
// Infomaniak IMAP/SMTP password) before it's stored in Supabase — see
// supabase/schema.sql's mail_accounts comment for why that table has no
// anon/authenticated RLS policy at all (service-role only).
//
// Deliberately a SEPARATE module/key from lib/token-crypto.ts
// (TOKEN_ENCRYPTION_KEY, used for the Gmail OAuth refresh token and the
// Resend API key) even though the algorithm is identical — the task
// spec explicitly calls for its own MAIL_ENCRYPTION_KEY env var, so a
// leaked/rotated key for one secret class doesn't affect the other.
//
// AES-256-GCM via Node's built-in crypto — no extra dependency needed.
// Server-only: never import this from a "use client" file. If the key
// is missing, every call throws immediately (the module "doesn't
// start") with a message the mail account/send/sync routes surface
// as-is to the Postafiók UI, per the spec's explicit requirement.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

function getKey(): Buffer {
  const raw = process.env.MAIL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("MAIL_ENCRYPTION_KEY nincs beállítva a szerver környezeti változói között.");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      "MAIL_ENCRYPTION_KEY érvénytelen — 32 bájtos (64 hex karakteres) kulcs kell, pl. `openssl rand -hex 32`."
    );
  }
  return key;
}

/** Returns "iv:authTag:ciphertext", all hex-encoded, joined with ":". */
export function encryptMailSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptMailSecret(encoded: string): string {
  const key = getKey();
  const [ivHex, authTagHex, cipherHex] = encoded.split(":");
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error("Érvénytelen titkosított postafiók-jelszó formátum.");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherHex, "hex")), decipher.final()]);
  return decrypted.toString("utf-8");
}

/** True if MAIL_ENCRYPTION_KEY is present and well-formed — used by the
 * mail account/send/sync routes to fail with a clear message instead of
 * a raw crypto exception when the module "isn't set up yet". */
export function isMailEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
