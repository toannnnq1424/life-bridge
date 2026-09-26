import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  CarePlanHistoryProjectionSchema,
  CarePlanHistoryQuerySchema,
  CarePlanMutationResultSchema,
  CarePlanProjectionSchema,
  CarePlanVersionConfirmedEventSchema,
  CarePlanVersionProjectionSchema,
  ConfirmCarePlanVersionRequestSchema,
  CoordinationAuthorizationDecisionSchema,
  SaveCarePlanDraftRequestSchema,
  type CarePlanHistoryProjection,
  type CarePlanHistoryQuery,
  type CarePlanMutationResult,
  type CarePlanProjection,
  type CarePlanVersionProjection,
  type ConfirmCarePlanVersionRequest,
  type CoordinationAuthorizationDecision,
  type CoordinationPermission,
  type SaveCarePlanDraftRequest,
} from "@lifebridge/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { CareError } from "./errors.js";

const DECISION_MAX_AGE_MS = 10_000;
const DECISION_FUTURE_TOLERANCE_MS = 2_000;

interface Options {
  cursorKey: Buffer;
  now?: () => Date;
  id?: (prefix: string) => string;
}

interface PlanRow extends QueryResultRow {
  plan_id: string;
  household_id: string;
  recipient_context_id: string;
  aggregate_revision: number;
  current_version: number | null;
  created_at: Date;
  updated_at: Date;
}

interface DraftRow extends QueryResultRow {
  draft_revision: number;
  base_current_version: number | null;
  review_local_date: string | Date | null;
  review_time_zone: string | null;
  review_day_start_utc: Date | null;
  review_day_end_utc: Date | null;
  updated_at: Date;
}

interface VersionRow extends QueryResultRow {
  plan_version: number;
  change_groups: CarePlanVersionProjection["changeGroups"];
  review_local_date: string | Date;
  review_time_zone: string;
  review_day_start_utc: Date;
  review_day_end_utc: Date;
  confirmed_at: Date;
  event_ref: string;
}

interface ItemRow extends QueryResultRow {
  item_type: "goal" | "preference" | "responsibility";
  item_position: number;
  category: string;
  statement: string;
  actor_ref: string | null;
}

interface ReplayRow extends QueryResultRow {
  request_hash: string;
  response_body: unknown;
}

interface CursorPayload {
  actorId: string;
  householdId: string;
  recipientContextId: string;
  subjectVersion: number;
  grantVersion: number | null;
  privacyVersion: number | null;
  maxVersion: number;
  lastVersion: number;
  limit: number;
  expiresAt: number;
}

export class CarePlanService {
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

  public async read(input: {
    householdId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<CarePlanProjection> {
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.care_plan.read",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "care_plan.read", householdId: input.householdId }),
    );
    const coverage = await this.coverage();
    const plan = await this.findPlan(input.householdId, authorization.recipientContextId);
    const now = this.now();
    if (!plan) {
      return CarePlanProjectionSchema.parse({
        state: "no_plan",
        planId: null,
        aggregateRevision: 0,
        current: null,
        draft: null,
        eligibleResponsibilityActors: authorization.eligibleTargets,
        reviewState: "not_applicable",
        requiresReview: false,
        coverageStartedAt: coverage.toISOString(),
        serverTime: now.toISOString(),
      });
    }
    const current = plan.current_version
      ? await this.projectVersion(this.pool, plan.plan_id, plan.current_version, authorization, now)
      : null;
    const draft = await this.projectDraft(this.pool, plan.plan_id, authorization);
    return CarePlanProjectionSchema.parse({
      state: "plan",
      planId: plan.plan_id,
      aggregateRevision: plan.aggregate_revision,
      current,
      draft,
      eligibleResponsibilityActors: authorization.eligibleTargets,
      reviewState: current?.review.reviewState ?? "not_applicable",
      requiresReview: current?.review.reviewState === "overdue",
      coverageStartedAt: coverage.toISOString(),
      serverTime: now.toISOString(),
    });
  }

  public async saveDraft(input: {
    householdId: string;
    request: SaveCarePlanDraftRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<CarePlanMutationResult> {
    const request = SaveCarePlanDraftRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.care_plan.draft.save",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "care_plan.draft.save", householdId: input.householdId, request }),
    );
    this.requireEligibleResponsibilities(request.responsibilities, authorization);
    const bounds = request.reviewLocalDate
      ? await this.reviewBounds(request.reviewLocalDate, request.reviewTimeZone!)
      : null;
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
      await this.lock(client, authorization.recipientContextId, "care_plan.draft.save", keyDigest);
      const replay = await this.replay(
        client,
        "care_plan.draft.save",
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        await client.query("COMMIT");
        open = false;
        return CarePlanMutationResultSchema.parse(replay.response_body);
      }
      let plan = await this.findPlanWithClient(
        client,
        input.householdId,
        authorization.recipientContextId,
        true,
      );
      if (!plan) {
        if (
          request.expectedAggregateRevision !== 0 ||
          request.expectedDraftRevision !== null ||
          request.baseCurrentVersion !== null
        ) {
          throw versionConflict();
        }
        const now = this.now();
        const planId = this.id("plan");
        await client.query(
          `INSERT INTO care_plans(plan_id, household_id, recipient_context_id, aggregate_revision, current_version, created_at, updated_at)
           VALUES ($1,$2,$3,1,NULL,$4,$4)`,
          [planId, input.householdId, authorization.recipientContextId, now],
        );
        plan = await this.findPlanWithClient(
          client,
          input.householdId,
          authorization.recipientContextId,
          true,
        );
      } else if (
        plan.aggregate_revision !== request.expectedAggregateRevision ||
        plan.current_version !== request.baseCurrentVersion
      ) {
        throw versionConflict();
      }
      const priorDraft = await client.query<DraftRow>(
        `SELECT draft_revision, base_current_version, review_local_date, review_time_zone,
                review_day_start_utc, review_day_end_utc, updated_at
         FROM care_plan_drafts WHERE plan_id=$1 FOR UPDATE`,
        [plan!.plan_id],
      );
      const prior = priorDraft.rows[0];
      if ((prior?.draft_revision ?? null) !== request.expectedDraftRevision)
        throw versionConflict();
      const now = this.now();
      const aggregateRevision =
        plan!.aggregate_revision + (prior ? 1 : plan!.aggregate_revision === 1 ? 0 : 1);
      const draftRevision = (prior?.draft_revision ?? 0) + 1;
      await client.query(
        `INSERT INTO care_plan_drafts(plan_id,draft_revision,base_current_version,review_local_date,review_time_zone,review_day_start_utc,review_day_end_utc,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (plan_id) DO UPDATE SET draft_revision=EXCLUDED.draft_revision,
           base_current_version=EXCLUDED.base_current_version,review_local_date=EXCLUDED.review_local_date,
           review_time_zone=EXCLUDED.review_time_zone,review_day_start_utc=EXCLUDED.review_day_start_utc,
           review_day_end_utc=EXCLUDED.review_day_end_utc,updated_at=EXCLUDED.updated_at`,
        [
          plan!.plan_id,
          draftRevision,
          request.baseCurrentVersion,
          request.reviewLocalDate,
          request.reviewTimeZone,
          bounds?.start ?? null,
          bounds?.end ?? null,
          now,
        ],
      );
      await client.query("DELETE FROM care_plan_draft_items WHERE plan_id=$1", [plan!.plan_id]);
      await this.insertItems(client, "draft", plan!.plan_id, null, request);
      await client.query(
        "UPDATE care_plans SET aggregate_revision=$2,updated_at=$3 WHERE plan_id=$1",
        [plan!.plan_id, aggregateRevision, now],
      );
      await this.transition(
        client,
        plan!.plan_id,
        aggregateRevision,
        "draft_saved",
        authorization.actor.actorId,
        input.correlationId,
        now,
      );
      await this.audit(
        client,
        authorization.actor.actorId,
        input.householdId,
        "care_plan.draft.save",
        plan!.plan_id,
        input.correlationId,
        now,
      );
      const response = CarePlanMutationResultSchema.parse({
        planId: plan!.plan_id,
        aggregateRevision,
        draftRevision,
        planVersion: null,
        outcome: "draft_saved",
        confirmedAt: now.toISOString(),
        review: null,
        eventRef: null,
      });
      await this.writeReplay(
        client,
        "care_plan.draft.save",
        authorization.actor.actorId,
        keyDigest,
        requestHash,
        response,
        now,
      );
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

  public async confirm(input: {
    householdId: string;
    request: ConfirmCarePlanVersionRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<CarePlanMutationResult> {
    const request = ConfirmCarePlanVersionRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.care_plan.version.confirm",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "care_plan.version.confirm",
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
      await this.lock(
        client,
        authorization.recipientContextId,
        "care_plan.version.confirm",
        keyDigest,
      );
      const replay = await this.replay(
        client,
        "care_plan.version.confirm",
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        await client.query("COMMIT");
        open = false;
        return CarePlanMutationResultSchema.parse(replay.response_body);
      }
      const plan = await this.findPlanWithClient(
        client,
        input.householdId,
        authorization.recipientContextId,
        true,
      );
      if (
        !plan ||
        plan.aggregate_revision !== request.expectedAggregateRevision ||
        plan.current_version !== request.baseCurrentVersion
      )
        throw versionConflict();
      const draftResult = await client.query<DraftRow>(
        `SELECT draft_revision,base_current_version,review_local_date,review_time_zone,
                review_day_start_utc,review_day_end_utc,updated_at
         FROM care_plan_drafts WHERE plan_id=$1 FOR UPDATE`,
        [plan.plan_id],
      );
      const draft = draftResult.rows[0];
      if (
        !draft ||
        draft.draft_revision !== request.expectedDraftRevision ||
        draft.base_current_version !== request.baseCurrentVersion
      )
        throw versionConflict();
      const items = await this.items(client, "draft", plan.plan_id, null);
      const goals = items.filter((item) => item.item_type === "goal");
      const responsibilities = items.filter((item) => item.item_type === "responsibility");
      if (
        !goals.length ||
        !responsibilities.length ||
        !draft.review_local_date ||
        !draft.review_time_zone ||
        !draft.review_day_start_utc ||
        !draft.review_day_end_utc
      )
        throw validationFailed();
      this.requireEligibleResponsibilities(
        responsibilities.map((item) => ({ actorRef: item.actor_ref! })),
        authorization,
      );
      const now = this.now();
      const validDate = await client.query<{ valid: boolean }>(
        `SELECT $1::date >= ($2::timestamptz AT TIME ZONE $3)::date AS valid`,
        [formatDate(draft.review_local_date), now, draft.review_time_zone],
      );
      if (!validDate.rows[0]?.valid) throw reviewDateInvalid();
      const planVersion = (plan.current_version ?? 0) + 1;
      const eventRef = this.id("event");
      const changeGroups = await this.changeGroups(
        client,
        plan.plan_id,
        plan.current_version,
        items,
      );
      await client.query(
        `INSERT INTO care_plan_versions(plan_id,plan_version,change_groups,review_local_date,review_time_zone,
          review_day_start_utc,review_day_end_utc,confirmed_at,event_ref)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          plan.plan_id,
          planVersion,
          changeGroups,
          formatDate(draft.review_local_date),
          draft.review_time_zone,
          draft.review_day_start_utc,
          draft.review_day_end_utc,
          now,
          eventRef,
        ],
      );
      await client.query(
        `INSERT INTO care_plan_version_items(plan_id,plan_version,item_type,item_position,category,statement,actor_ref)
         SELECT plan_id,$2,item_type,item_position,category,statement,actor_ref
         FROM care_plan_draft_items WHERE plan_id=$1 ORDER BY item_type,item_position`,
        [plan.plan_id, planVersion],
      );
      await client.query("DELETE FROM care_plan_draft_items WHERE plan_id=$1", [plan.plan_id]);
      await client.query("DELETE FROM care_plan_drafts WHERE plan_id=$1", [plan.plan_id]);
      const aggregateRevision = plan.aggregate_revision + 1;
      await client.query(
        "UPDATE care_plans SET aggregate_revision=$2,current_version=$3,updated_at=$4 WHERE plan_id=$1",
        [plan.plan_id, aggregateRevision, planVersion, now],
      );
      await this.transition(
        client,
        plan.plan_id,
        aggregateRevision,
        "version_confirmed",
        authorization.actor.actorId,
        input.correlationId,
        now,
      );
      await this.audit(
        client,
        authorization.actor.actorId,
        input.householdId,
        "care_plan.version.confirm",
        plan.plan_id,
        input.correlationId,
        now,
      );
      const event = CarePlanVersionConfirmedEventSchema.parse({
        eventId: eventRef,
        eventType: "care.care_plan.version_confirmed.v1",
        eventVersion: 1,
        occurredAt: now.toISOString(),
        producer: "care-coordination",
        aggregateId: plan.plan_id,
        aggregateVersion: planVersion,
        correlationId: input.correlationId,
        causationId: authorization.decisionId,
        payload: { outcome: "confirmed", deliveryDisposition: "none" },
      });
      await client.query(
        `INSERT INTO care_outbox(event_id,event_type,event_version,aggregate_id,aggregate_version,correlation_id,causation_id,payload,occurred_at,status,attempt_count,next_attempt_at,delivered_at)
         VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,'suppressed',0,$8,$8)`,
        [
          event.eventId,
          event.eventType,
          event.aggregateId,
          event.aggregateVersion,
          event.correlationId,
          event.causationId,
          JSON.stringify(event.payload),
          now,
        ],
      );
      const review = reviewFacts(
        {
          review_local_date: draft.review_local_date,
          review_time_zone: draft.review_time_zone,
          review_day_start_utc: draft.review_day_start_utc,
          review_day_end_utc: draft.review_day_end_utc,
        } as {
          review_local_date: string | Date;
          review_time_zone: string;
          review_day_start_utc: Date;
          review_day_end_utc: Date;
        },
        now,
      );
      const response = CarePlanMutationResultSchema.parse({
        planId: plan.plan_id,
        aggregateRevision,
        draftRevision: null,
        planVersion,
        outcome: "confirmed",
        confirmedAt: now.toISOString(),
        review,
        eventRef,
      });
      await this.writeReplay(
        client,
        "care_plan.version.confirm",
        authorization.actor.actorId,
        keyDigest,
        requestHash,
        response,
        now,
      );
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

  public async history(input: {
    householdId: string;
    query: CarePlanHistoryQuery;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<CarePlanHistoryProjection> {
    const query = CarePlanHistoryQuerySchema.parse(input.query);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.care_plan.history.read",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "care_plan.history.read", householdId: input.householdId, query }),
    );
    const coverage = await this.coverage();
    const plan = await this.findPlan(input.householdId, authorization.recipientContextId);
    if (!plan || !plan.current_version)
      return CarePlanHistoryProjectionSchema.parse({
        versions: [],
        nextCursor: null,
        coverageStartedAt: coverage.toISOString(),
      });
    let maxVersion = plan.current_version;
    let beforeVersion = maxVersion + 1;
    if (query.cursor) {
      const cursor = this.openCursor(query.cursor);
      if (!this.cursorMatches(cursor, authorization, input.householdId, query.limit))
        throw cursorInvalid();
      maxVersion = cursor.maxVersion;
      beforeVersion = cursor.lastVersion;
    }
    const rows = await this.pool.query<VersionRow>(
      `SELECT plan_version,change_groups,review_local_date,review_time_zone,review_day_start_utc,
              review_day_end_utc,confirmed_at,event_ref
       FROM care_plan_versions WHERE plan_id=$1 AND plan_version <= $2 AND plan_version < $3
       ORDER BY plan_version DESC LIMIT $4`,
      [plan.plan_id, maxVersion, beforeVersion, query.limit + 1],
    );
    const page = rows.rows.slice(0, query.limit);
    const now = this.now();
    const versions = await Promise.all(
      page.map((row) => this.projectVersionRow(this.pool, plan.plan_id, row, authorization, now)),
    );
    const nextCursor =
      rows.rows.length > query.limit && page.length
        ? this.sealCursor({
            actorId: authorization.actor.actorId,
            householdId: input.householdId,
            recipientContextId: authorization.recipientContextId,
            subjectVersion: authorization.subjectVersion,
            grantVersion: authorization.grantVersion,
            privacyVersion: authorization.privacyVersion,
            maxVersion,
            lastVersion: page.at(-1)!.plan_version,
            limit: query.limit,
            expiresAt: now.getTime() + 15 * 60_000,
          })
        : null;
    return CarePlanHistoryProjectionSchema.parse({
      versions,
      nextCursor,
      coverageStartedAt: coverage.toISOString(),
    });
  }

  public async version(input: {
    householdId: string;
    planVersion: number;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<CarePlanVersionProjection> {
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.care_plan.history.read",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "care_plan.version.read",
        householdId: input.householdId,
        planVersion: input.planVersion,
      }),
    );
    const plan = await this.findPlan(input.householdId, authorization.recipientContextId);
    if (!plan) throw inaccessible();
    const projected = await this.projectVersion(
      this.pool,
      plan.plan_id,
      input.planVersion,
      authorization,
      this.now(),
    );
    if (!projected) throw inaccessible();
    return projected;
  }

  private requireDecision(
    input: CoordinationAuthorizationDecision,
    permission: CoordinationPermission,
    householdId: string,
    correlationId: string,
    requestDigest: string,
  ) {
    const decision = CoordinationAuthorizationDecisionSchema.parse(input);
    const decidedAt = new Date(decision.decidedAt).getTime();
    const now = this.now().getTime();
    if (
      decision.permission !== permission ||
      decision.householdId !== householdId ||
      decision.correlationId !== correlationId ||
      decision.requestDigest !== requestDigest ||
      decidedAt < now - DECISION_MAX_AGE_MS ||
      decidedAt > now + DECISION_FUTURE_TOLERANCE_MS
    )
      throw inaccessible();
    return decision;
  }

  private requireEligibleResponsibilities(
    items: Array<{ actorRef: string }>,
    authorization: CoordinationAuthorizationDecision,
  ) {
    const eligible = new Set(authorization.eligibleTargets.map((actor) => actor.actorRef));
    if (items.some((item) => !eligible.has(item.actorRef))) throw inaccessible();
  }

  private async reviewBounds(localDate: string, timeZone: string) {
    const result = await this.pool.query<{ day_start: Date; day_end: Date }>(
      `SELECT ($1::date::timestamp AT TIME ZONE $2) AS day_start,
              (($1::date + 1)::timestamp AT TIME ZONE $2) AS day_end`,
      [localDate, timeZone],
    );
    const row = result.rows[0];
    if (!row || row.day_end <= row.day_start) throw reviewDateInvalid();
    return { start: row.day_start, end: row.day_end };
  }

  private async coverage() {
    const result = await this.pool.query<{ care_plan_coverage_started_at: Date }>(
      `SELECT care_plan_coverage_started_at FROM care_schema_state
       WHERE service='care-coordination' AND version >= 4`,
    );
    if (!result.rows[0])
      throw new CareError(503, "SERVICE_UNAVAILABLE", "errors.service.unavailable", true);
    return result.rows[0].care_plan_coverage_started_at;
  }

  private async findPlan(householdId: string, recipientContextId: string) {
    const result = await this.pool.query<PlanRow>(
      `SELECT plan_id,household_id,recipient_context_id,aggregate_revision,current_version,created_at,updated_at
       FROM care_plans WHERE household_id=$1 AND recipient_context_id=$2`,
      [householdId, recipientContextId],
    );
    return result.rows[0];
  }

  private async findPlanWithClient(
    client: PoolClient,
    householdId: string,
    recipientContextId: string,
    lock: boolean,
  ) {
    const result = await client.query<PlanRow>(
      `SELECT plan_id,household_id,recipient_context_id,aggregate_revision,current_version,created_at,updated_at
       FROM care_plans WHERE household_id=$1 AND recipient_context_id=$2${lock ? " FOR UPDATE" : ""}`,
      [householdId, recipientContextId],
    );
    return result.rows[0];
  }

  private async projectDraft(
    db: Pool | PoolClient,
    planId: string,
    authorization: CoordinationAuthorizationDecision,
  ) {
    const result = await db.query<DraftRow>(
      `SELECT draft_revision,base_current_version,review_local_date,review_time_zone,
              review_day_start_utc,review_day_end_utc,updated_at
       FROM care_plan_drafts WHERE plan_id=$1`,
      [planId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const items = await this.items(db, "draft", planId, null);
    const eligible = new Set(authorization.eligibleTargets.map((actor) => actor.actorRef));
    const goals = items.filter((item) => item.item_type === "goal").map(itemProjection);
    const preferences = items.filter((item) => item.item_type === "preference").map(itemProjection);
    const responsibilities = items
      .filter((item) => item.item_type === "responsibility")
      .map((item) => ({
        category: item.category,
        statement: item.statement,
        actor: eligible.has(item.actor_ref!)
          ? { state: "eligible" as const, actorRef: item.actor_ref! }
          : { state: "authorization_changed" as const },
      }));
    return {
      draftRevision: row.draft_revision,
      baseCurrentVersion: row.base_current_version,
      goals,
      preferences,
      responsibilities,
      reviewLocalDate: row.review_local_date ? formatDate(row.review_local_date) : null,
      reviewTimeZone: row.review_time_zone,
      reviewDayStartUtc: row.review_day_start_utc?.toISOString() ?? null,
      reviewDayEndUtc: row.review_day_end_utc?.toISOString() ?? null,
      publicationReadiness:
        goals.length && responsibilities.length && row.review_local_date ? "ready" : "incomplete",
      updatedAt: row.updated_at.toISOString(),
    } as const;
  }

  private async projectVersion(
    db: Pool | PoolClient,
    planId: string,
    planVersion: number,
    authorization: CoordinationAuthorizationDecision,
    now: Date,
  ) {
    const result = await db.query<VersionRow>(
      `SELECT plan_version,change_groups,review_local_date,review_time_zone,review_day_start_utc,
              review_day_end_utc,confirmed_at,event_ref
       FROM care_plan_versions WHERE plan_id=$1 AND plan_version=$2`,
      [planId, planVersion],
    );
    return result.rows[0]
      ? this.projectVersionRow(db, planId, result.rows[0], authorization, now)
      : null;
  }

  private async projectVersionRow(
    db: Pool | PoolClient,
    planId: string,
    row: VersionRow,
    authorization: CoordinationAuthorizationDecision,
    now: Date,
  ) {
    const items = await this.items(db, "version", planId, row.plan_version);
    const eligible = new Set(authorization.eligibleTargets.map((actor) => actor.actorRef));
    return CarePlanVersionProjectionSchema.parse({
      planVersion: row.plan_version,
      changeGroups: row.change_groups,
      goals: items.filter((item) => item.item_type === "goal").map(itemProjection),
      preferences: items.filter((item) => item.item_type === "preference").map(itemProjection),
      responsibilities: items
        .filter((item) => item.item_type === "responsibility")
        .map((item) => ({
          category: item.category,
          statement: item.statement,
          actor: eligible.has(item.actor_ref!)
            ? { state: "eligible", actorRef: item.actor_ref }
            : { state: "authorization_changed" },
        })),
      review: reviewFacts(row, now),
      confirmedAt: row.confirmed_at.toISOString(),
      eventRef: row.event_ref,
    });
  }

  private async items(
    db: Pool | PoolClient,
    kind: "draft" | "version",
    planId: string,
    planVersion: number | null,
  ) {
    const table = kind === "draft" ? "care_plan_draft_items" : "care_plan_version_items";
    const versionClause = kind === "version" ? " AND plan_version=$2" : "";
    const result = await db.query<ItemRow>(
      `SELECT item_type,item_position,category,statement,actor_ref FROM ${table}
       WHERE plan_id=$1${versionClause} ORDER BY item_type,item_position`,
      kind === "version" ? [planId, planVersion] : [planId],
    );
    return result.rows;
  }

  private async insertItems(
    client: PoolClient,
    kind: "draft",
    planId: string,
    planVersion: null,
    request: SaveCarePlanDraftRequest,
  ) {
    void kind;
    void planVersion;
    const groups = [
      ["goal", request.goals],
      ["preference", request.preferences],
      ["responsibility", request.responsibilities],
    ] as const;
    for (const [type, values] of groups) {
      for (const [position, value] of values.entries()) {
        await client.query(
          `INSERT INTO care_plan_draft_items(plan_id,item_type,item_position,category,statement,actor_ref)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            planId,
            type,
            position,
            value.category,
            value.statement,
            "actorRef" in value ? value.actorRef : null,
          ],
        );
      }
    }
  }

  private async changeGroups(
    client: PoolClient,
    planId: string,
    currentVersion: number | null,
    next: ItemRow[],
  ) {
    if (!currentVersion) return ["initial"] as const;
    const prior = await this.items(client, "version", planId, currentVersion);
    const groups: CarePlanVersionProjection["changeGroups"] = [];
    for (const [type, group] of [
      ["goal", "goals_changed"],
      ["preference", "preferences_changed"],
      ["responsibility", "responsibilities_changed"],
    ] as const) {
      if (
        JSON.stringify(prior.filter((x) => x.item_type === type)) !==
        JSON.stringify(next.filter((x) => x.item_type === type))
      )
        groups.push(group);
    }
    const priorVersion = await client.query<VersionRow>(
      `SELECT plan_version,change_groups,review_local_date,review_time_zone,review_day_start_utc,review_day_end_utc,confirmed_at,event_ref FROM care_plan_versions WHERE plan_id=$1 AND plan_version=$2`,
      [planId, currentVersion],
    );
    const draft = await client.query<DraftRow>(
      `SELECT draft_revision,base_current_version,review_local_date,review_time_zone,review_day_start_utc,review_day_end_utc,updated_at FROM care_plan_drafts WHERE plan_id=$1`,
      [planId],
    );
    if (
      formatDate(priorVersion.rows[0]!.review_local_date) !==
        formatDate(draft.rows[0]!.review_local_date!) ||
      priorVersion.rows[0]!.review_time_zone !== draft.rows[0]!.review_time_zone
    )
      groups.push("review_date_changed");
    return groups.length ? groups : ["goals_changed"];
  }

  private async lock(
    client: PoolClient,
    recipientContextId: string,
    operation: string,
    keyDigest: string,
  ) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `care-plan:${recipientContextId}`,
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${operation}:${keyDigest}`]);
  }

  private async replay(client: PoolClient, operation: string, actorId: string, keyDigest: string) {
    const result = await client.query<ReplayRow>(
      `SELECT request_hash,response_body FROM care_idempotency WHERE operation=$1 AND actor_id=$2 AND idempotency_key=$3`,
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
      `INSERT INTO care_idempotency(operation,actor_id,idempotency_key,request_hash,response_status,response_body,created_at,expires_at) VALUES ($1,$2,$3,$4,200,$5,$6::timestamptz,$6::timestamptz + INTERVAL '24 hours')`,
      [operation, actorId, keyDigest, requestHash, JSON.stringify(response), now],
    );
  }

  private async transition(
    client: PoolClient,
    planId: string,
    revision: number,
    action: "draft_saved" | "version_confirmed",
    actorId: string,
    correlationId: string,
    now: Date,
  ) {
    await client.query(
      `INSERT INTO care_plan_transitions(transition_id,plan_id,aggregate_revision,action,actor_id,occurred_at,correlation_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [this.id("transition"), planId, revision, action, actorId, now, correlationId],
    );
  }

  private async audit(
    client: PoolClient,
    actorId: string,
    householdId: string,
    action: string,
    planId: string,
    correlationId: string,
    now: Date,
  ) {
    await client.query(
      `INSERT INTO care_audit(audit_id,actor_id,household_id,action,resource_type,resource_id,result,occurred_at,correlation_id,metadata) VALUES ($1,$2,$3,$4,'care_plan',$5,'success',$6,$7,'{}'::jsonb)`,
      [this.id("audit"), actorId, householdId, action, planId, now, correlationId],
    );
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
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
        throw new Error("cursor");
      return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as CursorPayload;
    } catch {
      throw cursorInvalid();
    }
  }

  private cursorMatches(
    cursor: CursorPayload,
    authorization: CoordinationAuthorizationDecision,
    householdId: string,
    limit: number,
  ) {
    return (
      cursor.actorId === authorization.actor.actorId &&
      cursor.householdId === householdId &&
      cursor.recipientContextId === authorization.recipientContextId &&
      cursor.subjectVersion === authorization.subjectVersion &&
      cursor.grantVersion === authorization.grantVersion &&
      cursor.privacyVersion === authorization.privacyVersion &&
      cursor.limit === limit &&
      cursor.expiresAt >= this.now().getTime()
    );
  }
}

function itemProjection(item: ItemRow) {
  return { category: item.category, statement: item.statement };
}

function reviewFacts(
  row: {
    review_local_date: string | Date;
    review_time_zone: string;
    review_day_start_utc: Date;
    review_day_end_utc: Date;
  },
  now: Date,
) {
  const state =
    now < row.review_day_start_utc
      ? "upcoming"
      : now < row.review_day_end_utc
        ? "due_today"
        : "overdue";
  return {
    reviewLocalDate: formatDate(row.review_local_date),
    reviewTimeZone: row.review_time_zone,
    reviewDayStartUtc: row.review_day_start_utc.toISOString(),
    reviewDayEndUtc: row.review_day_end_utc.toISOString(),
    reviewState: state,
  };
}

function formatDate(value: string | Date) {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function digestJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function digestText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function inaccessible() {
  return new CareError(404, "COORDINATION_RESOURCE_NOT_FOUND", "coordination.resource_not_found");
}

function validationFailed() {
  return new CareError(400, "CARE_PLAN_VALIDATION_FAILED", "care_plan.validation");
}

function reviewDateInvalid() {
  return new CareError(400, "CARE_PLAN_REVIEW_DATE_INVALID", "care_plan.review_date_invalid");
}

function versionConflict() {
  return new CareError(
    409,
    "CARE_PLAN_VERSION_CONFLICT",
    "care_plan.version_conflict",
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
    "CARE_PLAN_CURSOR_INVALID",
    "care_plan.cursor_invalid",
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    "reload_current",
  );
}

function idempotencyConflict() {
  return new CareError(409, "IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict");
}
