import { describe, expect, it } from "vitest";

import {
  generateRecoveryCodes,
  generateTotp,
  hashPassword,
  openSecret,
  PASSWORD_HASH_OPTIONS,
  sealSecret,
  sealSecretWithKeyring,
  openSecretWithKeyring,
  validateTotp,
  verifyPassword,
} from "./crypto.js";

describe("identity cryptographic boundaries", () => {
  it("uses the frozen Argon2id parameters and rejects a wrong password", async () => {
    expect(PASSWORD_HASH_OPTIONS).toMatchObject({
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
    const encoded = await hashPassword("correct horse battery staple");
    expect(encoded).toContain("$argon2id$");
    expect(await verifyPassword(encoded, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(encoded, "incorrect horse battery staple")).toBe(false);
  });

  it("binds sealed factor material to its authenticator identifier", () => {
    const key = Buffer.alloc(32, 7);
    const sealed = sealSecret("synthetic-factor-secret", key, "authenticator_one");
    expect(openSecret(sealed, key, "authenticator_one")).toBe("synthetic-factor-secret");
    expect(() => openSecret(sealed, key, "authenticator_two")).toThrow();
  });

  it("creates high-entropy one-time recovery artifacts and validates TOTP", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/);
    }

    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    const at = Date.parse("2026-08-03T02:00:00.000Z");
    const token = generateTotp(secret, at);
    expect(validateTotp(secret, token, at)).toBe(Math.floor(at / 30_000));
    expect(validateTotp(secret, "000000", at)).toBeNull();
  });
});

it("activates current writes, overlaps previous reads, and rejects revoked keys", () => {
  const previous = { id: "k1", key: Buffer.alloc(32, 1) };
  const current = { id: "k2", key: Buffer.alloc(32, 2) };
  const old = sealSecretWithKeyring("synthetic-factor-secret", { current: previous }, "factor");
  const ring = { current, previous };
  expect(openSecretWithKeyring(old, ring, "factor")).toBe("synthetic-factor-secret");
  expect(sealSecretWithKeyring("new", ring, "factor")).toMatch(/^v2\.k2\./u);
  expect(() => openSecretWithKeyring(old, { current }, "factor")).toThrow(
    "SEALED_SECRET_KEY_REVOKED",
  );
  expect(() => openSecretWithKeyring(old, ring, "other")).toThrow();
});
