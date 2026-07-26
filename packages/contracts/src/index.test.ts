import { describe, expect, it } from "vitest";

import {
  CreateHouseholdInvitationRequestSchema,
  HouseholdInvitationProjectionSchema,
  UpsertCareRecipientContextRequestSchema,
  CareTaskCompletedEventSchema,
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
