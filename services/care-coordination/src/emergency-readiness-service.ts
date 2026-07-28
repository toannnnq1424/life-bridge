import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  CoordinationAuthorizationDecisionSchema,
  EmergencyContactHistoryProjectionSchema,
  EmergencyContactListProjectionSchema,
  EmergencyContactMutationResultSchema,
  EmergencyHistoryQuerySchema,
  EmergencyOfflineSnapshotSchema,
  EmergencyPlanHistoryProjectionSchema,
  EmergencyPlanMutationResultSchema,
  EmergencyPlanProjectionSchema,
  ReplaceEmergencyContactsRequestSchema,
  ReviewEmergencyPlanVersionRequestSchema,
  SaveEmergencyPlanDraftRequestSchema,
  type CoordinationAuthorizationDecision,
  type CoordinationPermission,
  type EmergencyContactHistoryProjection,
  type EmergencyContactListProjection,
  type EmergencyContactMutationResult,
  type EmergencyHistoryQuery,
  type EmergencyOfflineSnapshot,
  type EmergencyPlanHistoryProjection,
  type EmergencyPlanMutationResult,
  type EmergencyPlanProjection,
  type EmergencyPlanState,
  type ReplaceEmergencyContactsRequest,
  type ReviewEmergencyPlanVersionRequest,
  type SaveEmergencyPlanDraftRequest,
} from "@lifebridge/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { CareError } from "./errors.js";

const DECISION_MAX_AGE_MS = 10_000;
const DECISION_FUTURE_TOLERANCE_MS = 2_000;

interface Options {
  cursorKey: Buffer;
  now?: () => Date;
  id?: (prefix: string) => string;
  beforeCommit?: (
    operation: "contacts_replace" | "draft_save" | "version_review",
  ) => void | Promise<void>;
}

interface ReadinessRow extends QueryResultRow {
  readiness_id: string;
  household_id: string;
  recipient_context_id: string;
  aggregate_revision: number;
  contact_list_revision: number;
  current_plan_version: number | null;
  state: EmergencyPlanState;
  created_at: Date;
  updated_at: Date;
  last_confirmed_at: Date;
}

interface ContactRow extends QueryResultRow {
  contact_id: string;
  position: number;
  display_label: string;
  dial_string: string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface DraftRow extends QueryResultRow {
  draft_revision: number;
  base_plan_version: number;
  contact_list_revision: number;
  updated_at: Date;
}

interface VersionRow extends QueryResultRow {
  plan_version: number;
  contact_list_revision: number;
  reviewed_at: Date;
  display_time_zone: string;
  display_local_time: string;
  display_utc_offset: string;
  event_ref: string;
}

interface StepRow extends QueryResultRow {
  position: number;
  step_text: string;
}

interface ReplayRow extends QueryResultRow {
  request_hash: string;
  response_body: unknown;
}

interface CursorPayload {
  kind: "contacts" | "plans";
  actorId: string;
  householdId: string;
  recipientContextId: string;
  subjectVersion: number;
  grantVersion: number | null;
  privacyVersion: number | null;
  before: number;
  limit: number;
  expiresAt: number;
}

export class EmergencyReadinessService {
  private readonly now: () => Date;
  private readonly id: (prefix: string) => string;

  public constructor(
    private readonly pool: Pool,
    private readonly options: Options,
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? ((prefix) => `${prefix}_${randomUUID().replaceAll("-", "")}`);
  }

  public static requestDigest(value: unknown): string {
    return digestJson(value);
  }

  public async readContacts(input: {
    householdId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<EmergencyContactListProjection> {
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.emergency_contacts.read",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "emergency_contacts.read", householdId: input.householdId }),
    );
    const readiness = await this.findReadiness(
      this.pool,
      input.householdId,
      authorization.recipientContextId,
    );
    const now = this.now();
    if (!readiness) {
      return EmergencyContactListProjectionSchema.parse({
        state: "no_contacts",
        listRevision: 0,
        contacts: [],
        lastConfirmedAtUtc: now.toISOString(),
      });
    }
    const contacts = await this.contacts(this.pool, readiness.readiness_id);
    return EmergencyContactListProjectionSchema.parse({
      state: contacts.length ? "configured" : "no_contacts",
      listRevision: readiness.contact_list_revision,
      contacts: contacts.map(projectContact),
      lastConfirmedAtUtc: now.toISOString(),
    });
  }

  public async replaceContacts(input: {
    householdId: string;
    request: ReplaceEmergencyContactsRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<EmergencyContactMutationResult> {
    const request = ReplaceEmergencyContactsRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.emergency_contacts.replace",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "emergency_contacts.replace",
        householdId: input.householdId,
        request,
      }),
    );
    const keyDigest = digestText(input.idempotencyKey);
    const requestHash = digestJson({
      householdId: input.householdId,
      recipientContextId: authorization.recipientContextId,
      request,
    });
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      await this.lock(client, authorization.recipientContextId, "contacts", keyDigest);
      const replay = await this.replay(
        client,
        "emergency.contacts.replace",
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        await client.query("COMMIT");
        open = false;
        return EmergencyContactMutationResultSchema.parse(replay.response_body);
      }

      const now = this.now();
      let readiness = await this.findReadiness(
        client,
        input.householdId,
        authorization.recipientContextId,
        true,
      );
      if (!readiness) {
        if (request.expectedListRevision !== 0 || request.contacts.some((x) => x.contactId)) {
          throw contactListConflict();
        }
        const readinessId = this.id("emergency_readiness");
        await client.query(
          `INSERT INTO care_emergency_readiness(
             readiness_id,household_id,recipient_context_id,aggregate_revision,
             contact_list_revision,current_plan_version,state,created_at,updated_at,last_confirmed_at
           ) VALUES ($1,$2,$3,0,0,NULL,'no_plan',$4,$4,$4)`,
          [readinessId, input.householdId, authorization.recipientContextId, now],
        );
        readiness = await this.findReadiness(
          client,
          input.householdId,
          authorization.recipientContextId,
          true,
        );
      }
      if (!readiness || readiness.contact_list_revision !== request.expectedListRevision) {
        throw contactListConflict();
      }

      const current = await this.contacts(client, readiness.readiness_id, true);
      const currentById = new Map(current.map((row) => [row.contact_id, row]));
      for (const candidate of request.contacts) {
        if (!candidate.contactId) continue;
        const row = currentById.get(candidate.contactId);
        if (!row || row.version !== candidate.expectedVersion) throw contactVersionConflict();
      }

      await client.query(`DELETE FROM care_emergency_contacts WHERE readiness_id=$1`, [
        readiness.readiness_id,
      ]);
      const confirmedContacts: Array<{
        contactId: string;
        position: number;
        version: number;
      }> = [];
      for (const [index, candidate] of request.contacts.entries()) {
        const previous = candidate.contactId ? currentById.get(candidate.contactId) : undefined;
        const contactId = candidate.contactId ?? this.id("emergency_contact");
        const version = previous ? previous.version + 1 : 1;
        await client.query(
          `INSERT INTO care_emergency_contacts(
             contact_id,readiness_id,position,display_label,dial_string,version,created_at,updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
          [
            contactId,
            readiness.readiness_id,
            index + 1,
            candidate.displayLabel,
            candidate.dialString,
            version,
            previous?.created_at ?? now,
          ],
        );
        confirmedContacts.push({ contactId, position: index + 1, version });
      }

      const listRevision = readiness.contact_list_revision + 1;
      const aggregateRevision = readiness.aggregate_revision + 1;
      const state: EmergencyPlanState = readiness.current_plan_version
        ? "review_required"
        : (await this.draft(client, readiness.readiness_id))
          ? "draft_only"
          : "no_plan";
      await client.query(
        `UPDATE care_emergency_readiness
         SET aggregate_revision=$2,contact_list_revision=$3,state=$4,
             updated_at=$5,last_confirmed_at=$5
         WHERE readiness_id=$1`,
        [readiness.readiness_id, aggregateRevision, listRevision, state, now],
      );
      await client.query(
        `INSERT INTO care_emergency_contact_transitions(
           transition_id,readiness_id,contact_list_revision,action,occurred_at,correlation_id
         ) VALUES ($1,$2,$3,'replaced',$4,$5)`,
        [this.id("transition"), readiness.readiness_id, listRevision, now, input.correlationId],
      );
      await this.outbox(client, {
        eventType: "care.emergency_contacts.changed.v1",
        readinessId: readiness.readiness_id,
        aggregateRevision,
        contactListRevision: listRevision,
        planVersion: readiness.current_plan_version ?? 0,
        action: "contacts_replaced",
        correlationId: input.correlationId,
        now,
      });
      await this.audit(
        client,
        authorization,
        input.householdId,
        "emergency_contacts.replace",
        readiness.readiness_id,
        input.correlationId,
        now,
      );
      const response = EmergencyContactMutationResultSchema.parse({
        outcome: "contacts_replaced",
        listRevision,
        contacts: confirmedContacts,
        planState: state,
        confirmedAtUtc: now.toISOString(),
      });
      await this.writeReplay(
        client,
        "emergency.contacts.replace",
        authorization.actor.actorId,
        keyDigest,
        requestHash,
        response,
        now,
      );
      await this.options.beforeCommit?.("contacts_replace");
      await client.query("COMMIT");
      open = false;
      return response;
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async contactHistory(input: {
    householdId: string;
    query: EmergencyHistoryQuery;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<EmergencyContactHistoryProjection> {
    const query = EmergencyHistoryQuerySchema.parse(input.query);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.emergency_contacts.history.read",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "emergency_contacts.history",
        householdId: input.householdId,
        query,
      }),
    );
    const readiness = await this.findReadiness(
      this.pool,
      input.householdId,
      authorization.recipientContextId,
    );
    const coverageStartedAtUtc = await this.coverage();
    if (!readiness) {
      return EmergencyContactHistoryProjectionSchema.parse({
        revisions: [],
        nextCursor: null,
        coverageStartedAtUtc,
      });
    }
    const before = this.historyBefore(query, authorization, input.householdId, "contacts");
    const result = await this.pool.query<{
      contact_list_revision: number;
      occurred_at: Date;
    }>(
      `SELECT contact_list_revision,occurred_at
       FROM care_emergency_contact_transitions
       WHERE readiness_id=$1 AND contact_list_revision < $2
       ORDER BY contact_list_revision DESC
       LIMIT $3`,
      [readiness.readiness_id, before, query.limit + 1],
    );
    const rows = result.rows.slice(0, query.limit);
    return EmergencyContactHistoryProjectionSchema.parse({
      revisions: rows.map((row) => ({
        listRevision: row.contact_list_revision,
        action: "replaced",
        occurredAtUtc: row.occurred_at.toISOString(),
      })),
      nextCursor:
        result.rows.length > query.limit && rows.at(-1)
          ? this.sealCursor(
              this.cursorPayload(
                "contacts",
                authorization,
                input.householdId,
                rows.at(-1)!.contact_list_revision,
                query.limit,
              ),
            )
          : null,
      coverageStartedAtUtc,
    });
  }

  public async readPlan(input: {
    householdId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<EmergencyPlanProjection> {
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.emergency_plan.read",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "emergency_plan.read", householdId: input.householdId }),
    );
    const readiness = await this.findReadiness(
      this.pool,
      input.householdId,
      authorization.recipientContextId,
    );
    const now = this.now();
    if (!readiness) {
      return EmergencyPlanProjectionSchema.parse({
        state: "no_plan",
        aggregateRevision: 0,
        contactListRevision: 0,
        current: null,
        draft: null,
        lastConfirmedAtUtc: now.toISOString(),
      });
    }
    return this.projectPlan(this.pool, readiness, now);
  }

  public async saveDraft(input: {
    householdId: string;
    request: SaveEmergencyPlanDraftRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<EmergencyPlanMutationResult> {
    const request = SaveEmergencyPlanDraftRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.emergency_plan.draft.save",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "emergency_plan.draft.save",
        householdId: input.householdId,
        request,
      }),
    );
    const keyDigest = digestText(input.idempotencyKey);
    const requestHash = digestJson({
      householdId: input.householdId,
      recipientContextId: authorization.recipientContextId,
      request,
    });
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      await this.lock(client, authorization.recipientContextId, "plan-draft", keyDigest);
      const replay = await this.replay(
        client,
        "emergency.plan.draft.save",
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        await client.query("COMMIT");
        open = false;
        return EmergencyPlanMutationResultSchema.parse(replay.response_body);
      }
      const now = this.now();
      let readiness = await this.findReadiness(
        client,
        input.householdId,
        authorization.recipientContextId,
        true,
      );
      if (!readiness) {
        if (
          request.expectedAggregateRevision !== 0 ||
          request.expectedDraftRevision !== 0 ||
          request.basePlanVersion !== 0 ||
          request.contactListRevision !== 0
        ) {
          throw planAggregateConflict();
        }
        const readinessId = this.id("emergency_readiness");
        await client.query(
          `INSERT INTO care_emergency_readiness(
             readiness_id,household_id,recipient_context_id,aggregate_revision,
             contact_list_revision,current_plan_version,state,created_at,updated_at,last_confirmed_at
           ) VALUES ($1,$2,$3,0,0,NULL,'no_plan',$4,$4,$4)`,
          [readinessId, input.householdId, authorization.recipientContextId, now],
        );
        readiness = await this.findReadiness(
          client,
          input.householdId,
          authorization.recipientContextId,
          true,
        );
      }
      if (
        !readiness ||
        readiness.aggregate_revision !== request.expectedAggregateRevision ||
        readiness.contact_list_revision !== request.contactListRevision ||
        (readiness.current_plan_version ?? 0) !== request.basePlanVersion
      ) {
        throw planAggregateConflict();
      }
      const prior = await this.draft(client, readiness.readiness_id, true);
      if ((prior?.draft_revision ?? 0) !== request.expectedDraftRevision) {
        throw planDraftConflict();
      }
      const draftRevision = (prior?.draft_revision ?? 0) + 1;
      const aggregateRevision = readiness.aggregate_revision + 1;
      const state: EmergencyPlanState = readiness.current_plan_version
        ? "review_required"
        : "draft_only";
      await client.query(
        `INSERT INTO care_emergency_plan_drafts(
           readiness_id,draft_revision,base_plan_version,contact_list_revision,updated_at
         ) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT(readiness_id) DO UPDATE SET
           draft_revision=EXCLUDED.draft_revision,
           base_plan_version=EXCLUDED.base_plan_version,
           contact_list_revision=EXCLUDED.contact_list_revision,
           updated_at=EXCLUDED.updated_at`,
        [
          readiness.readiness_id,
          draftRevision,
          request.basePlanVersion,
          request.contactListRevision,
          now,
        ],
      );
      await client.query(`DELETE FROM care_emergency_plan_draft_steps WHERE readiness_id=$1`, [
        readiness.readiness_id,
      ]);
      for (const [index, step] of request.steps.entries()) {
        await client.query(
          `INSERT INTO care_emergency_plan_draft_steps(readiness_id,position,step_text)
           VALUES ($1,$2,$3)`,
          [readiness.readiness_id, index + 1, step],
        );
      }
      await client.query(
        `UPDATE care_emergency_readiness
         SET aggregate_revision=$2,state=$3,updated_at=$4,last_confirmed_at=$4
         WHERE readiness_id=$1`,
        [readiness.readiness_id, aggregateRevision, state, now],
      );
      await this.planTransition(
        client,
        readiness.readiness_id,
        aggregateRevision,
        null,
        "draft_saved",
        input.correlationId,
        now,
      );
      await this.audit(
        client,
        authorization,
        input.householdId,
        "emergency_plan.draft.save",
        readiness.readiness_id,
        input.correlationId,
        now,
      );
      const response = EmergencyPlanMutationResultSchema.parse({
        outcome: "draft_saved",
        aggregateRevision,
        draftRevision,
        planVersion: null,
        contactListRevision: readiness.contact_list_revision,
        state,
        confirmedAtUtc: now.toISOString(),
      });
      await this.writeReplay(
        client,
        "emergency.plan.draft.save",
        authorization.actor.actorId,
        keyDigest,
        requestHash,
        response,
        now,
      );
      await this.options.beforeCommit?.("draft_save");
      await client.query("COMMIT");
      open = false;
      return response;
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async reviewVersion(input: {
    householdId: string;
    request: ReviewEmergencyPlanVersionRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<EmergencyPlanMutationResult> {
    const request = ReviewEmergencyPlanVersionRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.emergency_plan.version.review",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "emergency_plan.version.review",
        householdId: input.householdId,
        request,
      }),
    );
    const keyDigest = digestText(input.idempotencyKey);
    const requestHash = digestJson({
      householdId: input.householdId,
      recipientContextId: authorization.recipientContextId,
      request,
    });
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      await this.lock(client, authorization.recipientContextId, "plan-review", keyDigest);
      const replay = await this.replay(
        client,
        "emergency.plan.version.review",
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        await client.query("COMMIT");
        open = false;
        return EmergencyPlanMutationResultSchema.parse(replay.response_body);
      }
      const readiness = await this.findReadiness(
        client,
        input.householdId,
        authorization.recipientContextId,
        true,
      );
      if (
        !readiness ||
        readiness.aggregate_revision !== request.expectedAggregateRevision ||
        readiness.contact_list_revision !== request.contactListRevision ||
        (readiness.current_plan_version ?? 0) !== request.basePlanVersion
      ) {
        throw planAggregateConflict();
      }
      const draft = await this.draft(client, readiness.readiness_id, true);
      if (!draft || draft.draft_revision !== request.expectedDraftRevision) {
        throw planDraftConflict();
      }
      if (
        draft.base_plan_version !== request.basePlanVersion ||
        draft.contact_list_revision !== request.contactListRevision
      ) {
        throw planContactsChanged();
      }
      const contacts = await this.contacts(client, readiness.readiness_id, true);
      if (!contacts.length) throw planReviewRequired();
      const steps = await this.draftSteps(client, readiness.readiness_id);
      if (!steps.length) throw planReviewRequired();

      const now = this.now();
      const display = displayFacts(now, request.displayTimeZone);
      const planVersion = (readiness.current_plan_version ?? 0) + 1;
      const aggregateRevision = readiness.aggregate_revision + 1;
      const eventRef = this.id("event");
      await client.query(
        `INSERT INTO care_emergency_plan_versions(
           readiness_id,plan_version,contact_list_revision,reviewed_at,
           display_time_zone,display_local_time,display_utc_offset,event_ref
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          readiness.readiness_id,
          planVersion,
          request.contactListRevision,
          now,
          request.displayTimeZone,
          display.local,
          display.offset,
          eventRef,
        ],
      );
      for (const step of steps) {
        await client.query(
          `INSERT INTO care_emergency_plan_version_steps(
             readiness_id,plan_version,position,step_text
           ) VALUES ($1,$2,$3,$4)`,
          [readiness.readiness_id, planVersion, step.position, step.step_text],
        );
      }
      await client.query(`DELETE FROM care_emergency_plan_drafts WHERE readiness_id=$1`, [
        readiness.readiness_id,
      ]);
      await client.query(
        `UPDATE care_emergency_readiness
         SET aggregate_revision=$2,current_plan_version=$3,state='reviewed',
             updated_at=$4,last_confirmed_at=$4
         WHERE readiness_id=$1`,
        [readiness.readiness_id, aggregateRevision, planVersion, now],
      );
      await this.planTransition(
        client,
        readiness.readiness_id,
        aggregateRevision,
        planVersion,
        "version_reviewed",
        input.correlationId,
        now,
      );
      await this.outbox(client, {
        eventType: "care.emergency_plan.version_reviewed.v1",
        eventId: eventRef,
        readinessId: readiness.readiness_id,
        aggregateRevision,
        contactListRevision: request.contactListRevision,
        planVersion,
        action: "version_reviewed",
        correlationId: input.correlationId,
        now,
      });
      await this.audit(
        client,
        authorization,
        input.householdId,
        "emergency_plan.version.review",
        readiness.readiness_id,
        input.correlationId,
        now,
      );
      const response = EmergencyPlanMutationResultSchema.parse({
        outcome: "version_reviewed",
        aggregateRevision,
        draftRevision: null,
        planVersion,
        contactListRevision: request.contactListRevision,
        state: "reviewed",
        confirmedAtUtc: now.toISOString(),
      });
      await this.writeReplay(
        client,
        "emergency.plan.version.review",
        authorization.actor.actorId,
        keyDigest,
        requestHash,
        response,
        now,
      );
      await this.options.beforeCommit?.("version_review");
      await client.query("COMMIT");
      open = false;
      return response;
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async planHistory(input: {
    householdId: string;
    query: EmergencyHistoryQuery;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<EmergencyPlanHistoryProjection> {
    const query = EmergencyHistoryQuerySchema.parse(input.query);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.emergency_plan.history.read",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "emergency_plan.history",
        householdId: input.householdId,
        query,
      }),
    );
    const readiness = await this.findReadiness(
      this.pool,
      input.householdId,
      authorization.recipientContextId,
    );
    const coverageStartedAtUtc = await this.coverage();
    if (!readiness) {
      return EmergencyPlanHistoryProjectionSchema.parse({
        versions: [],
        nextCursor: null,
        coverageStartedAtUtc,
      });
    }
    const before = this.historyBefore(query, authorization, input.householdId, "plans");
    const result = await this.pool.query<VersionRow>(
      `SELECT plan_version,contact_list_revision,reviewed_at,display_time_zone,
              display_local_time,display_utc_offset,event_ref
       FROM care_emergency_plan_versions
       WHERE readiness_id=$1 AND plan_version < $2
       ORDER BY plan_version DESC
       LIMIT $3`,
      [readiness.readiness_id, before, query.limit + 1],
    );
    const rows = result.rows.slice(0, query.limit);
    return EmergencyPlanHistoryProjectionSchema.parse({
      versions: rows.map(projectHistoryVersion),
      nextCursor:
        result.rows.length > query.limit && rows.at(-1)
          ? this.sealCursor(
              this.cursorPayload(
                "plans",
                authorization,
                input.householdId,
                rows.at(-1)!.plan_version,
                query.limit,
              ),
            )
          : null,
      coverageStartedAtUtc,
    });
  }

  public async offlineSnapshot(input: {
    householdId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<EmergencyOfflineSnapshot> {
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.emergency_plan.offline_snapshot.read",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "emergency_plan.offline_snapshot", householdId: input.householdId }),
    );
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      open = true;
      const readiness = await this.findReadiness(
        client,
        input.householdId,
        authorization.recipientContextId,
      );
      if (!readiness || readiness.state !== "reviewed" || !readiness.current_plan_version) {
        throw planReviewRequired();
      }
      const version = await this.version(
        client,
        readiness.readiness_id,
        readiness.current_plan_version,
      );
      if (!version || version.contact_list_revision !== readiness.contact_list_revision) {
        throw planContactsChanged();
      }
      const contacts = await this.contacts(client, readiness.readiness_id);
      const steps = await this.versionSteps(
        client,
        readiness.readiness_id,
        readiness.current_plan_version,
      );
      if (!contacts.length || !steps.length) throw planReviewRequired();
      const confirmed = this.now();
      const freshUntil = new Date(confirmed.getTime() + 24 * 60 * 60 * 1_000);
      const expires = new Date(confirmed.getTime() + 72 * 60 * 60 * 1_000);
      const snapshot = EmergencyOfflineSnapshotSchema.parse({
        contractVersion: "P4-S2-offline-v1",
        source: "care-coordination",
        scopeBinding: digestText(
          `${authorization.actor.actorId}:${input.householdId}:${authorization.recipientContextId}`,
        ),
        planVersion: version.plan_version,
        contactListRevision: version.contact_list_revision,
        reviewedAtUtc: version.reviewed_at.toISOString(),
        lastConfirmedAtUtc: confirmed.toISOString(),
        displayTimeZone: version.display_time_zone,
        displayLocalTime: version.display_local_time,
        displayUtcOffset: version.display_utc_offset,
        freshUntilUtc: freshUntil.toISOString(),
        expiresAtUtc: expires.toISOString(),
        contacts: contacts.map((row) => {
          const contact = projectContact(row);
          return {
            contactId: contact.contactId,
            position: contact.position,
            displayLabel: contact.displayLabel,
            dialString: contact.dialString,
          };
        }),
        steps: steps.map((row) => ({ position: row.position, text: row.step_text })),
      });
      await client.query("COMMIT");
      open = false;
      return snapshot;
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private requireDecision(
    input: CoordinationAuthorizationDecision,
    permission: CoordinationPermission,
    householdId: string,
    correlationId: string,
    requestDigest: string,
  ) {
    const decision = CoordinationAuthorizationDecisionSchema.parse(input);
    const age = this.now().getTime() - new Date(decision.decidedAt).getTime();
    if (
      decision.permission !== permission ||
      decision.householdId !== householdId ||
      decision.correlationId !== correlationId ||
      decision.requestDigest !== requestDigest ||
      age > DECISION_MAX_AGE_MS ||
      age < -DECISION_FUTURE_TOLERANCE_MS
    ) {
      throw inaccessible();
    }
    return decision;
  }

  private async findReadiness(
    db: Pool | PoolClient,
    householdId: string,
    recipientContextId: string,
    forUpdate = false,
  ) {
    const result = await db.query<ReadinessRow>(
      `SELECT readiness_id,household_id,recipient_context_id,aggregate_revision,
              contact_list_revision,current_plan_version,state,created_at,updated_at,
              last_confirmed_at
       FROM care_emergency_readiness
       WHERE household_id=$1 AND recipient_context_id=$2${forUpdate ? " FOR UPDATE" : ""}`,
      [householdId, recipientContextId],
    );
    return result.rows[0];
  }

  private async contacts(db: Pool | PoolClient, readinessId: string, forUpdate = false) {
    const result = await db.query<ContactRow>(
      `SELECT contact_id,position,display_label,dial_string,version,created_at,updated_at
       FROM care_emergency_contacts
       WHERE readiness_id=$1
       ORDER BY position,contact_id${forUpdate ? " FOR UPDATE" : ""}`,
      [readinessId],
    );
    return result.rows;
  }

  private async draft(db: Pool | PoolClient, readinessId: string, forUpdate = false) {
    const result = await db.query<DraftRow>(
      `SELECT draft_revision,base_plan_version,contact_list_revision,updated_at
       FROM care_emergency_plan_drafts
       WHERE readiness_id=$1${forUpdate ? " FOR UPDATE" : ""}`,
      [readinessId],
    );
    return result.rows[0];
  }

  private async draftSteps(db: Pool | PoolClient, readinessId: string) {
    const result = await db.query<StepRow>(
      `SELECT position,step_text FROM care_emergency_plan_draft_steps
       WHERE readiness_id=$1 ORDER BY position`,
      [readinessId],
    );
    return result.rows;
  }

  private async version(db: Pool | PoolClient, readinessId: string, planVersion: number) {
    const result = await db.query<VersionRow>(
      `SELECT plan_version,contact_list_revision,reviewed_at,display_time_zone,
              display_local_time,display_utc_offset,event_ref
       FROM care_emergency_plan_versions
       WHERE readiness_id=$1 AND plan_version=$2`,
      [readinessId, planVersion],
    );
    return result.rows[0];
  }

  private async versionSteps(db: Pool | PoolClient, readinessId: string, planVersion: number) {
    const result = await db.query<StepRow>(
      `SELECT position,step_text FROM care_emergency_plan_version_steps
       WHERE readiness_id=$1 AND plan_version=$2 ORDER BY position`,
      [readinessId, planVersion],
    );
    return result.rows;
  }

  private async projectPlan(db: Pool | PoolClient, readiness: ReadinessRow, now: Date) {
    const draft = await this.draft(db, readiness.readiness_id);
    const current = readiness.current_plan_version
      ? await this.version(db, readiness.readiness_id, readiness.current_plan_version)
      : undefined;
    const currentSteps = current
      ? await this.versionSteps(db, readiness.readiness_id, current.plan_version)
      : [];
    const draftSteps = draft ? await this.draftSteps(db, readiness.readiness_id) : [];
    return EmergencyPlanProjectionSchema.parse({
      state: readiness.state,
      aggregateRevision: readiness.aggregate_revision,
      contactListRevision: readiness.contact_list_revision,
      current: current
        ? {
            planVersion: current.plan_version,
            contactListRevision: current.contact_list_revision,
            steps: currentSteps.map((row) => row.step_text),
            reviewedAtUtc: current.reviewed_at.toISOString(),
            displayTimeZone: current.display_time_zone,
            displayLocalTime: current.display_local_time,
            displayUtcOffset: current.display_utc_offset,
          }
        : null,
      draft: draft
        ? {
            draftRevision: draft.draft_revision,
            basePlanVersion: draft.base_plan_version,
            contactListRevision: draft.contact_list_revision,
            steps: draftSteps.map((row) => row.step_text),
            updatedAtUtc: draft.updated_at.toISOString(),
          }
        : null,
      lastConfirmedAtUtc: now.toISOString(),
    });
  }

  private async coverage() {
    const result = await this.pool.query<{ emergency_readiness_coverage_started_at: Date }>(
      `SELECT emergency_readiness_coverage_started_at
       FROM care_schema_state WHERE service='care-coordination'`,
    );
    return result.rows[0]!.emergency_readiness_coverage_started_at.toISOString();
  }

  private async lock(
    client: PoolClient,
    recipientContextId: string,
    operation: string,
    keyDigest: string,
  ) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `emergency-readiness:${recipientContextId}`,
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `emergency-readiness:${operation}:${keyDigest}`,
    ]);
  }

  private async replay(client: PoolClient, operation: string, actorId: string, keyDigest: string) {
    const result = await client.query<ReplayRow>(
      `SELECT request_hash,response_body FROM care_idempotency
       WHERE operation=$1 AND actor_id=$2 AND idempotency_key=$3`,
      [operation, actorId, keyDigest],
    );
    return result.rows[0];
  }

  private async writeReplay(
    client: PoolClient,
    operation: string,
    actorId: string,
    keyDigest: string,
    requestHash: string,
    response: unknown,
    now: Date,
  ) {
    await client.query(
      `INSERT INTO care_idempotency(
         operation,actor_id,idempotency_key,request_hash,response_status,
         response_body,created_at,expires_at
       ) VALUES (
         $1,$2,$3,$4,200,$5,$6::timestamptz,
         $6::timestamptz + INTERVAL '24 hours'
       )`,
      [operation, actorId, keyDigest, requestHash, JSON.stringify(response), now],
    );
  }

  private async audit(
    client: PoolClient,
    authorization: CoordinationAuthorizationDecision,
    householdId: string,
    action: string,
    resourceId: string,
    correlationId: string,
    now: Date,
  ) {
    await client.query(
      `INSERT INTO care_audit(
         audit_id,actor_id,household_id,action,resource_type,resource_id,
         result,occurred_at,correlation_id,metadata
       ) VALUES ($1,$2,$3,$4,'emergency_readiness',$5,'success',$6,$7,'{}'::jsonb)`,
      [
        this.id("audit"),
        authorization.actor.actorId,
        householdId,
        action,
        resourceId,
        now,
        correlationId,
      ],
    );
  }

  private async planTransition(
    client: PoolClient,
    readinessId: string,
    aggregateRevision: number,
    planVersion: number | null,
    action: "draft_saved" | "version_reviewed",
    correlationId: string,
    now: Date,
  ) {
    await client.query(
      `INSERT INTO care_emergency_plan_transitions(
         transition_id,readiness_id,aggregate_revision,plan_version,action,
         occurred_at,correlation_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        this.id("transition"),
        readinessId,
        aggregateRevision,
        planVersion,
        action,
        now,
        correlationId,
      ],
    );
  }

  private async outbox(
    client: PoolClient,
    input: {
      eventType: "care.emergency_contacts.changed.v1" | "care.emergency_plan.version_reviewed.v1";
      eventId?: string;
      readinessId: string;
      aggregateRevision: number;
      contactListRevision: number;
      planVersion: number;
      action: "contacts_replaced" | "version_reviewed";
      correlationId: string;
      now: Date;
    },
  ) {
    const eventId = input.eventId ?? this.id("event");
    await client.query(
      `INSERT INTO care_outbox(
         event_id,event_type,event_version,aggregate_id,aggregate_version,
         correlation_id,causation_id,payload,occurred_at,status,attempt_count,
         next_attempt_at,delivered_at
       ) VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,'suppressed',0,$8,$8)`,
      [
        eventId,
        input.eventType,
        input.readinessId,
        input.aggregateRevision,
        input.correlationId,
        this.id("cause"),
        JSON.stringify({
          action: input.action,
          outcome: "confirmed",
          contactListRevision: input.contactListRevision,
          planVersion: input.planVersion,
          deliveryDisposition: "none",
        }),
        input.now,
      ],
    );
  }

  private historyBefore(
    query: EmergencyHistoryQuery,
    authorization: CoordinationAuthorizationDecision,
    householdId: string,
    kind: CursorPayload["kind"],
  ) {
    if (!query.cursor) return 2_147_483_647;
    const payload = this.openCursor(query.cursor);
    if (
      payload.kind !== kind ||
      payload.actorId !== authorization.actor.actorId ||
      payload.householdId !== householdId ||
      payload.recipientContextId !== authorization.recipientContextId ||
      payload.subjectVersion !== authorization.subjectVersion ||
      payload.grantVersion !== authorization.grantVersion ||
      payload.privacyVersion !== authorization.privacyVersion ||
      payload.limit !== query.limit ||
      payload.expiresAt < this.now().getTime()
    ) {
      throw cursorInvalid();
    }
    return payload.before;
  }

  private cursorPayload(
    kind: CursorPayload["kind"],
    authorization: CoordinationAuthorizationDecision,
    householdId: string,
    before: number,
    limit: number,
  ): CursorPayload {
    return {
      kind,
      actorId: authorization.actor.actorId,
      householdId,
      recipientContextId: authorization.recipientContextId,
      subjectVersion: authorization.subjectVersion,
      grantVersion: authorization.grantVersion,
      privacyVersion: authorization.privacyVersion,
      before,
      limit,
      expiresAt: this.now().getTime() + 5 * 60 * 1_000,
    };
  }

  private sealCursor(payload: CursorPayload) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${createHmac("sha256", this.options.cursorKey).update(body).digest("base64url")}`;
  }

  private openCursor(cursor: string): CursorPayload {
    try {
      const [body, signature] = cursor.split(".");
      if (!body || !signature) throw new Error("cursor");
      const expected = createHmac("sha256", this.options.cursorKey).update(body).digest();
      const actual = Buffer.from(signature, "base64url");
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        throw new Error("cursor");
      }
      return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CursorPayload;
    } catch {
      throw cursorInvalid();
    }
  }
}

function projectContact(row: ContactRow) {
  return {
    contactId: row.contact_id,
    position: row.position,
    displayLabel: row.display_label,
    dialString: row.dial_string,
    version: row.version,
  };
}

function projectHistoryVersion(row: VersionRow) {
  return {
    planVersion: row.plan_version,
    contactListRevision: row.contact_list_revision,
    reviewedAtUtc: row.reviewed_at.toISOString(),
    displayTimeZone: row.display_time_zone,
    displayLocalTime: row.display_local_time,
    displayUtcOffset: row.display_utc_offset,
  };
}

function displayFacts(value: Date, timeZone: string) {
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(value);
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(value);
  const zone = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = zone.match(/^GMT([+-])(\d{1,2}):(\d{2})$/);
  const offset = match ? `${match[1]}${match[2]!.padStart(2, "0")}:${match[3]}` : "+00:00";
  return { local, offset };
}

function digestJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function digestText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function inaccessible() {
  return new CareError(
    404,
    "COORDINATION_RESOURCE_NOT_FOUND",
    "coordination.resource.not_found",
    false,
  );
}

function idempotencyConflict() {
  return new CareError(409, "IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict", false);
}

function contactListConflict() {
  return new CareError(
    409,
    "EMERGENCY_CONTACT_LIST_VERSION_CONFLICT",
    "emergency_contacts.version_conflict",
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    "reload_current",
  );
}

function contactVersionConflict() {
  return new CareError(
    409,
    "EMERGENCY_CONTACT_VERSION_CONFLICT",
    "emergency_contacts.item_version_conflict",
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    "reload_current",
  );
}

function planAggregateConflict() {
  return new CareError(
    409,
    "EMERGENCY_PLAN_AGGREGATE_CONFLICT",
    "emergency_plan.aggregate_conflict",
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    "reload_current",
  );
}

function planDraftConflict() {
  return new CareError(
    409,
    "EMERGENCY_PLAN_DRAFT_CONFLICT",
    "emergency_plan.draft_conflict",
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    "reload_current",
  );
}

function planContactsChanged() {
  return new CareError(
    409,
    "EMERGENCY_PLAN_CONTACTS_CHANGED",
    "emergency_plan.contacts_changed",
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    "reload_current",
  );
}

function planReviewRequired() {
  return new CareError(
    409,
    "EMERGENCY_PLAN_REVIEW_REQUIRED",
    "emergency_plan.review_required",
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    "reload_current",
  );
}

function cursorInvalid() {
  return new CareError(
    400,
    "EMERGENCY_PLAN_VALIDATION_FAILED",
    "emergency_plan.cursor_invalid",
    false,
  );
}
