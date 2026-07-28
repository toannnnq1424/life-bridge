import { describe, expect, it } from "vitest";

import {
  CarePlanProjectionSchema,
  CarePlanVersionConfirmedEventSchema,
  ConfirmCarePlanVersionRequestSchema,
  CoordinationAuthorizationRequestSchema,
  SaveCarePlanDraftRequestSchema,
} from "./index.js";

describe("P3-S3 care-plan contracts", () => {
  it("accepts only action-scoped care-plan permissions", () => {
    for (const permission of [
      "coordination.care_plan.read",
      "coordination.care_plan.history.read",
      "coordination.care_plan.draft.save",
      "coordination.care_plan.version.confirm",
    ]) {
      expect(
        CoordinationAuthorizationRequestSchema.parse({
          permission,
          householdId: "household_synthetic",
          requestDigest: "a".repeat(64),
        }).permission,
      ).toBe(permission);
    }
  });

  it("bounds a strict coordination-only draft replacement", () => {
    const request = {
      operation: "save_care_plan_draft",
      expectedAggregateRevision: 0,
      expectedDraftRevision: null,
      baseCurrentVersion: null,
      goals: [{ category: "communication", statement: "Weekly coordination check-in" }],
      preferences: [{ category: "communication", statement: "Coordination language: Vietnamese" }],
      responsibilities: [
        {
          category: "coordination",
          statement: "Confirm shared schedule",
          actorRef: "actor_ref_synthetic",
        },
      ],
      reviewLocalDate: "2026-11-01",
      reviewTimeZone: "America/New_York",
    };
    expect(SaveCarePlanDraftRequestSchema.parse(request)).toEqual(request);
    expect(() =>
      SaveCarePlanDraftRequestSchema.parse({ ...request, diagnosis: "synthetic" }),
    ).toThrow();
    expect(() =>
      SaveCarePlanDraftRequestSchema.parse({
        ...request,
        goals: [{ category: "communication", statement: "x".repeat(161) }],
      }),
    ).toThrow();
    expect(() =>
      SaveCarePlanDraftRequestSchema.parse({ ...request, reviewTimeZone: null }),
    ).toThrow();
  });

  it("keeps confirmation revision facts distinct and strict", () => {
    expect(
      ConfirmCarePlanVersionRequestSchema.parse({
        operation: "confirm_care_plan_version",
        expectedAggregateRevision: 2,
        expectedDraftRevision: 1,
        baseCurrentVersion: 4,
      }),
    ).toMatchObject({
      expectedAggregateRevision: 2,
      expectedDraftRevision: 1,
      baseCurrentVersion: 4,
    });
    expect(() =>
      ConfirmCarePlanVersionRequestSchema.parse({
        operation: "confirm_care_plan_version",
        expectedAggregateRevision: 2,
        expectedDraftRevision: 1,
        baseCurrentVersion: 4,
        approve: true,
      }),
    ).toThrow();
  });

  it("projects current and draft independently with no history total", () => {
    const parsed = CarePlanProjectionSchema.parse({
      state: "plan",
      planId: "plan_synthetic",
      aggregateRevision: 3,
      current: null,
      draft: {
        draftRevision: 2,
        baseCurrentVersion: null,
        goals: [],
        preferences: [],
        responsibilities: [
          {
            category: "coordination",
            statement: "Confirm shared schedule",
            actor: { state: "authorization_changed" },
          },
        ],
        reviewLocalDate: null,
        reviewTimeZone: null,
        reviewDayStartUtc: null,
        reviewDayEndUtc: null,
        publicationReadiness: "incomplete",
        updatedAt: "2026-07-27T12:00:00.000Z",
      },
      eligibleResponsibilityActors: [],
      reviewState: "not_applicable",
      requiresReview: false,
      coverageStartedAt: "2026-07-27T00:00:00.000Z",
      serverTime: "2026-07-27T12:00:00.000Z",
    });
    expect(parsed.current).toBeNull();
    expect(parsed.draft?.draftRevision).toBe(2);
    expect(parsed.draft?.responsibilities[0]).not.toHaveProperty("actorRef");
    expect("total" in parsed).toBe(false);
  });

  it("allows only a content-free no-delivery confirmation event", () => {
    const event = {
      eventId: "event_synthetic",
      eventType: "care.care_plan.version_confirmed.v1",
      eventVersion: 1,
      occurredAt: "2026-07-27T12:00:00.000Z",
      producer: "care-coordination",
      aggregateId: "plan_synthetic",
      aggregateVersion: 1,
      correlationId: "correlation_synthetic",
      causationId: "decision_synthetic",
      payload: { outcome: "confirmed", deliveryDisposition: "none" },
    };
    expect(CarePlanVersionConfirmedEventSchema.parse(event)).toEqual(event);
    expect(() =>
      CarePlanVersionConfirmedEventSchema.parse({
        ...event,
        payload: { ...event.payload, statement: "Synthetic sensitive plan text" },
      }),
    ).toThrow();
  });
});
