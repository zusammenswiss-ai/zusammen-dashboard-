// Symmetric encryption for the Gmail OAuth refresh token before it's
// stored in Supabase (gmail_connection.encrypted_refresh_token) — see
// supabase/schema.sql for why that table has no anon RLS policy at all.
// Encrypting the token at rest is a second layer on top of that: even a
// direct database dump doesn't hand over live Gmail send access without
// TOKEN_ENCRYPTION_KEY too.
//
// AES-256-GCM via Node's built-in crypto — no extra dependency needed.
// Server-only: never import this from a "use client" file.
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY nincs beállítva a szerver környezeti változói között."
    );
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY érvénytelen — 32 bájtos (64 hex karakteres) kulcs kell, pl. `openssl rand -hex 32`."
    );
  }
  return key;
}

/** Returns "iv:authTag:ciphertext", all hex-encoded, joined with ":". */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptToken(encoded: string): string {
  const key = getKey();
  const [ivHex, authTagHex, cipherHex] = encoded.split(":");
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error("Érvénytelen titkosított token formátum.");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf-8");
}
