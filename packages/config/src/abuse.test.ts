import { describe, expect, it } from "vitest";
import { AbuseAdmissionController, sanitizeEvidenceField } from "./abuse.js";

describe("bounded abuse admission", () => {
  it("bounds bursts and resets deterministically without storing the raw dimension", () => {
    let now = 0;
    const guard = new AbuseAdmissionController(() => now);
    const budget = { limit: 2, windowMs: 1_000, maxConcurrent: 2 };
    const first = guard.admit("normal-read", "synthetic-actor", budget);
    expect(first.allowed).toBe(true);
    guard.release("normal-read", first.dimensionDigest);
    const second = guard.admit("normal-read", "synthetic-actor", budget);
    guard.release("normal-read", second.dimensionDigest);
    expect(guard.admit("normal-read", "synthetic-actor", budget)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 1,
    });
    now = 1_000;
    expect(guard.admit("normal-read", "synthetic-actor", budget).allowed).toBe(true);
    expect(first.dimensionDigest).not.toContain("synthetic-actor");
  });

  it("keeps recovery independent and sanitizes evidence injection", () => {
    const guard = new AbuseAdmissionController(() => 0);
    const one = { limit: 1, windowMs: 60_000, maxConcurrent: 1 };
    expect(guard.admit("normal-mutation", "source", one).allowed).toBe(true);
    expect(guard.admit("normal-mutation", "source", one).allowed).toBe(false);
    expect(guard.admit("account-recovery", "source", one).allowed).toBe(true);
    expect(sanitizeEvidenceField("ok\r\nforged")).toBe("ok__forged");
  });
});
