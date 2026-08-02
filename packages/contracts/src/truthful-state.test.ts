import { describe, expect, it } from "vitest";
import { isTruthfulTransition, TruthfulMutationStatusSchema } from "./truthful-state.js";

const base = {
  contractVersion: "P9-S2-truthful-state-v1",
  operationId: "task.create",
  dispatchEvidence: "not_dispatched",
  retry: "never",
} as const;

describe("truthful mutation state", () => {
  it("rejects false confirmation", () => {
    expect(TruthfulMutationStatusSchema.safeParse({ ...base, state: "confirmed" }).success).toBe(
      false,
    );
  });

  it("requires bounded undispatched queue entries", () => {
    expect(TruthfulMutationStatusSchema.safeParse({ ...base, state: "queued" }).success).toBe(
      false,
    );
    expect(
      TruthfulMutationStatusSchema.safeParse({
        ...base,
        state: "queued",
        expiresAt: "2026-08-03T00:00:00+07:00",
      }).success,
    ).toBe(true);
  });

  it("requires reconciliation for uncertain dispatch", () => {
    expect(
      TruthfulMutationStatusSchema.safeParse({
        ...base,
        state: "uncertain",
        dispatchEvidence: "may_have_dispatched",
        retry: "explicit_after_reconcile",
      }).success,
    ).toBe(false);
  });

  it("never permits queued or stale to become confirmed directly", () => {
    expect(isTruthfulTransition("queued", "confirmed")).toBe(false);
    expect(isTruthfulTransition("stale", "confirmed")).toBe(false);
    expect(isTruthfulTransition("reconciling", "confirmed")).toBe(true);
  });
});
