import { describe, expect, it } from "vitest";
import {
  CommunityModerationAuthorizationContextSchema,
  CommunityModerationCommandSchema,
  CommunityModerationResultSchema,
} from "./p5-s3-community-contract.js";

const authorization = {
  decisionId: "decision_synthetic_0001",
  purpose: "community_moderation_resolution" as const,
  permission: "community_moderation.case.resolve" as const,
  actorRef: "actor_synthetic_0001",
  recipientContextId: "recipient_synthetic_0001",
  subjectVersion: 1,
  grantId: "grant_synthetic_0001",
  grantVersion: 1,
  privacyVersion: 1,
  decidedAt: "2026-07-29T00:00:00.000Z",
  expiresAt: "2026-07-29T00:00:10.000Z",
  correlationId: "correlation_synthetic_0001",
  requestDigest: "a".repeat(64),
};

describe("P5-S3 moderation contract", () => {
  it("accepts a fresh exact resolution and rejects invalid outcome/reason pairs", () => {
    expect(CommunityModerationAuthorizationContextSchema.parse(authorization).expiresAt).toContain(
      "00:00:10",
    );
    const command = {
      operation: "resolve" as const,
      authorization,
      moderatorEnrollmentId: "enrollment_synthetic_0001",
      caseId: "case_synthetic_0001",
      submissionReference: "submission_synthetic_0001",
      expectedVersion: 2,
      outcome: "no_change" as const,
      reason: "insufficient_authoritative_evidence" as const,
      moderationPolicyVersion: "P5-S3-policy-v1",
      redactionPolicyVersion: "P5-S3-redaction-v1",
      retentionPolicyVersion: "P5-S3-retention-v1",
      affectedAggregateRef: "b".repeat(64),
      confirmed: true as const,
    };
    expect(CommunityModerationCommandSchema.parse(command).operation).toBe("resolve");
    expect(() =>
      CommunityModerationCommandSchema.parse({ ...command, reason: "policy_privacy_boundary" }),
    ).toThrow();
  });
  it("closes projections and caps the queue", () => {
    expect(() =>
      CommunityModerationResultSchema.parse({
        cases: [],
        serverTime: "2026-07-29T00:00:00.000Z",
        minimumDisclosure: "P5-S3-v1",
        leakedReporter: "forbidden",
      }),
    ).toThrow();
    expect(() =>
      CommunityModerationResultSchema.parse({
        cases: Array(26).fill({}),
        serverTime: "2026-07-29T00:00:00.000Z",
        minimumDisclosure: "P5-S3-v1",
      }),
    ).toThrow();
  });
});
