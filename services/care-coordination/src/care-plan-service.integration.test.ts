import { createHash } from "node:crypto";

import type {
  CoordinationAuthorizationDecision,
  CoordinationPermission,
} from "@lifebridge/contracts";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CarePlanService } from "./care-plan-service.js";
import { migrateCareDatabase } from "./migration.js";

const databaseUrl = process.env.CARE_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("P3-S3 Care-owned support-plan PostgreSQL boundary", () => {
  let pool: Pool;
  let service: CarePlanService;
  let sequence = 0;
  const now = new Date("2026-10-30T12:00:00.000Z");

  beforeAll(async () => {
    await migrateCareDatabase(databaseUrl!);
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE care_plan_transitions,care_plan_version_items,care_plan_versions,
      care_plan_draft_items,care_plan_drafts,care_plans,care_outbox,care_audit,care_idempotency
      RESTART IDENTITY CASCADE`);
    sequence = 0;
    service = new CarePlanService(pool, {
      cursorKey: createHash("sha256").update("p3-s3-synthetic-cursor").digest(),
      now: () => now,
      id: (prefix) => `${prefix}_p3s3_${++sequence}`,
    });
  });
  afterAll(async () => pool?.end());

  it("atomically saves, replays and confirms immutable minimum-data versions", async () => {
    const draftRequest = request();
    const saved = await service.saveDraft({
      householdId: "household_p3s3",
      request: draftRequest,
      idempotencyKey: "draft-key-synthetic",
      authorization: decision(
        "coordination.care_plan.draft.save",
        "care_plan.draft.save",
        draftRequest,
      ),
      correlationId: "correlation_p3s3",
    });
    const replayed = await service.saveDraft({
      householdId: "household_p3s3",
      request: draftRequest,
      idempotencyKey: "draft-key-synthetic",
      authorization: decision(
        "coordination.care_plan.draft.save",
        "care_plan.draft.save",
        draftRequest,
      ),
      correlationId: "correlation_p3s3",
    });
    expect(replayed).toEqual(saved);
    expect(saved).toMatchObject({ aggregateRevision: 1, draftRevision: 1, planVersion: null });

    const confirmRequest = {
      operation: "confirm_care_plan_version" as const,
      expectedAggregateRevision: 1,
      expectedDraftRevision: 1,
      baseCurrentVersion: null,
    };
    const confirmed = await service.confirm({
      householdId: "household_p3s3",
      request: confirmRequest,
      idempotencyKey: "confirm-key-synthetic",
      authorization: decision(
        "coordination.care_plan.version.confirm",
        "care_plan.version.confirm",
        confirmRequest,
      ),
      correlationId: "correlation_p3s3",
    });
    expect(confirmed).toMatchObject({ aggregateRevision: 2, planVersion: 1, outcome: "confirmed" });
    expect(confirmed.review).toMatchObject({
      reviewDayStartUtc: "2026-11-01T04:00:00.000Z",
      reviewDayEndUtc: "2026-11-02T05:00:00.000Z",
      reviewState: "upcoming",
    });
    const evidence = await pool.query<{ status: string; payload: unknown }>(
      `SELECT status,payload FROM care_outbox WHERE event_type='care.care_plan.version_confirmed.v1'`,
    );
    expect(evidence.rows).toHaveLength(1);
    expect(evidence.rows[0]?.status).toBe("suppressed");
    expect(JSON.stringify(evidence.rows[0]?.payload)).not.toContain("Weekly coordination");
    expect((await pool.query("SELECT * FROM care_plan_drafts")).rowCount).toBe(0);
  });

  it("rejects stale concurrent saves and redacts an ineligible former responsible party", async () => {
    const draftRequest = request();
    await service.saveDraft({
      householdId: "household_p3s3",
      request: draftRequest,
      idempotencyKey: "draft-a-synthetic",
      authorization: decision(
        "coordination.care_plan.draft.save",
        "care_plan.draft.save",
        draftRequest,
      ),
      correlationId: "correlation_p3s3",
    });
    await expect(
      service.saveDraft({
        householdId: "household_p3s3",
        request: draftRequest,
        idempotencyKey: "draft-b-synthetic",
        authorization: decision(
          "coordination.care_plan.draft.save",
          "care_plan.draft.save",
          draftRequest,
        ),
        correlationId: "correlation_p3s3",
      }),
    ).rejects.toMatchObject({ code: "CARE_PLAN_VERSION_CONFLICT" });

    const redacted = await service.read({
      householdId: "household_p3s3",
      authorization: decision("coordination.care_plan.read", "care_plan.read", undefined, false),
      correlationId: "correlation_p3s3",
    });
    expect(redacted.draft?.responsibilities[0]).toEqual({
      category: "coordination",
      statement: "Confirm shared schedule",
      actor: { state: "authorization_changed" },
    });
    expect(JSON.stringify(redacted.draft)).not.toContain("actor_ref_p3s3");

    const confirmRequest = {
      operation: "confirm_care_plan_version" as const,
      expectedAggregateRevision: 1,
      expectedDraftRevision: 1,
      baseCurrentVersion: null,
    };
    await expect(
      service.confirm({
        householdId: "household_p3s3",
        request: confirmRequest,
        idempotencyKey: "confirm-ineligible-synthetic",
        authorization: decision(
          "coordination.care_plan.version.confirm",
          "care_plan.version.confirm",
          confirmRequest,
          false,
        ),
        correlationId: "correlation_p3s3",
      }),
    ).rejects.toMatchObject({ code: "COORDINATION_RESOURCE_NOT_FOUND" });
  });

  function decision(
    permission: CoordinationPermission,
    operation: string,
    body?: unknown,
    actorEligible = true,
  ): CoordinationAuthorizationDecision {
    const requestDigest = CarePlanService.requestDigest({
      operation,
      householdId: "household_p3s3",
      ...(body ? { request: body } : {}),
    });
    return {
      decisionId: "decision_p3s3",
      permission,
      actor: {
        actorId: "actor_p3s3",
        actorRef: "actor_ref_p3s3",
        displayKey: "coordination.actor.you",
        subject: true,
      },
      householdId: "household_p3s3",
      recipientContextId: "recipient_context_p3s3",
      subjectId: "subject_p3s3",
      subjectVersion: 1,
      grantId: null,
      grantVersion: null,
      privacyVersion: 1,
      target: null,
      eligibleTargets: actorEligible
        ? [
            {
              actorId: "actor_p3s3",
              actorRef: "actor_ref_p3s3",
              displayKey: "coordination.actor.you",
              subject: true,
            },
          ]
        : [],
      decidedAt: now.toISOString(),
      correlationId: "correlation_p3s3",
      requestDigest,
    };
  }
});

function request() {
  return {
    operation: "save_care_plan_draft" as const,
    expectedAggregateRevision: 0,
    expectedDraftRevision: null,
    baseCurrentVersion: null,
    goals: [{ category: "communication" as const, statement: "Weekly coordination check-in" }],
    preferences: [
      { category: "communication" as const, statement: "Coordination language: Vietnamese" },
    ],
    responsibilities: [
      {
        category: "coordination" as const,
        statement: "Confirm shared schedule",
        actorRef: "actor_ref_p3s3",
      },
    ],
    reviewLocalDate: "2026-11-01",
    reviewTimeZone: "America/New_York",
  };
}
