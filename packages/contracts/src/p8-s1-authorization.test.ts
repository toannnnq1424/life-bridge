import { describe, expect, it } from "vitest";

import { currentCoordinationAuthorization } from "./index.js";

const base = {
  decisionId: "decision_p8s1_0001",
  permission: "coordination.task.read" as const,
  actor: {
    actorId: "account_household_a",
    actorRef: "actor_ref_household_a",
    displayKey: "coordination.actor.you" as const,
    subject: true,
  },
  householdId: "household_a",
  membershipVersion: 3,
  taskId: "task_household_a",
  recipientContextId: "recipient_household_a",
  subjectId: "subject_household_a",
  subjectVersion: 4,
  grantId: null,
  grantVersion: null,
  privacyVersion: 2,
  target: null,
  eligibleTargets: [],
  decidedAt: "2026-08-02T00:00:00.000Z",
  correlationId: "correlation_p8s1_0001",
  requestDigest: "a".repeat(64),
};

const expected = {
  permission: "coordination.task.read" as const,
  householdId: "household_a",
  taskId: "task_household_a",
  correlationId: "correlation_p8s1_0001",
  requestDigest: "a".repeat(64),
  now: new Date("2026-08-02T00:00:05.000Z"),
};

describe("P8-S1 owner authorization boundary", () => {
  it("accepts only a current exactly-bound decision", () => {
    expect(currentCoordinationAuthorization(base, expected)?.decisionId).toBe(base.decisionId);
  });

  it.each([
    ["household", { householdId: "household_b" }],
    ["resource", { taskId: "task_household_b" }],
    ["operation", { permission: "coordination.task.complete" }],
    ["request", { requestDigest: "b".repeat(64) }],
    ["correlation", { correlationId: "correlation_p8s1_other" }],
    ["stale consent projection", { decidedAt: "2026-08-01T23:59:49.999Z" }],
    ["future projection", { decidedAt: "2026-08-02T00:00:06.001Z" }],
    ["missing consent version", { subjectVersion: undefined }],
    ["missing relationship version", { membershipVersion: undefined }],
  ])("denies a mismatched %s without disclosing which field failed", (_name, changed) => {
    expect(currentCoordinationAuthorization({ ...base, ...changed }, expected)).toBeNull();
  });
});
