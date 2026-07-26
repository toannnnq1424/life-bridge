import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import {
  CareTaskHandedOffEventSchema,
  CoordinationAuthorizationDecisionSchema,
  DailyTimelineProjectionSchema,
  DailyTimelineQuerySchema,
  HandoffResultProjectionSchema,
  HandoffReviewProjectionSchema,
  HandoffTaskRequestSchema,
  IanaTimeZoneSchema,
  type CoordinationAuthorizationDecision,
  type DailyTimelineProjection,
  type DailyTimelineQuery,
  type HandoffResultProjection,
  type HandoffReviewProjection,
  type HandoffTaskRequest,
} from "@lifebridge/contracts";
import { SafeLogger } from "@lifebridge/observability";
import type { Pool, QueryResultRow } from "pg";

import { CareError } from "./errors.js";

const CURSOR_TTL_MS = 15 * 60_000;
const DECISION_MAX_AGE_MS = 10_000;
const DECISION_FUTURE_TOLERANCE_MS = 2_000;

interface CoordinationServiceOptions {
  cursorKey?: Buffer;
  now?: () => Date;
  id?: (prefix: string) => string;
  logger?: SafeLogger;
}

interface TaskRow extends QueryResultRow {
  task_id: string;
  household_id: string;
  care_recipient_id: string;
  title: string;
  assignee_id: string;
  status: "open" | "completed";
  version: number;
}

interface TimelineRow extends QueryResultRow {
  timeline_sequence: string;
  event_ref: string;
  event_kind: "task_created" | "task_completed" | "task_handoff";
  task_id: string;
  task_title: string;
  actor_ref: string | null;
  from_actor_ref: string | null;
  to_actor_ref: string | null;
  reason_code:
    "availability_changed" | "schedule_conflict" | "coverage_update" | "other_coordination" | null;
  occurred_at: Date;
}

interface HandoffIdempotencyRow extends QueryResultRow {
  request_hash: string;
  response_body: HandoffResultProjection;
  expires_at: Date;
}

interface CursorPayload {
  version: 1;
  actorId: string;
  householdId: string;
  recipientContextId: string;
  subjectVersion: number;
  grantVersion: number | null;
  privacyVersion: number | null;
  localDate: string;
  displayTimeZone: string;
  filter: DailyTimelineQuery["filter"];
  limit: number;
  snapshotSequence: string;
  snapshotAt: string;
  lastOccurredAt: string;
  lastEventRef: string;
  expiresAt: string;
}

export class CoordinationService {
  private readonly cursorKey: Buffer;
  private readonly now: () => Date;
  private readonly id: (prefix: string) => string;
  private readonly logger: SafeLogger;

  public constructor(
    private readonly pool: Pool,
    options: CoordinationServiceOptions = {},
  ) {
    this.cursorKey = options.cursorKey ?? randomBytes(32);
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? ((prefix) => `${prefix}_${randomUUID().replaceAll("-", "")}`);
    this.logger = options.logger ?? new SafeLogger("care-coordination");
  }

  public async dailyTimeline(input: {
    householdId: string;
    query: DailyTimelineQuery;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<DailyTimelineProjection> {
    const query = DailyTimelineQuerySchema.parse(input.query);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.timeline.read",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "timeline.read",
        householdId: input.householdId,
        query,
      }),
    );
    const bounds = await this.dayBounds(query.localDate, query.displayTimeZone);
    const coverageResult = await this.pool.query<{ coverage_started_at: Date }>(
      `SELECT coverage_started_at
       FROM care_schema_state
       WHERE service = 'care-coordination' AND version >= 2`,
    );
    const coverageStartedAt = coverageResult.rows[0]?.coverage_started_at;
    if (!coverageStartedAt) {
      throw unavailable();
    }

    const continuation = query.cursor ? this.openCursor(query.cursor, query, authorization) : null;
    const snapshot =
      continuation ??
      (await this.newSnapshot(
        input.householdId,
        authorization.recipientContextId,
        query,
        authorization,
      ));
    const values: unknown[] = [
      input.householdId,
      authorization.recipientContextId,
      bounds.start,
      bounds.end,
      snapshot.snapshotSequence,
    ];
    const where = [
      "timeline.household_id = $1",
      "timeline.recipient_context_id = $2",
      "timeline.occurred_at >= $3",
      "timeline.occurred_at < $4",
      "timeline.timeline_sequence <= $5",
    ];
    if (query.filter !== "all") {
      values.push(query.filter);
      where.push(`timeline.event_kind = $${values.length}`);
    }
    if (snapshot.lastOccurredAt && snapshot.lastEventRef) {
      values.push(snapshot.lastOccurredAt, snapshot.lastEventRef);
      where.push(
        `(timeline.occurred_at, timeline.event_ref) >
         ($${values.length - 1}::timestamptz, $${values.length})`,
      );
    }
    values.push(query.limit + 1);
    const result = await this.pool.query<TimelineRow>(
      `SELECT timeline.timeline_sequence, timeline.event_ref, timeline.event_kind,
              timeline.task_id, task.title AS task_title, timeline.actor_ref,
              timeline.from_actor_ref, timeline.to_actor_ref,
              timeline.reason_code, timeline.occurred_at
       FROM care_timeline_events AS timeline
       JOIN care_tasks AS task ON task.task_id = timeline.task_id
       WHERE ${where.join(" AND ")}
       ORDER BY timeline.occurred_at, timeline.event_ref
       LIMIT $${values.length}`,
      values,
    );
    const hasNext = result.rows.length > query.limit;
    const rows = result.rows.slice(0, query.limit);
    const last = rows.at(-1);
    const nextCursor =
      hasNext && last
        ? this.sealCursor({
            ...snapshot,
            version: 1,
            actorId: authorization.actor.actorId,
            householdId: input.householdId,
            recipientContextId: authorization.recipientContextId,
            subjectVersion: authorization.subjectVersion,
            grantVersion: authorization.grantVersion,
            privacyVersion: authorization.privacyVersion,
            localDate: query.localDate,
            displayTimeZone: query.displayTimeZone,
            filter: query.filter,
            limit: query.limit,
            lastOccurredAt: last.occurred_at.toISOString(),
            lastEventRef: last.event_ref,
            expiresAt: new Date(this.now().getTime() + CURSOR_TTL_MS).toISOString(),
          })
        : null;

    return DailyTimelineProjectionSchema.parse({
      localDate: query.localDate,
      displayTimeZone: query.displayTimeZone,
      dayStartUtc: bounds.start.toISOString(),
      dayEndUtc: bounds.end.toISOString(),
      filter: query.filter,
      snapshotAt: snapshot.snapshotAt,
      coverageStartedAt: coverageStartedAt.toISOString(),
      coverage: bounds.start >= coverageStartedAt ? "complete" : "history_unavailable",
      items: rows.map((row) => ({
        eventRef: row.event_ref,
        kind: row.event_kind,
        taskId: row.task_id,
        taskTitle: row.task_title,
        actor: row.actor_ref ? this.publicActor(row.actor_ref, authorization) : null,
        fromActor: row.from_actor_ref ? this.publicActor(row.from_actor_ref, authorization) : null,
        toActor: row.to_actor_ref ? this.publicActor(row.to_actor_ref, authorization) : null,
        reasonCode: row.reason_code,
        occurredAt: row.occurred_at.toISOString(),
        outcome: "confirmed",
      })),
      nextCursor,
    });
  }

  public async handoffReview(input: {
    householdId: string;
    taskId: string;
    displayTimeZone: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<HandoffReviewProjection> {
    const displayTimeZone = IanaTimeZoneSchema.parse(input.displayTimeZone);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.task.handoff",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "handoff.review",
        householdId: input.householdId,
        taskId: input.taskId,
        displayTimeZone,
      }),
    );
    const task = await this.findTask(input.taskId);
    if (
      !task ||
      task.household_id !== input.householdId ||
      task.care_recipient_id !== authorization.recipientContextId ||
      task.assignee_id !== authorization.actor.actorId
    ) {
      throw inaccessible();
    }
    return HandoffReviewProjectionSchema.parse({
      taskId: task.task_id,
      taskTitle: task.title,
      taskStatus: task.status,
      taskVersion: task.version,
      currentActor: this.publicActor(authorization.actor.actorRef, authorization),
      eligibleTargets:
        task.status === "open"
          ? authorization.eligibleTargets.map((actor) =>
              this.publicActor(actor.actorRef, authorization, actor.subject),
            )
          : [],
      effectiveMode: "immediate",
      displayTimeZone,
      serverTime: this.now().toISOString(),
    });
  }

  public async handoff(input: {
    householdId: string;
    taskId: string;
    request: HandoffTaskRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<HandoffResultProjection> {
    const request = HandoffTaskRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.task.handoff",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "task.handoff",
        householdId: input.householdId,
        taskId: input.taskId,
        request,
      }),
    );
    if (
      !authorization.target ||
      authorization.target.actorRef !== request.toActorRef ||
      authorization.actor.actorRef !== request.expectedFromActorRef
    ) {
      throw inaccessible();
    }

    const keyDigest = digestText(input.idempotencyKey);
    const requestHash = digestJson({
      householdId: input.householdId,
      taskId: input.taskId,
      actorId: authorization.actor.actorId,
      targetActorId: authorization.target.actorId,
      request,
    });
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        `task.handoff:${authorization.actor.actorId}:${keyDigest}`,
      ]);
      const replay = await client.query<HandoffIdempotencyRow>(
        `SELECT request_hash, response_body, expires_at
         FROM care_idempotency
         WHERE operation = 'task.handoff'
           AND actor_id = $1
           AND idempotency_key = $2`,
        [authorization.actor.actorId, keyDigest],
      );
      const existing = replay.rows[0];
      if (existing && existing.expires_at > this.now()) {
        if (existing.request_hash !== requestHash) {
          throw new CareError(409, "IDEMPOTENCY_CONFLICT", "handoff.idempotency_conflict");
        }
        await client.query("COMMIT");
        transactionOpen = false;
        return HandoffResultProjectionSchema.parse(existing.response_body);
      }
      if (existing) {
        await client.query(
          `DELETE FROM care_idempotency
           WHERE operation = 'task.handoff' AND actor_id = $1 AND idempotency_key = $2`,
          [authorization.actor.actorId, keyDigest],
        );
      }

      const taskResult = await client.query<TaskRow>(
        `SELECT task_id, household_id, care_recipient_id, title,
                assignee_id, status, version
         FROM care_tasks
         WHERE task_id = $1
         FOR UPDATE`,
        [input.taskId],
      );
      const task = taskResult.rows[0];
      if (
        !task ||
        task.household_id !== input.householdId ||
        task.care_recipient_id !== authorization.recipientContextId ||
        task.assignee_id !== authorization.actor.actorId
      ) {
        throw inaccessible();
      }
      if (task.status !== "open") {
        throw new CareError(409, "HANDOFF_STATE_CONFLICT", "handoff.state_conflict");
      }
      if (task.version !== request.expectedTaskVersion) {
        throw new CareError(409, "HANDOFF_VERSION_CONFLICT", "handoff.version_conflict");
      }

      const now = this.now();
      const nextVersion = task.version + 1;
      const eventId = this.id("event");
      const handoffId = this.id("handoff");
      const commandId = this.id("command");
      const event = CareTaskHandedOffEventSchema.parse({
        eventId,
        eventType: "care.task.handed_off.v1",
        eventVersion: 1,
        occurredAt: now.toISOString(),
        producer: "care-coordination",
        aggregateId: task.task_id,
        aggregateVersion: nextVersion,
        correlationId: input.correlationId,
        causationId: commandId,
        payload: {
          householdId: task.household_id,
          recipientContextId: task.care_recipient_id,
          fromActorId: authorization.actor.actorId,
          toActorId: authorization.target.actorId,
          reasonCode: request.reasonCode,
          outcome: "accepted",
          effectiveAt: now.toISOString(),
          notificationDisposition: "deliver",
          recipientId: authorization.target.actorId,
        },
      });
      await client.query(
        `UPDATE care_tasks
         SET assignee_id = $2, version = $3
         WHERE task_id = $1`,
        [task.task_id, authorization.target.actorId, nextVersion],
      );
      await client.query(
        `INSERT INTO care_timeline_events (
          event_ref, household_id, recipient_context_id, task_id, task_version,
          event_kind, from_actor_id, from_actor_ref, to_actor_id, to_actor_ref,
          reason_code, occurred_at, recorded_at
        ) VALUES ($1,$2,$3,$4,$5,'task_handoff',$6,$7,$8,$9,$10,$11,$11)`,
        [
          event.eventId,
          task.household_id,
          task.care_recipient_id,
          task.task_id,
          nextVersion,
          authorization.actor.actorId,
          authorization.actor.actorRef,
          authorization.target.actorId,
          authorization.target.actorRef,
          request.reasonCode,
          now,
        ],
      );
      await client.query(
        `INSERT INTO care_task_handoffs (
          handoff_id, event_ref, household_id, recipient_context_id, task_id,
          task_version, from_actor_id, from_actor_ref, to_actor_id, to_actor_ref,
          reason_code, outcome, occurred_at, effective_at, correlation_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'accepted',$12,$12,$13)`,
        [
          handoffId,
          event.eventId,
          task.household_id,
          task.care_recipient_id,
          task.task_id,
          nextVersion,
          authorization.actor.actorId,
          authorization.actor.actorRef,
          authorization.target.actorId,
          authorization.target.actorRef,
          request.reasonCode,
          now,
          input.correlationId,
        ],
      );
      await client.query(
        `INSERT INTO care_outbox (
          event_id, event_type, event_version, aggregate_id, aggregate_version,
          correlation_id, causation_id, payload, occurred_at, status, next_attempt_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$9)`,
        [
          event.eventId,
          event.eventType,
          event.eventVersion,
          event.aggregateId,
          event.aggregateVersion,
          event.correlationId,
          event.causationId,
          JSON.stringify(event.payload),
          event.occurredAt,
        ],
      );
      await client.query(
        `INSERT INTO care_audit (
          audit_id, actor_id, household_id, action, resource_type,
          resource_id, result, occurred_at, correlation_id, metadata
        ) VALUES ($1,$2,$3,'task.handoff','care_task',$4,'success',$5,$6,'{}'::jsonb)`,
        [
          this.id("audit"),
          authorization.actor.actorId,
          task.household_id,
          task.task_id,
          now,
          input.correlationId,
        ],
      );
      const response = HandoffResultProjectionSchema.parse({
        taskId: task.task_id,
        taskVersion: nextVersion,
        currentActor: this.publicActor(
          authorization.target.actorRef,
          authorization,
          authorization.target.subject,
        ),
        fromActor: this.publicActor(
          authorization.actor.actorRef,
          authorization,
          authorization.actor.subject,
        ),
        reasonCode: request.reasonCode,
        occurredAt: now.toISOString(),
        effectiveAt: now.toISOString(),
        eventRef: event.eventId,
        outcome: "accepted",
        notificationDelivery: "pending",
      });
      await client.query(
        `INSERT INTO care_idempotency (
          operation, actor_id, idempotency_key, request_hash,
          response_status, response_body, created_at, expires_at
        ) VALUES (
          'task.handoff',$1,$2,$3,200,$4,
          $5::timestamptz,$5::timestamptz + INTERVAL '24 hours'
        )`,
        [authorization.actor.actorId, keyDigest, requestHash, JSON.stringify(response), now],
      );
      await client.query("COMMIT");
      transactionOpen = false;
      this.logger.emit({
        level: "info",
        eventName: "task.handoff",
        operation: "handoff",
        result: "success",
        correlationId: input.correlationId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
      });
      return response;
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async cleanupExpiredIdempotency(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM care_idempotency
       WHERE operation = 'task.handoff' AND expires_at <= $1`,
      [this.now()],
    );
    return result.rowCount ?? 0;
  }

  private requireDecision(
    input: CoordinationAuthorizationDecision,
    permission: CoordinationAuthorizationDecision["permission"],
    householdId: string,
    correlationId: string,
    requestDigest: string,
  ): CoordinationAuthorizationDecision {
    const decision = CoordinationAuthorizationDecisionSchema.parse(input);
    const decidedAt = new Date(decision.decidedAt).getTime();
    const current = this.now().getTime();
    if (
      decision.permission !== permission ||
      decision.householdId !== householdId ||
      decision.correlationId !== correlationId ||
      decision.requestDigest !== requestDigest ||
      decidedAt < current - DECISION_MAX_AGE_MS ||
      decidedAt > current + DECISION_FUTURE_TOLERANCE_MS
    ) {
      throw inaccessible();
    }
    return decision;
  }

  private async dayBounds(
    localDate: string,
    displayTimeZone: string,
  ): Promise<{ start: Date; end: Date }> {
    const result = await this.pool.query<{ day_start: Date; day_end: Date }>(
      `SELECT
         ($1::date::timestamp AT TIME ZONE $2) AS day_start,
         (($1::date + 1)::timestamp AT TIME ZONE $2) AS day_end`,
      [localDate, displayTimeZone],
    );
    const row = result.rows[0];
    if (!row || row.day_end <= row.day_start) {
      throw new CareError(400, "TIMELINE_VALIDATION_FAILED", "timeline.invalid");
    }
    return { start: row.day_start, end: row.day_end };
  }

  private async newSnapshot(
    householdId: string,
    recipientContextId: string,
    query: DailyTimelineQuery,
    authorization: CoordinationAuthorizationDecision,
  ): Promise<
    Pick<CursorPayload, "snapshotSequence" | "snapshotAt" | "lastOccurredAt" | "lastEventRef">
  > {
    const result = await this.pool.query<{ sequence: string }>(
      `SELECT COALESCE(MAX(timeline_sequence), 0)::text AS sequence
       FROM care_timeline_events
       WHERE household_id = $1 AND recipient_context_id = $2`,
      [householdId, recipientContextId],
    );
    void query;
    void authorization;
    return {
      snapshotSequence: result.rows[0]?.sequence ?? "0",
      snapshotAt: this.now().toISOString(),
      lastOccurredAt: "",
      lastEventRef: "",
    };
  }

  private sealCursor(payload: CursorPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = createHmac("sha256", this.cursorKey).update(encoded).digest("base64url");
    return `${encoded}.${signature}`;
  }

  private openCursor(
    cursor: string,
    query: DailyTimelineQuery,
    authorization: CoordinationAuthorizationDecision,
  ): CursorPayload {
    try {
      const [encoded, signature, extra] = cursor.split(".");
      if (!encoded || !signature || extra) throw new Error("cursor_shape");
      const expected = createHmac("sha256", this.cursorKey).update(encoded).digest();
      const actual = Buffer.from(signature, "base64url");
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        throw new Error("cursor_signature");
      }
      const value = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CursorPayload;
      if (
        value.version !== 1 ||
        value.actorId !== authorization.actor.actorId ||
        value.householdId !== authorization.householdId ||
        value.recipientContextId !== authorization.recipientContextId ||
        value.subjectVersion !== authorization.subjectVersion ||
        value.grantVersion !== authorization.grantVersion ||
        value.privacyVersion !== authorization.privacyVersion ||
        value.localDate !== query.localDate ||
        value.displayTimeZone !== query.displayTimeZone ||
        value.filter !== query.filter ||
        value.limit !== query.limit ||
        new Date(value.expiresAt).getTime() <= this.now().getTime()
      ) {
        throw new Error("cursor_scope");
      }
      return value;
    } catch {
      throw new CareError(400, "TIMELINE_CURSOR_INVALID", "timeline.cursor_invalid");
    }
  }

  private publicActor(
    actorRef: string,
    authorization: CoordinationAuthorizationDecision,
    subject?: boolean,
  ) {
    const known = [
      authorization.actor,
      ...(authorization.target ? [authorization.target] : []),
      ...authorization.eligibleTargets,
    ].find((actor) => actor.actorRef === actorRef);
    return {
      actorRef,
      displayKey:
        actorRef === authorization.actor.actorRef
          ? "coordination.actor.you"
          : "coordination.actor.household_member",
      subject: subject ?? known?.subject ?? false,
    } as const;
  }

  private async findTask(taskId: string): Promise<TaskRow | undefined> {
    const result = await this.pool.query<TaskRow>(
      `SELECT task_id, household_id, care_recipient_id, title,
              assignee_id, status, version
       FROM care_tasks
       WHERE task_id = $1`,
      [taskId],
    );
    return result.rows[0];
  }
}

function digestJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function digestText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function inaccessible(): CareError {
  return new CareError(404, "COORDINATION_RESOURCE_NOT_FOUND", "coordination.resource_not_found");
}

function unavailable(): CareError {
  return new CareError(503, "SERVICE_UNAVAILABLE", "errors.service.unavailable", true);
}
