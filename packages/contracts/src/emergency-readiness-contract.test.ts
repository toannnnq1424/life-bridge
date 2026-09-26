import { describe, expect, it } from "vitest";

import {
  CoordinationAuthorizationRequestSchema,
  EmergencyContactsChangedEventSchema,
  EmergencyOfflineSnapshotSchema,
  EmergencyPlanVersionReviewedEventSchema,
  ReplaceEmergencyContactsRequestSchema,
  ReviewEmergencyPlanVersionRequestSchema,
  SaveEmergencyPlanDraftRequestSchema,
  isCoordinationMutationPermission,
} from "./index.js";

describe("P4-S2 emergency readiness contracts", () => {
  it("accepts only ordered minimum contact facts with explicit optimistic versions", () => {
    const request = ReplaceEmergencyContactsRequestSchema.parse({
      operation: "replace_emergency_contacts",
      expectedListRevision: 4,
      contacts: [
        {
          contactId: "contact_alpha",
          expectedVersion: 2,
          displayLabel: "Synthetic contact A",
          dialString: "+66000000001",
        },
        {
          displayLabel: "Synthetic contact B",
          dialString: "020000002",
        },
      ],
    });
    expect(request.contacts.map((contact) => contact.displayLabel)).toEqual([
      "Synthetic contact A",
      "Synthetic contact B",
    ]);
    expect(() =>
      ReplaceEmergencyContactsRequestSchema.parse({
        ...request,
        contacts: [request.contacts[0], request.contacts[0]],
      }),
    ).toThrow();
    expect(() =>
      ReplaceEmergencyContactsRequestSchema.parse({
        ...request,
        contacts: [{ displayLabel: "A", dialString: "+66000000001", availability: "always" }],
      }),
    ).toThrow();
    expect(() =>
      ReplaceEmergencyContactsRequestSchema.parse({
        ...request,
        contacts: [{ contactId: "contact_alpha", displayLabel: "A", dialString: "123" }],
      }),
    ).toThrow();
  });

  it("bounds participant-entered plan steps and requires exact review facts", () => {
    const draft = SaveEmergencyPlanDraftRequestSchema.parse({
      operation: "save_emergency_plan_draft",
      expectedAggregateRevision: 2,
      expectedDraftRevision: 0,
      basePlanVersion: 1,
      contactListRevision: 3,
      steps: ["Synthetic step one", "Synthetic step two"],
    });
    expect(draft.steps).toHaveLength(2);
    expect(
      ReviewEmergencyPlanVersionRequestSchema.parse({
        operation: "review_emergency_plan_version",
        expectedAggregateRevision: 3,
        expectedDraftRevision: 1,
        basePlanVersion: 1,
        contactListRevision: 3,
        displayTimeZone: "Asia/Bangkok",
      }).displayTimeZone,
    ).toBe("Asia/Bangkok");
    expect(() =>
      SaveEmergencyPlanDraftRequestSchema.parse({
        ...draft,
        steps: ["diagnostic\ninstruction"],
      }),
    ).toThrow();
    expect(() =>
      ReviewEmergencyPlanVersionRequestSchema.parse({
        operation: "review_emergency_plan_version",
        expectedAggregateRevision: 3,
        expectedDraftRevision: 1,
        basePlanVersion: 1,
        contactListRevision: 3,
        displayTimeZone: "ICT",
      }),
    ).toThrow();
  });

  it("freezes the minimum offline projection with freshness and scope binding", () => {
    const snapshot = EmergencyOfflineSnapshotSchema.parse({
      contractVersion: "P4-S2-offline-v1",
      source: "care-coordination",
      scopeBinding: "a".repeat(64),
      planVersion: 2,
      contactListRevision: 3,
      reviewedAtUtc: "2026-07-28T03:00:00.000Z",
      lastConfirmedAtUtc: "2026-07-28T04:00:00.000Z",
      displayTimeZone: "Asia/Bangkok",
      displayLocalTime: "28 July 2026 at 10:00",
      displayUtcOffset: "+07:00",
      freshUntilUtc: "2026-07-29T04:00:00.000Z",
      expiresAtUtc: "2026-07-31T04:00:00.000Z",
      contacts: [
        {
          contactId: "contact_alpha",
          position: 1,
          displayLabel: "Synthetic contact A",
          dialString: "+66000000001",
        },
      ],
      steps: [{ position: 1, text: "Synthetic reviewed step" }],
    });
    expect(JSON.stringify(snapshot)).not.toMatch(
      /diagnosis|urgency|treatment|availability|legalAuthority|professionalStatus|dispatch/i,
    );
    expect(() =>
      EmergencyOfflineSnapshotSchema.parse({ ...snapshot, permission: "currently_allowed" }),
    ).toThrow();
  });

  it("binds every online operation to one exact P2 purpose", () => {
    const permissions = [
      "coordination.emergency_contacts.read",
      "coordination.emergency_contacts.replace",
      "coordination.emergency_contacts.history.read",
      "coordination.emergency_plan.read",
      "coordination.emergency_plan.draft.save",
      "coordination.emergency_plan.version.review",
      "coordination.emergency_plan.history.read",
      "coordination.emergency_plan.offline_snapshot.read",
    ] as const;
    for (const permission of permissions) {
      expect(
        CoordinationAuthorizationRequestSchema.parse({
          permission,
          householdId: "household_p4s2",
          requestDigest: "b".repeat(64),
        }).permission,
      ).toBe(permission);
    }
    expect(isCoordinationMutationPermission("coordination.emergency_contacts.replace")).toBe(true);
    expect(isCoordinationMutationPermission("coordination.emergency_plan.draft.save")).toBe(true);
    expect(isCoordinationMutationPermission("coordination.emergency_plan.version.review")).toBe(
      true,
    );
    expect(isCoordinationMutationPermission("coordination.emergency_plan.read")).toBe(false);
  });

  it("keeps emergency events content-free and explicitly non-delivering", () => {
    const base = {
      eventId: "event_p4s2",
      eventVersion: 1 as const,
      occurredAt: "2026-07-28T04:00:00.000Z",
      producer: "care-coordination" as const,
      aggregateId: "readiness_p4s2",
      aggregateVersion: 3,
      correlationId: "corr_p4s2",
      causationId: "cause_p4s2",
    };
    const contacts = EmergencyContactsChangedEventSchema.parse({
      ...base,
      eventType: "care.emergency_contacts.changed.v1",
      payload: {
        action: "contacts_replaced",
        outcome: "confirmed",
        contactListRevision: 2,
        planVersion: 0,
        deliveryDisposition: "none",
      },
    });
    const plan = EmergencyPlanVersionReviewedEventSchema.parse({
      ...base,
      eventType: "care.emergency_plan.version_reviewed.v1",
      payload: {
        action: "version_reviewed",
        outcome: "confirmed",
        contactListRevision: 2,
        planVersion: 1,
        deliveryDisposition: "none",
      },
    });
    expect(JSON.stringify([contacts, plan])).not.toMatch(
      /displayLabel|dialString|step|diagnosis|dispatch|idempotency/i,
    );
  });
});
