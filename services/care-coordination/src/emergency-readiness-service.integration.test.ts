import type {
  CoordinationAuthorizationDecision,
  CoordinationPermission,
  ReplaceEmergencyContactsRequest,
  ReviewEmergencyPlanVersionRequest,
  SaveEmergencyPlanDraftRequest,
} from "@lifebridge/contracts";
import {
  EmergencyHistoryQuerySchema,
  ReplaceEmergencyContactsRequestSchema,
  ReviewEmergencyPlanVersionRequestSchema,
  SaveEmergencyPlanDraftRequestSchema,
} from "@lifebridge/contracts";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { EmergencyReadinessService } from "./emergency-readiness-service.js";
import { migrateCareDatabase } from "./migration.js";

const databaseUrl = process.env.CARE_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("P4-S2 Care-owned emergency readiness boundary", () => {
  let pool: Pool;
  let service: EmergencyReadinessService;
  const clock = new Date("2026-07-28T04:00:00.000Z");
  let sequence = 0;

  beforeAll(async () => {
    await migrateCareDatabase(databaseUrl!);
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE care_emergency_plan_transitions,
               care_emergency_plan_version_steps,
               care_emergency_plan_versions,
               care_emergency_plan_draft_steps,
               care_emergency_plan_drafts,
               care_emergency_contact_transitions,
               care_emergency_contacts,
               care_emergency_readiness,
               care_outbox, care_audit, care_idempotency
      RESTART IDENTITY CASCADE
    `);
    sequence = 0;
    service = makeService();
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("confirms ordered contacts and a reviewed version, then projects a bounded snapshot", async () => {
    const contacts = await replaceContacts({
      operation: "replace_emergency_contacts",
      expectedListRevision: 0,
      contacts: [
        { displayLabel: "Synthetic contact A", dialString: "+66000000001" },
        { displayLabel: "Synthetic contact B", dialString: "020000002" },
      ],
    });
    expect(contacts).toMatchObject({
      listRevision: 1,
      planState: "no_plan",
      contacts: [
        { position: 1, version: 1 },
        { position: 2, version: 1 },
      ],
    });

    const draft = await saveDraft({
      operation: "save_emergency_plan_draft",
      expectedAggregateRevision: 1,
      expectedDraftRevision: 0,
      basePlanVersion: 0,
      contactListRevision: 1,
      steps: ["Synthetic step one", "Synthetic step two"],
    });
    expect(draft).toMatchObject({
      state: "draft_only",
      aggregateRevision: 2,
      draftRevision: 1,
    });

    const reviewed = await reviewVersion({
      operation: "review_emergency_plan_version",
      expectedAggregateRevision: 2,
      expectedDraftRevision: 1,
      basePlanVersion: 0,
      contactListRevision: 1,
      displayTimeZone: "Asia/Bangkok",
    });
    expect(reviewed).toMatchObject({
      state: "reviewed",
      aggregateRevision: 3,
      planVersion: 1,
      contactListRevision: 1,
    });

    const snapshot = await service.offlineSnapshot({
      householdId: "household_p4s2",
      authorization: authorize(
        "coordination.emergency_plan.offline_snapshot.read",
        digest({ operation: "emergency_plan.offline_snapshot", householdId: "household_p4s2" }),
      ),
      correlationId: "corr_p4s2",
    });
    expect(snapshot).toMatchObject({
      contractVersion: "P4-S2-offline-v1",
      source: "care-coordination",
      planVersion: 1,
      contactListRevision: 1,
      contacts: [
        { position: 1, displayLabel: "Synthetic contact A", dialString: "+66000000001" },
        { position: 2, displayLabel: "Synthetic contact B", dialString: "020000002" },
      ],
      steps: [
        { position: 1, text: "Synthetic step one" },
        { position: 2, text: "Synthetic step two" },
      ],
    });
    expect(snapshot.scopeBinding).toMatch(/^[a-f0-9]{64}$/);
    expect(Date.parse(snapshot.freshUntilUtc) - Date.parse(snapshot.lastConfirmedAtUtc)).toBe(
      24 * 60 * 60 * 1_000,
    );
    expect(Date.parse(snapshot.expiresAtUtc) - Date.parse(snapshot.lastConfirmedAtUtc)).toBe(
      72 * 60 * 60 * 1_000,
    );

    const evidence = await pool.query<{ payload: unknown; metadata: unknown }>(`
      SELECT payload, NULL::jsonb AS metadata FROM care_outbox
      UNION ALL
      SELECT NULL::jsonb AS payload, metadata FROM care_audit
    `);
    expect(JSON.stringify(evidence.rows)).not.toMatch(
      /Synthetic contact|Synthetic step|\+660|020000|diagnosis|dispatch/i,
    );
    await expectCount("care_emergency_contact_transitions", 1);
    await expectCount("care_emergency_plan_transitions", 2);
    await expectCount("care_outbox", 2);
    await expectCount("care_audit", 3);
    await expectCount("care_idempotency", 3);
  });

  it("invalidates a reviewed plan when contacts change and requires explicit re-review", async () => {
    const initial = await replaceContacts({
      operation: "replace_emergency_contacts",
      expectedListRevision: 0,
      contacts: [{ displayLabel: "Synthetic contact A", dialString: "+66000000001" }],
    });
    await saveDraft({
      operation: "save_emergency_plan_draft",
      expectedAggregateRevision: 1,
      expectedDraftRevision: 0,
      basePlanVersion: 0,
      contactListRevision: 1,
      steps: ["Synthetic reviewed step"],
    });
    await reviewVersion({
      operation: "review_emergency_plan_version",
      expectedAggregateRevision: 2,
      expectedDraftRevision: 1,
      basePlanVersion: 0,
      contactListRevision: 1,
      displayTimeZone: "Asia/Bangkok",
    });

    const changed = await replaceContacts(
      {
        operation: "replace_emergency_contacts",
        expectedListRevision: 1,
        contacts: [
          {
            contactId: initial.contacts[0]!.contactId,
            expectedVersion: 1,
            displayLabel: "Synthetic contact A updated",
            dialString: "+66000000003",
          },
        ],
      },
      "contacts-change",
    );
    expect(changed.planState).toBe("review_required");
    await expect(
      service.offlineSnapshot({
        householdId: "household_p4s2",
        authorization: authorize(
          "coordination.emergency_plan.offline_snapshot.read",
          digest({
            operation: "emergency_plan.offline_snapshot",
            householdId: "household_p4s2",
          }),
        ),
        correlationId: "corr_p4s2",
      }),
    ).rejects.toMatchObject({ code: "EMERGENCY_PLAN_REVIEW_REQUIRED" });

    const nextDraft = await saveDraft(
      {
        operation: "save_emergency_plan_draft",
        expectedAggregateRevision: 4,
        expectedDraftRevision: 0,
        basePlanVersion: 1,
        contactListRevision: 2,
        steps: ["Synthetic revised step"],
      },
      "draft-two",
    );
    const nextReviewRequest: ReviewEmergencyPlanVersionRequest = {
      operation: "review_emergency_plan_version",
      expectedAggregateRevision: nextDraft.aggregateRevision,
      expectedDraftRevision: nextDraft.draftRevision!,
      basePlanVersion: 1,
      contactListRevision: 2,
      displayTimeZone: "Asia/Bangkok",
    };
    const next = await reviewVersion(nextReviewRequest, "review-two");
    expect(await reviewVersion(nextReviewRequest, "review-two")).toEqual(next);
    expect(next).toMatchObject({ planVersion: 2, state: "reviewed" });
  });

  it("serializes concurrent replacements and reports the stale writer as a conflict", async () => {
    const initial = await replaceContacts({
      operation: "replace_emergency_contacts",
      expectedListRevision: 0,
      contacts: [{ displayLabel: "Synthetic contact A", dialString: "+66000000001" }],
    });
    const request: ReplaceEmergencyContactsRequest = {
      operation: "replace_emergency_contacts",
      expectedListRevision: 1,
      contacts: [
        {
          contactId: initial.contacts[0]!.contactId,
          expectedVersion: 1,
          displayLabel: "Synthetic contact A changed",
          dialString: "+66000000002",
        },
      ],
    };
    const settled = await Promise.allSettled([
      replaceContacts(request, "concurrent-a"),
      replaceContacts(request, "concurrent-b"),
    ]);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(settled.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "EMERGENCY_CONTACT_LIST_VERSION_CONFLICT" },
    });
    await expectCount("care_emergency_contact_transitions", 2);
  });

  it("rejects stale exact-purpose authority before state access", async () => {
    const request: ReplaceEmergencyContactsRequest = {
      operation: "replace_emergency_contacts",
      expectedListRevision: 0,
      contacts: [{ displayLabel: "Synthetic contact A", dialString: "+66000000001" }],
    };
    const authorization = authorize(
      "coordination.emergency_contacts.replace",
      digest({
        operation: "emergency_contacts.replace",
        householdId: "household_p4s2",
        request: ReplaceEmergencyContactsRequestSchema.parse(request),
      }),
    );
    authorization.decidedAt = new Date(clock.getTime() - 10_001).toISOString();
    await expect(
      service.replaceContacts({
        householdId: "household_p4s2",
        request,
        idempotencyKey: "stale-authority",
        authorization,
        correlationId: "corr_p4s2",
      }),
    ).rejects.toMatchObject({ code: "COORDINATION_RESOURCE_NOT_FOUND", statusCode: 404 });
    await expectCount("care_emergency_readiness", 0);
  });

  it("rolls contact content, transition, outbox, audit, and replay back together", async () => {
    const rollback = makeService(async () => {
      throw new Error("synthetic_before_commit_failure");
    });
    const request: ReplaceEmergencyContactsRequest = {
      operation: "replace_emergency_contacts",
      expectedListRevision: 0,
      contacts: [{ displayLabel: "Synthetic rollback contact", dialString: "+66000000009" }],
    };
    await expect(
      rollback.replaceContacts({
        householdId: "household_p4s2",
        request,
        idempotencyKey: "rollback",
        authorization: authorize(
          "coordination.emergency_contacts.replace",
          digest({
            operation: "emergency_contacts.replace",
            householdId: "household_p4s2",
            request: ReplaceEmergencyContactsRequestSchema.parse(request),
          }),
        ),
        correlationId: "corr_p4s2",
      }),
    ).rejects.toThrow("synthetic_before_commit_failure");
    for (const table of [
      "care_emergency_readiness",
      "care_emergency_contacts",
      "care_emergency_contact_transitions",
      "care_outbox",
      "care_audit",
      "care_idempotency",
    ]) {
      await expectCount(table, 0);
    }
  });

  it("seals history cursors to authority facts and exposes no contact or step content", async () => {
    const initial = await replaceContacts({
      operation: "replace_emergency_contacts",
      expectedListRevision: 0,
      contacts: [{ displayLabel: "Synthetic contact A", dialString: "+66000000001" }],
    });
    await replaceContacts(
      {
        operation: "replace_emergency_contacts",
        expectedListRevision: 1,
        contacts: [
          {
            contactId: initial.contacts[0]!.contactId,
            expectedVersion: 1,
            displayLabel: "Synthetic contact B",
            dialString: "+66000000002",
          },
        ],
      },
      "history-two",
    );
    const first = await contactHistory({ limit: 1 });
    expect(first.revisions).toEqual([
      { listRevision: 2, action: "replaced", occurredAtUtc: clock.toISOString() },
    ]);
    expect(JSON.stringify(first)).not.toMatch(/Synthetic|\+660/);
    expect(first.nextCursor).toBeTruthy();
    const tampered = `${first.nextCursor!}x`;
    await expect(contactHistory({ limit: 1, cursor: tampered })).rejects.toMatchObject({
      code: "EMERGENCY_PLAN_VALIDATION_FAILED",
    });
  });

  function makeService(
    beforeCommit?: (
      operation: "contacts_replace" | "draft_save" | "version_review",
    ) => void | Promise<void>,
  ) {
    return new EmergencyReadinessService(pool, {
      cursorKey: Buffer.alloc(32, 7),
      now: () => new Date(clock),
      id: (prefix) => `${prefix}_p4s2_${++sequence}`,
      ...(beforeCommit ? { beforeCommit } : {}),
    });
  }

  function authorize(
    permission: CoordinationPermission,
    requestDigest: string,
  ): CoordinationAuthorizationDecision {
    return {
      decisionId: `decision_p4s2_${++sequence}`,
      permission,
      actor: {
        actorId: "account_p4s2",
        actorRef: "actor_ref_p4s2",
        displayKey: "coordination.actor.you",
        subject: true,
      },
      householdId: "household_p4s2",
      recipientContextId: "recipient_context_p4s2",
      subjectId: "subject_p4s2",
      subjectVersion: 1,
      grantId: "grant_p4s2",
      grantVersion: 3,
      privacyVersion: 2,
      target: null,
      eligibleTargets: [],
      decidedAt: clock.toISOString(),
      correlationId: "corr_p4s2",
      requestDigest,
    };
  }

  function digest(value: unknown) {
    return EmergencyReadinessService.requestDigest(value);
  }

  function replaceContacts(request: ReplaceEmergencyContactsRequest, key = "contacts-one") {
    const parsed = ReplaceEmergencyContactsRequestSchema.parse(request);
    return service.replaceContacts({
      householdId: "household_p4s2",
      request: parsed,
      idempotencyKey: key,
      authorization: authorize(
        "coordination.emergency_contacts.replace",
        digest({
          operation: "emergency_contacts.replace",
          householdId: "household_p4s2",
          request: parsed,
        }),
      ),
      correlationId: "corr_p4s2",
    });
  }

  function saveDraft(request: SaveEmergencyPlanDraftRequest, key = "draft-one") {
    const parsed = SaveEmergencyPlanDraftRequestSchema.parse(request);
    return service.saveDraft({
      householdId: "household_p4s2",
      request: parsed,
      idempotencyKey: key,
      authorization: authorize(
        "coordination.emergency_plan.draft.save",
        digest({
          operation: "emergency_plan.draft.save",
          householdId: "household_p4s2",
          request: parsed,
        }),
      ),
      correlationId: "corr_p4s2",
    });
  }

  function reviewVersion(request: ReviewEmergencyPlanVersionRequest, key = "review-one") {
    const parsed = ReviewEmergencyPlanVersionRequestSchema.parse(request);
    return service.reviewVersion({
      householdId: "household_p4s2",
      request: parsed,
      idempotencyKey: key,
      authorization: authorize(
        "coordination.emergency_plan.version.review",
        digest({
          operation: "emergency_plan.version.review",
          householdId: "household_p4s2",
          request: parsed,
        }),
      ),
      correlationId: "corr_p4s2",
    });
  }

  function contactHistory(queryInput: { limit: number; cursor?: string }) {
    const query = EmergencyHistoryQuerySchema.parse(queryInput);
    return service.contactHistory({
      householdId: "household_p4s2",
      query,
      authorization: authorize(
        "coordination.emergency_contacts.history.read",
        digest({
          operation: "emergency_contacts.history",
          householdId: "household_p4s2",
          query,
        }),
      ),
      correlationId: "corr_p4s2",
    });
  }

  async function expectCount(table: string, count: number) {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${table}`,
    );
    expect(Number(result.rows[0]?.count)).toBe(count);
  }
});
