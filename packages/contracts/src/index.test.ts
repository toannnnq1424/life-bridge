import { describe, expect, it } from "vitest";

import {
  ApiErrorSchema,
  AuditHistoryProjectionSchema,
  AuditHistoryQuerySchema,
  ConsentTransitionEventSchema,
  CoordinationAuthorizationDecisionSchema,
  CreateHouseholdInvitationRequestSchema,
  DailyTimelineProjectionSchema,
  DailyTimelineQuerySchema,
  GrantConsentRequestSchema,
  HandoffResultProjectionSchema,
  HandoffTaskRequestSchema,
  HouseholdInvitationProjectionSchema,
  NarrowConsentRequestSchema,
  PrivacyPreferencesProjectionSchema,
  RevokeConsentRequestSchema,
  UpdatePrivacyPreferencesSchema,
  UpsertCareRecipientContextRequestSchema,
  CareTaskCompletedEventSchema,
  CareTaskHandedOffEventSchema,
  CompleteTaskRequestSchema,
  CreateTaskRequestSchema,
  IanaTimeZoneSchema,
  PasswordSchema,
  RegistrationRequestSchema,
  UpdateIdentityPreferencesSchema,
} from "./index.js";

describe("P1-S1-v1 contracts", () => {
  it("accepts the frozen create request with explicit instant and IANA zone", () => {
    expect(
      CreateTaskRequestSchema.parse({
        title: "Arrange transport",
        assigneeId: "member_minh",
        careRecipientId: "person_an",
        dueAt: "2026-08-03T02:00:00.000Z",
        dueTimeZone: "Asia/Bangkok",
        priority: "normal",
      }),
    ).toMatchObject({ description: "", dueTimeZone: "Asia/Bangkok" });
  });

  it("rejects invalid due zones, oversized text, and unexpected fields", () => {
    expect(IanaTimeZoneSchema.safeParse("Mars/Olympus").success).toBe(false);
    expect(
      CreateTaskRequestSchema.safeParse({
        title: "x".repeat(121),
        assigneeId: "member_minh",
        careRecipientId: "person_an",
        dueAt: "2026-08-03T02:00:00.000Z",
        dueTimeZone: "Asia/Bangkok",
        priority: "normal",
        untrusted: true,
      }).success,
    ).toBe(false);
  });

  it("accepts only the complete transition", () => {
    expect(CompleteTaskRequestSchema.parse({ operation: "complete", expectedVersion: 1 })).toEqual({
      operation: "complete",
      expectedVersion: 1,
    });
    expect(
      CompleteTaskRequestSchema.safeParse({ operation: "cancel", expectedVersion: 1 }).success,
    ).toBe(false);
  });

  it("requires a cross-user recipient for deliver disposition", () => {
    const base = {
      eventId: "evt_complete_1",
      eventType: "care.task.completed.v1",
      eventVersion: 1,
      occurredAt: "2026-08-03T02:05:00.000Z",
      producer: "care-coordination",
      aggregateId: "task_demo_1",
      aggregateVersion: 2,
      correlationId: "corr_demo_123",
      causationId: "cmd_demo_123",
    } as const;

    expect(
      CareTaskCompletedEventSchema.safeParse({
        ...base,
        payload: {
          householdId: "hh_minh_an",
          notificationDisposition: "deliver",
          recipientId: "member_lan",
          completedBy: "member_minh",
          completedAt: "2026-08-03T02:05:00.000Z",
        },
      }).success,
    ).toBe(true);

    expect(
      CareTaskCompletedEventSchema.safeParse({
        ...base,
        payload: {
          householdId: "hh_minh_an",
          notificationDisposition: "deliver",
          recipientId: "member_minh",
          completedBy: "member_minh",
          completedAt: "2026-08-03T02:05:00.000Z",
        },
      }).success,
    ).toBe(false);
  });
});

describe("P2-S1-v1 identity contracts", () => {
  it("normalizes login names and Unicode passwords without composition rules", () => {
    expect(
      RegistrationRequestSchema.parse({
        loginName: "  Care.User  ",
        password: "một cụm từ an toàn",
      }),
    ).toEqual({ loginName: "care.user", password: "một cụm từ an toàn" });
    expect(PasswordSchema.safeParse("password123").success).toBe(false);
    expect(PasswordSchema.safeParse("short").success).toBe(false);
  });

  it("accepts only minimum-data accessibility preferences with a version", () => {
    expect(
      UpdateIdentityPreferencesSchema.parse({
        locale: "vi-VN",
        textScale: "large",
        contrast: "more",
        motion: "reduce",
        expectedVersion: 1,
      }),
    ).toMatchObject({ locale: "vi-VN", motion: "reduce" });
    expect(
      UpdateIdentityPreferencesSchema.safeParse({
        locale: "vi-VN",
        textScale: "large",
        contrast: "more",
        motion: "reduce",
        expectedVersion: 1,
        disability: "screen-reader-user",
      }).success,
    ).toBe(false);
  });
});

describe("P2-S2-v1 household authorization contracts", () => {
  it("bounds invitation roles and excludes extra contact or permission input", () => {
    expect(
      CreateHouseholdInvitationRequestSchema.parse({
        inviteeLoginName: "care.user",
        role: "caregiver",
      }),
    ).toEqual({ inviteeLoginName: "care.user", role: "caregiver" });
    expect(
      CreateHouseholdInvitationRequestSchema.safeParse({
        inviteeLoginName: "care.user",
        role: "organizer",
      }).success,
    ).toBe(false);
    expect(
      CreateHouseholdInvitationRequestSchema.safeParse({
        inviteeLoginName: "care.user",
        role: "member",
        medicalNotes: "not permitted",
      }).success,
    ).toBe(false);
  });

  it("freezes all invitation lifecycle states and minimum recipient context", () => {
    for (const state of ["pending", "accepted", "declined", "expired", "revoked"]) {
      expect(
        HouseholdInvitationProjectionSchema.safeParse({
          invitationId: "invitation_synthetic",
          householdId: "household_synthetic",
          role: "member",
          state,
          expiresAt: "2026-07-28T00:00:00.000Z",
          version: 1,
        }).success,
      ).toBe(true);
    }
    expect(
      UpsertCareRecipientContextRequestSchema.safeParse({
        displayLabel: "NgÆ°á»i nháº­n chÄƒm sÃ³c",
        relationshipLabel: "NgÆ°á»i thÃ¢n",
        expectedVersion: 0,
        diagnosis: "not permitted",
      }).success,
    ).toBe(false);
  });
});

describe("P2-S3-v1 consent, privacy, and audit contracts", () => {
  const effectiveTime = {
    mode: "immediate",
    displayTimeZone: "Asia/Bangkok",
  } as const;

  it("freezes distinct versioned grant, narrow, and revoke commands", () => {
    expect(
      GrantConsentRequestSchema.parse({
        action: "grant",
        recipientRef: "member_reference",
        purpose: "household_coordination",
        scopes: ["recipient_context.basic_label", "recipient_context.relationship_label"],
        effectiveTime,
        expectedSubjectVersion: 1,
      }),
    ).toMatchObject({ action: "grant", expectedSubjectVersion: 1 });

    expect(
      NarrowConsentRequestSchema.parse({
        action: "narrow",
        scopes: ["recipient_context.basic_label"],
        effectiveTime,
        expectedSubjectVersion: 2,
        expectedGrantVersion: 1,
      }),
    ).toMatchObject({ action: "narrow", expectedGrantVersion: 1 });

    expect(
      RevokeConsentRequestSchema.parse({
        action: "revoke",
        effectiveTime,
        expectedSubjectVersion: 3,
        expectedGrantVersion: 2,
      }),
    ).toMatchObject({ action: "revoke", expectedGrantVersion: 2 });

    expect(
      GrantConsentRequestSchema.safeParse({
        action: "grant",
        recipientRef: "member_reference",
        purpose: "household_coordination",
        scopes: [],
        effectiveTime,
        expectedSubjectVersion: 1,
      }).success,
    ).toBe(false);
    expect(
      NarrowConsentRequestSchema.safeParse({
        action: "narrow",
        scopes: ["recipient_context.basic_label", "recipient_context.basic_label"],
        effectiveTime,
        expectedSubjectVersion: 2,
        expectedGrantVersion: 1,
      }).success,
    ).toBe(false);
    expect(
      RevokeConsentRequestSchema.safeParse({
        action: "revoke",
        effectiveTime: { mode: "immediate", displayTimeZone: "ICT" },
        expectedSubjectVersion: 3,
        expectedGrantVersion: 2,
      }).success,
    ).toBe(false);
  });

  it("keeps transition events versioned and rejects sensitive payload copies", () => {
    const event = {
      eventId: "event_consent_1",
      eventType: "identity.consent.revoked.v1",
      eventVersion: 1,
      producer: "identity-consent",
      aggregateId: "subject_consent_1",
      aggregateVersion: 4,
      grantId: "grant_consent_1",
      grantVersion: 3,
      action: "revoke",
      purpose: "household_coordination",
      scopes: ["recipient_context.basic_label"],
      effectiveAt: "2026-07-26T12:00:00.000Z",
      occurredAt: "2026-07-26T12:00:00.000Z",
      correlationId: "corr_consent_123",
      causationId: "command_consent_1",
    };
    expect(ConsentTransitionEventSchema.safeParse(event).success).toBe(true);
    expect(
      ConsentTransitionEventSchema.safeParse({
        ...event,
        recipientLabel: "not permitted",
      }).success,
    ).toBe(false);
  });

  it("freezes bounded audit history without total or hidden counts", () => {
    expect(
      AuditHistoryQuerySchema.parse({
        limit: "25",
        displayTimeZone: "Asia/Bangkok",
      }),
    ).toMatchObject({ limit: 25 });
    expect(
      AuditHistoryQuerySchema.safeParse({
        limit: 26,
        displayTimeZone: "Asia/Bangkok",
      }).success,
    ).toBe(false);
    expect(
      AuditHistoryProjectionSchema.safeParse({
        items: [
          {
            eventRef: "audit_event_1",
            category: "consent.revoked",
            actorAlias: "your_account",
            redaction: "protected",
            occurredAt: "2026-07-26T12:00:00.000Z",
            displayTimeZone: "Asia/Bangkok",
            outcome: "confirmed",
          },
        ],
        nextCursor: null,
      }).success,
    ).toBe(true);
    expect(
      AuditHistoryProjectionSchema.safeParse({
        items: [],
        nextCursor: null,
        total: 0,
      }).success,
    ).toBe(false);
  });

  it("freezes atomic privacy preferences and complete P2-S3 errors", () => {
    expect(
      UpdatePrivacyPreferencesSchema.parse({
        profileVisibility: "private",
        coordinationActivityVisibility: "hidden",
        accessAlerts: true,
        expectedVersion: 1,
        displayTimeZone: "Asia/Bangkok",
      }),
    ).toMatchObject({ expectedVersion: 1 });
    expect(
      PrivacyPreferencesProjectionSchema.safeParse({
        profileVisibility: "private",
        coordinationActivityVisibility: "hidden",
        accessAlerts: true,
        version: 2,
        confirmedAt: "2026-07-26T12:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      ApiErrorSchema.safeParse({
        error: {
          code: "CONSENT_VERSION_CONFLICT",
          messageKey: "consent.conflict",
          retryable: false,
          correlationId: "corr_consent_123",
          recoveryAction: "reload_current",
        },
      }).success,
    ).toBe(true);
  });
});

describe("P3-S1-v1 daily timeline and handoff contracts", () => {
  const actor = {
    actorRef: "actor_current",
    displayKey: "coordination.actor.you",
    subject: false,
  } as const;

  it("freezes a request-bound permission decision without protected display content", () => {
    const decision = {
      decisionId: "decision_timeline_1",
      permission: "coordination.timeline.read",
      actor: { ...actor, actorId: "account_current" },
      householdId: "household_demo",
      recipientContextId: "recipient_context_demo",
      subjectId: "subject_demo",
      subjectVersion: 4,
      grantId: "grant_demo",
      grantVersion: 2,
      privacyVersion: 3,
      target: null,
      eligibleTargets: [],
      decidedAt: "2026-07-26T12:00:00.000Z",
      correlationId: "corr_timeline_123",
      requestDigest: "a".repeat(64),
    };
    expect(CoordinationAuthorizationDecisionSchema.safeParse(decision).success).toBe(true);
    expect(
      CoordinationAuthorizationDecisionSchema.safeParse({
        ...decision,
        recipientLabel: "not permitted",
      }).success,
    ).toBe(false);
  });

  it("validates local dates, IANA zones, bounded pages, and projections without totals", () => {
    expect(
      DailyTimelineQuerySchema.parse({
        localDate: "2026-11-01",
        displayTimeZone: "America/New_York",
        limit: "50",
      }),
    ).toMatchObject({ filter: "all", limit: 50 });
    expect(
      DailyTimelineQuerySchema.safeParse({
        localDate: "2026-02-30",
        displayTimeZone: "Asia/Bangkok",
      }).success,
    ).toBe(false);
    expect(
      DailyTimelineQuerySchema.safeParse({
        localDate: "2026-07-26",
        displayTimeZone: "ICT",
      }).success,
    ).toBe(false);

    const projection = {
      localDate: "2026-07-26",
      displayTimeZone: "Asia/Bangkok",
      dayStartUtc: "2026-07-25T17:00:00.000Z",
      dayEndUtc: "2026-07-26T17:00:00.000Z",
      filter: "all",
      snapshotAt: "2026-07-26T12:00:00.000Z",
      coverageStartedAt: "2026-07-26T00:00:00.000Z",
      coverage: "complete",
      items: [
        {
          eventRef: "event_timeline_1",
          kind: "task_created",
          taskId: "task_demo_1",
          taskTitle: "Arrange transport",
          actor,
          fromActor: null,
          toActor: null,
          reasonCode: null,
          occurredAt: "2026-07-26T01:00:00.000Z",
          outcome: "confirmed",
        },
      ],
      nextCursor: null,
    };
    expect(DailyTimelineProjectionSchema.safeParse(projection).success).toBe(true);
    expect(DailyTimelineProjectionSchema.safeParse({ ...projection, total: 1 }).success).toBe(
      false,
    );
  });

  it("rejects free-form or self handoffs and freezes durable result semantics", () => {
    const request = {
      operation: "handoff",
      expectedTaskVersion: 3,
      expectedFromActorRef: "actor_current",
      toActorRef: "actor_proposed",
      reasonCode: "availability_changed",
      effectiveTime: { mode: "immediate", displayTimeZone: "Asia/Bangkok" },
    } as const;
    expect(HandoffTaskRequestSchema.safeParse(request).success).toBe(true);
    expect(HandoffTaskRequestSchema.safeParse({ ...request, note: "not permitted" }).success).toBe(
      false,
    );
    expect(
      HandoffTaskRequestSchema.safeParse({
        ...request,
        toActorRef: request.expectedFromActorRef,
      }).success,
    ).toBe(false);

    expect(
      HandoffResultProjectionSchema.safeParse({
        taskId: "task_demo_1",
        taskVersion: 4,
        currentActor: {
          actorRef: "actor_proposed",
          displayKey: "coordination.actor.household_member",
          subject: true,
        },
        fromActor: actor,
        reasonCode: "availability_changed",
        occurredAt: "2026-07-26T12:00:00.000Z",
        effectiveAt: "2026-07-26T12:00:00.000Z",
        eventRef: "event_handoff_1",
        outcome: "accepted",
        notificationDelivery: "pending",
      }).success,
    ).toBe(true);
  });

  it("keeps the handoff event versioned and free of task text", () => {
    const event = {
      eventId: "event_handoff_1",
      eventType: "care.task.handed_off.v1",
      eventVersion: 1,
      occurredAt: "2026-07-26T12:00:00.000Z",
      producer: "care-coordination",
      aggregateId: "task_demo_1",
      aggregateVersion: 4,
      correlationId: "corr_handoff_123",
      causationId: "command_handoff_1",
      payload: {
        householdId: "household_demo",
        recipientContextId: "recipient_context_demo",
        fromActorId: "account_current",
        toActorId: "account_target",
        reasonCode: "availability_changed",
        outcome: "accepted",
        effectiveAt: "2026-07-26T12:00:00.000Z",
        notificationDisposition: "deliver",
        recipientId: "account_target",
      },
    } as const;
    expect(CareTaskHandedOffEventSchema.safeParse(event).success).toBe(true);
    expect(
      CareTaskHandedOffEventSchema.safeParse({
        ...event,
        payload: { ...event.payload, taskTitle: "not permitted" },
      }).success,
    ).toBe(false);
  });
});
