import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
const canonical = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(",")}]`
    : v && typeof v === "object"
      ? `{${Object.entries(v)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, c]) => `${JSON.stringify(k)}:${canonical(c)}`)
          .join(",")}}`
      : JSON.stringify(v);
const digest = (path: string, body: unknown) =>
  createHash("sha256")
    .update(`POST\n${path}\n${canonical(body)}`)
    .digest("hex");
describe("P5-S3 Gateway to Community digest contract", () => {
  it("freezes queue and resolution vectors", () => {
    expect(
      digest("/internal/v1/community/moderation/cases/query", {
        moderatorEnrollmentId: "enrollment_synthetic_0001",
        operation: "queue",
        state: "open",
      }),
    ).toBe("43299d40200f594da90018e344fb7389b8ac8baacfb43f9fdadd78d325a5b1ff");
    expect(
      digest("/internal/v1/community/moderation/cases/case_synthetic_0001/resolution", {
        affectedAggregateRef: "b".repeat(64),
        caseId: "case_synthetic_0001",
        confirmed: true,
        expectedVersion: 2,
        moderationPolicyVersion: "P5-S3-policy-v1",
        moderatorEnrollmentId: "enrollment_synthetic_0001",
        operation: "resolve",
        outcome: "no_change",
        reason: "insufficient_authoritative_evidence",
        redactionPolicyVersion: "P5-S3-redaction-v1",
        retentionPolicyVersion: "P5-S3-retention-v1",
        submissionReference: "submission_synthetic_0001",
      }),
    ).toBe("60de37b16b05c643d8d33de012c99b628e9da88793a7159af145dcd22a600caf");
  });
});
