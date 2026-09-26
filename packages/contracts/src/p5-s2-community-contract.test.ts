import { describe, expect, it } from "vitest";

import {
  CommunityMatchAuthorizationContextSchema,
  CommunityMatchCommandSchema,
  CommunityMatchFailureCodeSchema,
  CommunityMatchResultSchema,
} from "./p5-s2-community-contract.js";

const authorization = {
  decisionId: "decision_synthetic_0001",
  purpose: "community_match_coordination" as const,
  permission: "community_match.coordinator.manage" as const,
  actorRef: "actor_synthetic_0001",
  recipientContextId: "recipient_synthetic_0001",
  subjectVersion: 2,
  grantId: "grant_synthetic_0001",
  grantVersion: 1,
  privacyVersion: 1,
  decidedAt: "2026-07-29T01:00:00.000Z",
  expiresAt: "2026-07-29T01:05:00.000Z",
  correlationId: "corr_p5s2_contract",
  requestDigest: "a".repeat(64),
};

describe("P5-S2 Community language-neutral contract", () => {
  it("requires a fresh exact match purpose and separate scope", () => {
    expect(CommunityMatchAuthorizationContextSchema.parse(authorization)).toEqual(authorization);
    expect(() =>
      CommunityMatchAuthorizationContextSchema.parse({
        ...authorization,
        purpose: "community_support",
      }),
    ).toThrow();
    expect(() =>
      CommunityMatchAuthorizationContextSchema.parse({
        ...authorization,
        permission: "community.help_request.submit",
      }),
    ).toThrow();
  });

  it("allows only organization-local service date and day-part capacity", () => {
    expect(
      CommunityMatchCommandSchema.parse({
        operation: "offer",
        authorization,
        organizationId: "organization_synthetic_0001",
        submissionReference: "submission_synthetic_0001",
        expectedVersion: 2,
        volunteerEnrollmentId: "enrollment_synthetic_0001",
        capacitySlot: { serviceDate: "2026-08-01", dayPart: "morning" },
        expiresAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toMatchObject({ operation: "offer" });
    expect(() =>
      CommunityMatchCommandSchema.parse({
        operation: "offer",
        authorization,
        organizationId: "organization_synthetic_0001",
        submissionReference: "submission_synthetic_0001",
        expectedVersion: 2,
        volunteerEnrollmentId: "enrollment_synthetic_0001",
        capacitySlot: {
          serviceDate: "2026-08-01",
          dayPart: "morning",
          availabilityNotes: "free form",
        },
        expiresAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("freezes coordinator-only close permission and minimum projection", () => {
    expect(
      CommunityMatchCommandSchema.parse({
        operation: "close",
        authorization,
        organizationId: "organization_synthetic_0001",
        submissionReference: "submission_synthetic_0002",
        expectedVersion: 6,
        reason: "support_completed",
      }),
    ).toMatchObject({ operation: "close" });
    expect(() =>
      CommunityMatchCommandSchema.parse({
        operation: "close",
        authorization: {
          ...authorization,
          permission: "community_match.progress.record",
        },
        organizationId: "organization_synthetic_0001",
        submissionReference: "submission_synthetic_0002",
        expectedVersion: 6,
        reason: "support_completed",
      }),
    ).toThrow(/match_permission_operation_mismatch/);

    expect(
      CommunityMatchResultSchema.parse({
        matches: [
          {
            matchId: "match_synthetic_0001",
            organizationId: "organization_synthetic_0001",
            category: "daily_living_support",
            provinceCityCode: "SYN-PC-001",
            dayPart: "morning",
            serviceDate: "2026-08-01",
            state: "assigned",
            version: 6,
            nextActions: ["record_progress", "close", "revoke"],
            evidenceExpiresAt: "2026-08-01T00:00:00.000Z",
            confirmedAt: "2026-07-29T01:02:00.000Z",
          },
        ],
        nextCursor: null,
        serverTime: "2026-07-29T01:02:00.000Z",
        minimumDisclosure: "P5-S2-v1",
      }),
    ).toBeTruthy();
  });

  it("enumerates uncertain, revoked, capacity and conflict truth separately", () => {
    expect(CommunityMatchFailureCodeSchema.options).toEqual(
      expect.arrayContaining([
        "COMMUNITY_MATCH_RESULT_UNKNOWN",
        "COMMUNITY_MATCH_CONSENT_REVOKED",
        "COMMUNITY_MATCH_APPROVAL_REVOKED",
        "COMMUNITY_MATCH_NO_CAPACITY",
        "COMMUNITY_MATCH_ASSIGNMENT_CONFLICT",
        "COMMUNITY_MATCH_PROGRESS_CONFLICT",
      ]),
    );
  });
});
