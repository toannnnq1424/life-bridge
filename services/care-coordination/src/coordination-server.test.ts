import { describe, expect, it, vi } from "vitest";

import type { CoordinationService } from "./coordination-service.js";
import { buildCareServer } from "./server.js";
import type { CareService } from "./service.js";

const internalToken = "care-internal-token-for-p3-tests";

describe("P3-S1 Care Coordination HTTP boundary", () => {
  it("conceals governed routes without the internal service token", async () => {
    const coordination = {
      dailyTimeline: vi.fn(),
    } as unknown as CoordinationService;
    const app = buildCareServer(careStub(), internalToken, coordination);

    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/coordination/households/household_synthetic/timeline/query",
      payload: {},
    });

    expect(response.statusCode).toBe(404);
    expect(coordination.dailyTimeline).not.toHaveBeenCalled();
    await app.close();
  });

  it("validates and binds the frozen timeline projection contract", async () => {
    const dailyTimeline = vi.fn(async () => ({
      localDate: "2026-11-01",
      displayTimeZone: "America/New_York",
      dayStartUtc: "2026-11-01T04:00:00.000Z",
      dayEndUtc: "2026-11-02T05:00:00.000Z",
      filter: "all" as const,
      snapshotAt: "2026-11-01T12:00:00.000Z",
      coverageStartedAt: "2026-07-26T12:00:00.000Z",
      coverage: "complete" as const,
      items: [],
      nextCursor: null,
    }));
    const coordination = { dailyTimeline } as unknown as CoordinationService;
    const app = buildCareServer(careStub(), internalToken, coordination);
    const authorization = decision("coordination.timeline.read", "a".repeat(64));

    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/coordination/households/household_synthetic/timeline/query",
      headers: {
        "x-internal-service-token": internalToken,
        "x-correlation-id": "corr_p3_care_timeline",
      },
      payload: {
        authorization,
        query: {
          localDate: "2026-11-01",
          displayTimeZone: "America/New_York",
          filter: "all",
          limit: 25,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).not.toHaveProperty("total");
    expect(dailyTimeline).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: "household_synthetic",
        authorization,
        correlationId: "corr_p3_care_timeline",
      }),
    );
    await app.close();
  });

  it("requires idempotency and forwards only the bounded handoff command", async () => {
    const handoff = vi.fn(async () => ({
      taskId: "task_synthetic",
      taskVersion: 2,
      currentActor: {
        actorRef: "actor_ref_target",
        displayKey: "coordination.actor.household_member" as const,
        subject: false,
      },
      fromActor: {
        actorRef: "actor_ref_current",
        displayKey: "coordination.actor.you" as const,
        subject: true,
      },
      reasonCode: "coverage_update" as const,
      occurredAt: "2026-07-26T12:00:00.000Z",
      effectiveAt: "2026-07-26T12:00:00.000Z",
      eventRef: "timeline_event_synthetic",
      outcome: "accepted" as const,
      notificationDelivery: "pending" as const,
    }));
    const coordination = { handoff } as unknown as CoordinationService;
    const app = buildCareServer(careStub(), internalToken, coordination);
    const payload = {
      authorization: decision("coordination.task.handoff", "b".repeat(64), "actor_ref_target"),
      request: {
        operation: "handoff",
        expectedTaskVersion: 1,
        expectedFromActorRef: "actor_ref_current",
        toActorRef: "actor_ref_target",
        reasonCode: "coverage_update",
        effectiveTime: { mode: "immediate", displayTimeZone: "Asia/Bangkok" },
      },
    };

    const missingKey = await app.inject({
      method: "POST",
      url: "/internal/v1/coordination/households/household_synthetic/tasks/task_synthetic/handoffs",
      headers: { "x-internal-service-token": internalToken },
      payload,
    });
    expect(missingKey.statusCode).toBe(400);
    expect(handoff).not.toHaveBeenCalled();

    const accepted = await app.inject({
      method: "POST",
      url: "/internal/v1/coordination/households/household_synthetic/tasks/task_synthetic/handoffs",
      headers: {
        "x-internal-service-token": internalToken,
        "idempotency-key": "p3-care-handoff-0001",
        "x-correlation-id": "corr_p3_care_handoff",
      },
      payload,
    });
    expect(accepted.statusCode).toBe(200);
    expect(handoff).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: "household_synthetic",
        taskId: "task_synthetic",
        idempotencyKey: "p3-care-handoff-0001",
        request: payload.request,
      }),
    );
    await app.close();
  });
});

function careStub(): CareService {
  return {
    isReady: vi.fn(async () => true),
  } as unknown as CareService;
}

function decision(
  permission: "coordination.timeline.read" | "coordination.task.handoff",
  requestDigest: string,
  targetActorRef?: string,
) {
  return {
    decisionId: "coordination_decision_synthetic",
    permission,
    actor: {
      actorId: "account_synthetic",
      actorRef: "actor_ref_current",
      displayKey: "coordination.actor.you",
      subject: true,
    },
    householdId: "household_synthetic",
    recipientContextId: "recipient_synthetic",
    subjectId: "subject_synthetic",
    subjectVersion: 2,
    grantId: null,
    grantVersion: null,
    privacyVersion: null,
    target: targetActorRef
      ? {
          actorId: "account_target",
          actorRef: targetActorRef,
          displayKey: "coordination.actor.household_member",
          subject: false,
        }
      : null,
    eligibleTargets: [],
    decidedAt: "2026-07-26T12:00:00.000Z",
    correlationId: "corr_p3_care_contract",
    requestDigest,
  };
}
