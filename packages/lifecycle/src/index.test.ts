import { describe, expect, it } from "vitest";
import {
  LifecycleCoordinator,
  LifecyclePolicyError,
  PolicyRegistry,
  lifecycleTelemetry,
  reconcileLifecycle,
  registryFromProductPolicy,
} from "./index.js";

const command = {
  requestId: "request_synthetic_1",
  owner: "care-coordination",
  dataClass: "document-bytes",
  operation: "delete" as const,
  expectedVersion: 1,
  idempotencyKey: "idem_synthetic_1",
  correlationId: "corr_synthetic_1",
};

describe("P7-S3 fail-closed lifecycle policy", () => {
  it("requires an explicit owner-approved disposition before physical action", () => {
    const coordinator = new LifecycleCoordinator(new PolicyRegistry());
    expect(() => coordinator.execute(command)).toThrowError(
      new LifecyclePolicyError("POLICY_DECISION_REQUIRED"),
    );
  });
  it.each(["delete", "pseudonymize", "retain", "tombstone"] as const)(
    "proves fixture action %s without making it production policy",
    (action) => {
      const registry = new PolicyRegistry();
      registry.approve(command.owner, command.dataClass, "delete", {
        action,
        policyVersion: 1,
        approvedBy: "synthetic-fixture-only",
      });
      expect(new LifecycleCoordinator(registry).execute(command).action).toBe(action);
    },
  );
  it.each(["export_include", "export_exclude"] as const)("proves fixture action %s", (action) => {
    const registry = new PolicyRegistry();
    registry.approve(command.owner, command.dataClass, "export", {
      action,
      policyVersion: 1,
      approvedBy: "synthetic-fixture-only",
    });
    const result = new LifecycleCoordinator(registry).execute({ ...command, operation: "export" });
    expect(result.action).toBe(action);
  });
  it("replays same intent and rejects changed intent", () => {
    const registry = new PolicyRegistry();
    registry.approve(command.owner, command.dataClass, "delete", {
      action: "tombstone",
      policyVersion: 1,
      approvedBy: "synthetic-fixture-only",
    });
    const coordinator = new LifecycleCoordinator(registry);
    expect(coordinator.execute(command)).toEqual(coordinator.execute(command));
    expect(() => coordinator.execute({ ...command, dataClass: "care-coordination" })).toThrowError(
      "IDEMPOTENCY_CONFLICT",
    );
  });
  it("emits allow-listed telemetry without identifiers, content or credentials", () => {
    const registry = new PolicyRegistry();
    registry.approve(command.owner, command.dataClass, "delete", {
      action: "retain",
      policyVersion: 1,
      approvedBy: "synthetic-fixture-only",
    });
    const line = lifecycleTelemetry(new LifecycleCoordinator(registry).execute(command), 12);
    expect(line).not.toContain(command.requestId);
    expect(line).not.toContain(command.dataClass);
    expect(line).not.toContain(command.correlationId);
    expect(line).not.toMatch(/DATABASE_URL|password|subject|household/u);
  });
  it("never reports partial owner completion as complete and selects monotonic evidence", () => {
    const digest = "d".repeat(64);
    expect(
      reconcileLifecycle(
        "request_synthetic_1",
        digest,
        ["identity-consent", "care-coordination"],
        [
          {
            requestId: "request_synthetic_1",
            owner: "identity-consent",
            version: 1,
            intentDigest: digest,
            state: "confirmed",
          },
        ],
      ).state,
    ).toBe("attention_required");
    const result = reconcileLifecycle(
      "request_synthetic_1",
      digest,
      ["identity-consent", "care-coordination"],
      [
        {
          requestId: "request_synthetic_1",
          owner: "identity-consent",
          version: 1,
          intentDigest: digest,
          state: "attention_required",
        },
        {
          requestId: "request_synthetic_1",
          owner: "identity-consent",
          version: 2,
          intentDigest: digest,
          state: "confirmed",
        },
        {
          requestId: "request_synthetic_1",
          owner: "care-coordination",
          version: 1,
          intentDigest: digest,
          state: "retained",
        },
      ],
    );
    expect(result).toEqual({
      state: "complete",
      owners: { "identity-consent": "confirmed", "care-coordination": "retained" },
    });
  });
  it("rejects poison/out-of-scope owner evidence", () => {
    expect(() =>
      reconcileLifecycle(
        "request_synthetic_1",
        "d".repeat(64),
        ["identity-consent"],
        [
          {
            requestId: "other",
            owner: "identity-consent",
            version: 1,
            intentDigest: "d".repeat(64),
            state: "confirmed",
          },
        ],
      ),
    ).toThrow("LIFECYCLE_VERSION_CONFLICT");
  });
  it("loads an explicitly approved engineering policy while preserving legal fail-closed truth", () => {
    const registry = registryFromProductPolicy({
      policyVersion: 1,
      approvedBy: "product-owner-delegated-engineering-decision-2026-08-02",
      classification: "product-engineering-default-not-legal-advice",
      legalHold: "unsupported-fail-closed-requires-counsel-decision",
      dispositions: [
        {
          owner: command.owner,
          dataClass: command.dataClass,
          delete: "tombstone",
          export: "export_include",
          evidenceRetentionDays: 30,
        },
      ],
    });
    expect(new LifecycleCoordinator(registry).execute(command).action).toBe("tombstone");
  });
});
