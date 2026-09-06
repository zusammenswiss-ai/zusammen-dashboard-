import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

// A fixed, valid 32-byte (64 hex char) key — same shape `openssl rand
// -hex 32` produces, just deterministic for the test.
const VALID_KEY = "a".repeat(64);

describe("encryptToken / decryptToken", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips a plaintext string", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", VALID_KEY);
    const encrypted = encryptToken("my-refresh-token");
    expect(encrypted).not.toContain("my-refresh-token");
    expect(decryptToken(encrypted)).toBe("my-refresh-token");
  });

  it("produces a different ciphertext each time (random IV) but decrypts the same", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", VALID_KEY);
    const a = encryptToken("same-input");
    const b = encryptToken("same-input");
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe("same-input");
    expect(decryptToken(b)).toBe("same-input");
  });

  it("throws a clear error when TOKEN_ENCRYPTION_KEY is unset", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
    expect(() => encryptToken("x")).toThrow(/nincs beállítva/);
  });

  it("throws a clear error when the key isn't a 32-byte hex string", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "too-short");
    expect(() => encryptToken("x")).toThrow(/érvénytelen/i);
  });

  it("throws on a malformed encoded token (missing parts)", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", VALID_KEY);
    expect(() => decryptToken("not-the-right-format")).toThrow(/Érvénytelen/);
  });

  it("throws when the auth tag doesn't match (tampered ciphertext)", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", VALID_KEY);
    const encrypted = encryptToken("secret");
    const [iv, authTag, cipher] = encrypted.split(":");
    // Flip the last hex digit of the ciphertext — GCM must reject this.
    const tampered = [iv, authTag, cipher.slice(0, -1) + (cipher.at(-1) === "0" ? "1" : "0")].join(":");
    expect(() => decryptToken(tampered)).toThrow();
  });
});
