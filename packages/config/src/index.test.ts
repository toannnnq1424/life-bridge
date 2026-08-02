import { describe, expect, it } from "vitest";

import {
  createServiceAssertion,
  DependencyGuard,
  requiredDependencyUrl,
  requiredKey,
  requiredPostgresUrl,
  requiredRotationKeyring,
  requireFixtureSafeMode,
  verifyServiceAssertion,
} from "./index.js";

describe("fixture runtime boundary", () => {
  it("allows fixture identity only in local and test modes", () => {
    expect(requireFixtureSafeMode("local", "true")).toEqual({
      mode: "local",
      fixtureEnabled: true,
    });
    expect(() => requireFixtureSafeMode("production", "true")).toThrow(
      "FIXTURE_IDENTITY_FORBIDDEN",
    );
    expect(() =>
      requireFixtureSafeMode("local", "true", "0.0.0.0", "http://127.0.0.1:3000"),
    ).toThrow("FIXTURE_IDENTITY_FORBIDDEN");
    expect(() =>
      requireFixtureSafeMode("test", "true", "127.0.0.1", "https://public.example"),
    ).toThrow("FIXTURE_IDENTITY_FORBIDDEN");
    expect(requireFixtureSafeMode("production", "false", "0.0.0.0", "https://app.example")).toEqual(
      { mode: "production", fixtureEnabled: false },
    );
  });

  it("accepts only an exact 256-bit base64url key", () => {
    const encoded = Buffer.alloc(32, 7).toString("base64url");
    expect(requiredKey(encoded, "IDENTITY_DATA_KEY")).toEqual(Buffer.alloc(32, 7));
    expect(() => requiredKey("too-short", "IDENTITY_DATA_KEY")).toThrow(
      "IDENTITY_DATA_KEY_MISSING_OR_INVALID",
    );
  });

  it("freezes bounded keyring and PostgreSQL transport contracts", () => {
    const current = Buffer.alloc(32, 7).toString("base64url");
    const previous = Buffer.alloc(32, 8).toString("base64url");
    expect(
      requiredRotationKeyring(current, "k2", previous, "k1", "IDENTITY_DATA_KEY"),
    ).toMatchObject({
      current: { id: "k2" },
      previous: { id: "k1" },
    });
    expect(() =>
      requiredRotationKeyring(current, "k1", current, "k1", "IDENTITY_DATA_KEY"),
    ).toThrow();
    expect(
      requiredPostgresUrl("postgresql://db/app?sslmode=verify-full", "DB", "production"),
    ).toContain("verify-full");
    expect(() => requiredPostgresUrl("postgresql://db/app", "DB", "production")).toThrow(
      "DB_TRANSPORT_UNPROTECTED",
    );
    expect(requiredPostgresUrl("postgresql://127.0.0.1/app", "DB", "test")).toContain("127.0.0.1");
  });
});

describe("P6-S3 service communication", () => {
  const secret = "synthetic-service-identity-key-000001";
  const now = new Date("2026-08-02T00:00:30.000Z");

  it("verifies caller, audience, scope, expiry and rotation key id", () => {
    const assertion = createServiceAssertion({
      caller: "gateway",
      audience: "care-coordination",
      scope: "care.access",
      keyId: "current",
      secret,
      now,
      nonce: "synthetic_nonce_0001",
    });
    const policy = {
      audience: "care-coordination",
      scope: "care.access",
      allowedCallers: ["gateway"],
      keys: { current: secret, previous: "synthetic-previous-service-key-0001" },
      now,
    };
    expect(verifyServiceAssertion(assertion, policy)).toBe(true);
    const previous = createServiceAssertion({
      caller: "gateway",
      audience: "care-coordination",
      scope: "care.access",
      keyId: "previous",
      secret: "synthetic-previous-service-key-0001",
      now,
      nonce: "synthetic_nonce_0002",
    });
    expect(verifyServiceAssertion(previous, policy)).toBe(true);
    expect(verifyServiceAssertion(previous, { ...policy, keys: { current: secret } })).toBe(false);
    const oldBinary = createServiceAssertion({
      caller: "gateway",
      audience: "care-coordination",
      scope: "care.access",
      keyId: "current",
      secret: "synthetic-previous-service-key-0001",
      now,
      nonce: "synthetic_nonce_0003",
    });
    expect(verifyServiceAssertion(oldBinary, policy)).toBe(false);
    expect(verifyServiceAssertion(oldBinary, { ...policy, keys: { current: secret } })).toBe(false);
    expect(verifyServiceAssertion(assertion, { ...policy, scope: "care.admin" })).toBe(false);
    expect(verifyServiceAssertion(assertion, { ...policy, audience: "notification" })).toBe(false);
    expect(
      verifyServiceAssertion(assertion, { ...policy, now: new Date("2026-08-02T00:02:31Z") }),
    ).toBe(false);
    expect(verifyServiceAssertion(`${assertion}x`, policy)).toBe(false);
  });

  it("fails closed on unprotected non-local dependency URLs", () => {
    expect(requiredDependencyUrl("http://127.0.0.1:3101", "CARE_URL", "test")).toBe(
      "http://127.0.0.1:3101",
    );
    expect(requiredDependencyUrl("https://care.internal", "CARE_URL", "production")).toBe(
      "https://care.internal",
    );
    expect(() => requiredDependencyUrl("http://care.internal", "CARE_URL", "production")).toThrow(
      "CARE_URL_TRANSPORT_UNPROTECTED",
    );
    expect(() =>
      requiredDependencyUrl("https://user:secret@care.internal", "CARE_URL", "production"),
    ).toThrow("CARE_URL_UNSAFE");
  });

  it("isolates concurrency and opens then recovers a bounded circuit", async () => {
    let clock = 1_000;
    const guard = new DependencyGuard({
      maxConcurrent: 1,
      failureThreshold: 2,
      openMs: 500,
      now: () => clock,
    });
    let release!: () => void;
    const held = guard.execute(() => new Promise<void>((resolve) => (release = resolve)));
    await expect(guard.execute(async () => undefined)).rejects.toMatchObject({
      reason: "bulkhead_full",
    });
    release();
    await held;
    await expect(guard.execute(async () => Promise.reject(new Error("down")))).rejects.toThrow(
      "down",
    );
    await expect(guard.execute(async () => Promise.reject(new Error("down")))).rejects.toThrow(
      "down",
    );
    await expect(guard.execute(async () => undefined)).rejects.toMatchObject({
      reason: "circuit_open",
    });
    clock += 501;
    await expect(guard.execute(async () => "recovered")).resolves.toBe("recovered");
  });
});
