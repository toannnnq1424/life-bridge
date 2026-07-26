import { describe, expect, it } from "vitest";

import {
  CareTaskCompletedEventSchema,
  CompleteTaskRequestSchema,
  CreateTaskRequestSchema,
  IanaTimeZoneSchema,
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
