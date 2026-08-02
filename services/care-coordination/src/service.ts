import { createHash, randomUUID } from "node:crypto";

import {
  CareTaskCompletedEventSchema,
  CareCoordinationEventSchema,
  CreateTaskRequestSchema,
  type CareCoordinationEvent,
  type CompleteTaskRequest,
  type CreateTaskRequest,
  type Member,
  type TaskProjection,
} from "@lifebridge/contracts";
import { SafeLogger } from "@lifebridge/observability";
import { FIXTURE_MEMBERS, fixtureMember } from "@lifebridge/test-fixtures";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { CareError } from "./errors.js";

interface TaskRow extends QueryResultRow {
  task_id: string;
  household_id: string;
  care_recipient_id: string;
  title: string;
  description: string;
  assignee_id: string;
  created_by: string;
  due_at: Date;
  due_time_zone: string;
  priority: "normal" | "important" | "urgent";
  status: "open" | "completed";
  version: number;
  created_at: Date;
  completed_by: string | null;
  completed_at: Date | null;
  outbox_status:
    "pending" | "retrying" | "failed" | "attention_required" | "delivered" | "suppressed" | null;
}

interface IdempotencyRow extends QueryResultRow {
  request_hash: string;
  response_status: number;
  response_body: TaskProjection;
}

interface OutboxRow extends QueryResultRow {
  event_id: string;
  event_type: "care.task.completed.v1" | "care.task.handed_off.v1";
  event_version: 1;
  aggregate_id: string;
  aggregate_version: number;
  correlation_id: string;
  causation_id: string;
  payload: CareCoordinationEvent["payload"];
  occurred_at: Date;
  attempt_count: number;
  claim_token: string | null;
}

export interface ClaimedOutboxEvent {
  event: CareCoordinationEvent;
  attemptCount: number;
  claimToken: string;
}

export interface CareServiceOptions {
  now?: () => Date;
  id?: (prefix: string) => string;
  logger?: SafeLogger;
}

export interface DeliveryEvidence {
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateId: string;
  aggregateVersion: number;
  state: string;
  attemptCount: number;
  lastErrorCode: string | null;
  occurredAt: string;
}

const taskSelection = `
  SELECT task.*,
    (
      SELECT outbox.status
      FROM care_outbox AS outbox
      WHERE outbox.aggregate_id = task.task_id
      ORDER BY outbox.occurred_at DESC, outbox.event_id DESC
      LIMIT 1
    ) AS outbox_status
  FROM care_tasks AS task
`;

function deliveryFromStatus(
  status: TaskRow["outbox_status"],
): TaskProjection["notificationDelivery"] {
  switch (status) {
    case "pending":
      return "pending";
    case "retrying":
      return "retrying";
    case "failed":
    case "attention_required":
      return "failed";
    case "delivered":
      return "delivered";
    case "suppressed":
      return "suppressed";
    default:
      return "not_started";
  }
}

function projectTask(row: TaskRow): TaskProjection {
  return {
    taskId: row.task_id,
    householdId: row.household_id,
    careRecipientId: row.care_recipient_id,
    title: row.title,
    description: row.description,
    assigneeId: row.assignee_id,
    createdBy: row.created_by,
    dueAt: row.due_at.toISOString(),
    dueTimeZone: row.due_time_zone,
    priority: row.priority,
    status: row.status,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    completedBy: row.completed_by,
    completedAt: row.completed_at?.toISOString() ?? null,
    notificationDelivery: deliveryFromStatus(row.outbox_status),
  };
}

function canonicalHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function safeId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export class CareService {
  private readonly now: () => Date;
  private readonly id: (prefix: string) => string;
  private readonly logger: SafeLogger;

  public constructor(
    private readonly pool: Pool,
    options: CareServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? safeId;
    this.logger = options.logger ?? new SafeLogger("care-coordination");
  }

  public listMembers(actorId: string, householdId: string, authorized = false): Member[] {
    if (!authorized) this.assertHouseholdActor(actorId, householdId);
    return FIXTURE_MEMBERS.filter(
      (member) => member.householdId === householdId && member.active,
    ).map((member) => ({ ...member }));
  }

  public async isReady(): Promise<boolean> {
    try {
      const result = await this.pool.query<{ version: number }>(
        `SELECT version FROM care_schema_state
         WHERE service = 'care-coordination' AND version >= 7`,
      );
      return result.rows.length === 1;
    } catch {
      return false;
    }
  }

  public async listTasks(
    actorId: string,
    householdId: string,
    authorized = false,
  ): Promise<TaskProjection[]> {
    if (!authorized) this.assertHouseholdActor(actorId, householdId);
    const result = await this.pool.query<TaskRow>(
      `${taskSelection}
       WHERE task.household_id = $1
       ORDER BY task.due_at,
         CASE task.priority WHEN 'urgent' THEN 3 WHEN 'important' THEN 2 ELSE 1 END DESC,
         task.created_at, task.task_id`,
      [householdId],
    );
    return result.rows.map(projectTask);
  }

  public async getTask(
    actorId: string,
    taskId: string,
    authorizedHouseholdId?: string,
  ): Promise<TaskProjection> {
    const row = await this.findTask(taskId);
    if (
      !row ||
      (authorizedHouseholdId
        ? row.household_id !== authorizedHouseholdId
        : !this.canSee(actorId, row.household_id))
    ) {
      throw new CareError(404, "TASK_NOT_FOUND", "errors.task.notFound");
    }
    return projectTask(row);
  }

  public async createTask(input: {
    actorId: string;
    householdId: string;
    idempotencyKey: string;
    correlationId: string;
    request: CreateTaskRequest;
    authorizedActorIds?: readonly string[];
  }): Promise<{ task: TaskProjection; statusCode: number }> {
    const request = CreateTaskRequestSchema.parse(input.request);
    if (input.authorizedActorIds) {
      if (!input.authorizedActorIds.includes(request.assigneeId)) {
        throw new CareError(404, "TASK_NOT_FOUND", "errors.task.notFound");
      }
    } else {
      this.assertCreatePermission(input.actorId, input.householdId, request.assigneeId);
    }
    const requestHash = canonicalHash(request);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await this.lockIdempotency(client, "task.create", input.actorId, input.idempotencyKey);
      const replay = await this.readIdempotency(
        client,
        "task.create",
        input.actorId,
        input.idempotencyKey,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) {
          await client.query("ROLLBACK");
          throw new CareError(409, "IDEMPOTENCY_KEY_REUSED", "errors.idempotency.reused");
        }
        await client.query("COMMIT");
        return { task: replay.response_body, statusCode: replay.response_status };
      }

      const now = this.now();
      const task: TaskProjection = {
        taskId: this.id("task"),
        householdId: input.householdId,
        careRecipientId: request.careRecipientId,
        title: request.title,
        description: request.description,
        assigneeId: request.assigneeId,
        createdBy: input.actorId,
        dueAt: new Date(request.dueAt).toISOString(),
        dueTimeZone: request.dueTimeZone,
        priority: request.priority,
        status: "open",
        version: 1,
        createdAt: now.toISOString(),
        completedBy: null,
        completedAt: null,
        notificationDelivery: "not_started",
      };

      await client.query(
        `INSERT INTO care_tasks (
          task_id, household_id, care_recipient_id, title, description,
          assignee_id, created_by, due_at, due_time_zone, priority,
          status, version, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open',1,$11)`,
        [
          task.taskId,
          task.householdId,
          task.careRecipientId,
          task.title,
          task.description,
          task.assigneeId,
          task.createdBy,
          task.dueAt,
          task.dueTimeZone,
          task.priority,
          task.createdAt,
        ],
      );
      await client.query(
        `INSERT INTO care_timeline_events (
          event_ref, household_id, recipient_context_id, task_id, task_version,
          event_kind, actor_id, actor_ref, occurred_at, recorded_at
        ) VALUES ($1,$2,$3,$4,1,'task_created',$5,$5,$6,$6)`,
        [
          this.id("timeline"),
          task.householdId,
          task.careRecipientId,
          task.taskId,
          input.actorId,
          now,
        ],
      );
      await this.writeAudit(client, {
        actorId: input.actorId,
        householdId: input.householdId,
        action: "task.create",
        resourceId: task.taskId,
        result: "success",
        correlationId: input.correlationId,
        now,
      });
      await this.writeIdempotency(client, {
        operation: "task.create",
        actorId: input.actorId,
        key: input.idempotencyKey,
        requestHash,
        statusCode: 201,
        response: task,
        now,
      });
      await client.query("COMMIT");
      this.logger.emit({
        level: "info",
        eventName: "task.create",
        operation: "create",
        result: "success",
        correlationId: input.correlationId,
        actorId: input.actorId,
        householdId: input.householdId,
        resourceId: task.taskId,
      });
      return { task, statusCode: 201 };
    } catch (error) {
      if (!(error instanceof CareError)) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async completeTask(input: {
    actorId: string;
    taskId: string;
    idempotencyKey: string;
    correlationId: string;
    request: CompleteTaskRequest;
    authorizedHouseholdId?: string;
  }): Promise<TaskProjection> {
    const requestHash = canonicalHash(input.request);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await this.lockIdempotency(client, "task.complete", input.actorId, input.idempotencyKey);
      const replay = await this.readIdempotency(
        client,
        "task.complete",
        input.actorId,
        input.idempotencyKey,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) {
          await client.query("ROLLBACK");
          throw new CareError(409, "IDEMPOTENCY_KEY_REUSED", "errors.idempotency.reused");
        }
        await client.query("COMMIT");
        return replay.response_body;
      }

      const result = await client.query<TaskRow>(
        `${taskSelection} WHERE task.task_id = $1 FOR UPDATE OF task`,
        [input.taskId],
      );
      const row = result.rows[0];
      if (
        !row ||
        (input.authorizedHouseholdId
          ? row.household_id !== input.authorizedHouseholdId
          : !this.canSee(input.actorId, row.household_id)) ||
        row.assignee_id !== input.actorId
      ) {
        if (row) {
          await this.writeAudit(client, {
            actorId: input.actorId,
            householdId: row.household_id,
            action: "task.complete.denied",
            resourceId: input.taskId,
            result: "denied",
            correlationId: input.correlationId,
            now: this.now(),
          });
          await client.query("COMMIT");
        } else {
          await client.query("ROLLBACK");
        }
        this.logger.emit({
          level: "warn",
          eventName: "task.complete.denied",
          operation: "complete",
          result: "denied",
          correlationId: input.correlationId,
          actorId: input.actorId,
          ...(row
            ? {
                householdId: row.household_id,
                resourceId: row.task_id,
              }
            : {}),
        });
        throw new CareError(404, "TASK_NOT_FOUND", "errors.task.notFound");
      }

      if (row.status === "completed") {
        const current = projectTask(row);
        await this.writeIdempotency(client, {
          operation: "task.complete",
          actorId: input.actorId,
          key: input.idempotencyKey,
          requestHash,
          statusCode: 200,
          response: current,
          now: this.now(),
        });
        await client.query("COMMIT");
        return current;
      }

      if (row.version !== input.request.expectedVersion) {
        const current = projectTask(row);
        await this.writeAudit(client, {
          actorId: input.actorId,
          householdId: row.household_id,
          action: "task.complete.conflict",
          resourceId: input.taskId,
          result: "conflict",
          correlationId: input.correlationId,
          now: this.now(),
        });
        await client.query("COMMIT");
        this.logger.emit({
          level: "warn",
          eventName: "task.complete.conflict",
          operation: "complete",
          result: "conflict",
          correlationId: input.correlationId,
          actorId: input.actorId,
          householdId: row.household_id,
          resourceId: row.task_id,
        });
        throw new CareError(
          409,
          "TASK_VERSION_CONFLICT",
          "errors.task.conflict",
          false,
          undefined,
          current,
        );
      }

      const now = this.now();
      const nextVersion = row.version + 1;
      const eventId = this.id("evt");
      const commandId = this.id("cmd");
      const event = CareTaskCompletedEventSchema.parse({
        eventId,
        eventType: "care.task.completed.v1",
        eventVersion: 1,
        occurredAt: now.toISOString(),
        producer: "care-coordination",
        aggregateId: row.task_id,
        aggregateVersion: nextVersion,
        correlationId: input.correlationId,
        causationId: commandId,
        payload:
          row.created_by === input.actorId
            ? {
                householdId: row.household_id,
                notificationDisposition: "suppress_self",
                completedBy: input.actorId,
                completedAt: now.toISOString(),
              }
            : {
                householdId: row.household_id,
                notificationDisposition: "deliver",
                recipientId: row.created_by,
                completedBy: input.actorId,
                completedAt: now.toISOString(),
              },
      });

      await client.query(
        `UPDATE care_tasks
         SET status = 'completed', version = $2, completed_by = $3, completed_at = $4
         WHERE task_id = $1`,
        [row.task_id, nextVersion, input.actorId, now],
      );
      await client.query(
        `INSERT INTO care_timeline_events (
          event_ref, household_id, recipient_context_id, task_id, task_version,
          event_kind, actor_id, actor_ref, occurred_at, recorded_at
        ) VALUES ($1,$2,$3,$4,$5,'task_completed',$6,$6,$7,$7)`,
        [
          event.eventId,
          row.household_id,
          row.care_recipient_id,
          row.task_id,
          nextVersion,
          input.actorId,
          now,
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
      await this.writeAudit(client, {
        actorId: input.actorId,
        householdId: row.household_id,
        action: "task.complete",
        resourceId: row.task_id,
        result: "success",
        correlationId: input.correlationId,
        now,
      });

      const completed: TaskProjection = {
        ...projectTask(row),
        status: "completed",
        version: nextVersion,
        completedBy: input.actorId,
        completedAt: now.toISOString(),
        notificationDelivery: "pending",
      };
      await this.writeIdempotency(client, {
        operation: "task.complete",
        actorId: input.actorId,
        key: input.idempotencyKey,
        requestHash,
        statusCode: 200,
        response: completed,
        now,
      });
      await client.query("COMMIT");
      this.logger.emit({
        level: "info",
        eventName: "task.complete",
        operation: "complete",
        result: "success",
        correlationId: input.correlationId,
        actorId: input.actorId,
        householdId: row.household_id,
        resourceId: row.task_id,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
      });
      this.logger.emit({
        level: "info",
        eventName: "task.notification.pending",
        operation: "outbox.append",
        result: "pending",
        correlationId: input.correlationId,
        householdId: row.household_id,
        resourceId: row.task_id,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
      });
      return completed;
    } catch (error) {
      if (!(error instanceof CareError)) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async claimOutbox(): Promise<ClaimedOutboxEvent | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE care_outbox
         SET status='attention_required',terminal_at=$1,
             last_error_code=COALESCE(last_error_code,'CLAIM_LEASE_EXHAUSTED')
         WHERE status='retrying' AND attempt_count >= max_attempts
           AND lease_expires_at <= $1`,
        [this.now()],
      );
      const result = await client.query<OutboxRow>(
        `SELECT event_id, event_type, event_version, aggregate_id,
                aggregate_version, correlation_id, causation_id, payload,
                occurred_at, attempt_count, claim_token
         FROM care_outbox
         WHERE status IN ('pending', 'retrying')
           AND next_attempt_at <= $1
           AND attempt_count < max_attempts
           AND NOT EXISTS (
             SELECT 1 FROM care_outbox earlier
             WHERE earlier.aggregate_id = care_outbox.aggregate_id
               AND earlier.aggregate_version < care_outbox.aggregate_version
               AND earlier.status IN ('pending', 'retrying')
           )
         ORDER BY occurred_at, event_id
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [this.now()],
      );
      const row = result.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return null;
      }
      const attemptCount = row.attempt_count + 1;
      const claimToken = `claim_${randomUUID().replaceAll("-", "")}`;
      await client.query(
        `UPDATE care_outbox
         SET status = 'retrying', attempt_count = $2, next_attempt_at = $3,
             claim_token = $4, lease_expires_at = $3
         WHERE event_id = $1`,
        [row.event_id, attemptCount, new Date(this.now().getTime() + 5_000), claimToken],
      );
      await client.query(
        `INSERT INTO care_delivery_attempts
           (event_id, attempt_number, claim_token, started_at)
         VALUES ($1,$2,$3,$4)`,
        [row.event_id, attemptCount, claimToken, this.now()],
      );
      await client.query("COMMIT");
      return {
        event: CareCoordinationEventSchema.parse({
          eventId: row.event_id,
          eventType: row.event_type,
          eventVersion: row.event_version,
          occurredAt: row.occurred_at.toISOString(),
          producer: "care-coordination",
          aggregateId: row.aggregate_id,
          aggregateVersion: row.aggregate_version,
          correlationId: row.correlation_id,
          causationId: row.causation_id,
          payload: row.payload,
        }),
        attemptCount,
        claimToken,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async markOutboxAcknowledged(
    eventId: string,
    claimToken: string,
    result:
      | "stored"
      | "duplicate"
      | "suppressed_self"
      | "reminder_scheduled"
      | "reminder_cancelled"
      | "medication_reminder_scheduled"
      | "medication_reminder_cancelled",
  ): Promise<boolean> {
    const updated = await this.pool.query(
      `WITH changed AS (
         UPDATE care_outbox
       SET status = $2, delivered_at = $3, last_error_code = NULL
       WHERE event_id = $1 AND status = 'retrying' AND claim_token = $4
       RETURNING event_id
       )
       UPDATE care_delivery_attempts
       SET completed_at=$3, result='acknowledged'
       WHERE event_id=$1 AND claim_token=$4 AND EXISTS (SELECT 1 FROM changed)
       RETURNING event_id`,
      [eventId, result === "suppressed_self" ? "suppressed" : "delivered", this.now(), claimToken],
    );
    return (updated.rowCount ?? 0) === 1;
  }

  public async markOutboxFailed(
    eventId: string,
    claimToken: string,
    errorCode: string,
    attemptCount: number,
    maxAttempts: number,
  ): Promise<boolean> {
    const terminal = attemptCount >= maxAttempts;
    const updated = await this.pool.query(
      `WITH changed AS (
         UPDATE care_outbox
       SET status = $2,
           last_error_code = $3,
           next_attempt_at = $4,
           first_failed_at = COALESCE(first_failed_at,$5),
           last_failed_at = $5,
           terminal_at = CASE WHEN $2 = 'attention_required' THEN $5 ELSE terminal_at END
       WHERE event_id = $1 AND status = 'retrying' AND claim_token = $6
       RETURNING event_id
       )
       UPDATE care_delivery_attempts
       SET completed_at=$5,
           result=CASE WHEN $2='attention_required' THEN 'terminal_failure' ELSE 'retryable_failure' END,
           error_code=$3
       WHERE event_id=$1 AND claim_token=$6 AND EXISTS (SELECT 1 FROM changed)
       RETURNING event_id`,
      [
        eventId,
        terminal ? "attention_required" : "retrying",
        errorCode,
        new Date(this.now().getTime() + 250),
        this.now(),
        claimToken,
      ],
    );
    return (updated.rowCount ?? 0) === 1;
  }

  public async deliveryEvidence(eventId: string): Promise<DeliveryEvidence | null> {
    const result = await this.pool.query<{
      event_id: string;
      event_type: string;
      event_version: number;
      aggregate_id: string;
      aggregate_version: number;
      status: string;
      attempt_count: number;
      last_error_code: string | null;
      occurred_at: Date;
    }>(
      `SELECT event_id,event_type,event_version,aggregate_id,aggregate_version,
              status,attempt_count,last_error_code,occurred_at
       FROM care_outbox WHERE event_id=$1`,
      [eventId],
    );
    const row = result.rows[0];
    return row
      ? {
          eventId: row.event_id,
          eventType: row.event_type,
          eventVersion: row.event_version,
          aggregateId: row.aggregate_id,
          aggregateVersion: row.aggregate_version,
          state: row.status,
          attemptCount: row.attempt_count,
          lastErrorCode: row.last_error_code,
          occurredAt: row.occurred_at.toISOString(),
        }
      : null;
  }

  public async replayEvent(input: {
    eventId: string;
    operatorId: string;
    reasonCode: string;
    correlationId: string;
    dryRun: boolean;
  }): Promise<{ eventId: string; beforeState: string; afterState: string; result: string }> {
    const client = await this.pool.connect();
    const recoveryId = `recovery_${randomUUID().replaceAll("-", "")}`;
    try {
      await client.query("BEGIN");
      const current = await client.query<{ status: string; attempt_count: number }>(
        `SELECT status,attempt_count FROM care_outbox WHERE event_id=$1 FOR UPDATE`,
        [input.eventId],
      );
      const currentRow = current.rows[0];
      const beforeState = currentRow?.status;
      if (!beforeState) throw new CareError(404, "TASK_NOT_FOUND", "errors.event.notFound", false);
      const eligible = beforeState === "attention_required" && currentRow.attempt_count < 10;
      const afterState = eligible && !input.dryRun ? "pending" : beforeState;
      const result = input.dryRun ? "previewed" : eligible ? "requeued" : "rejected";
      if (eligible && !input.dryRun) {
        await client.query(
          `UPDATE care_outbox SET status='pending',max_attempts=LEAST(10,attempt_count+3),next_attempt_at=$2,
             claim_token=NULL,lease_expires_at=NULL,last_error_code=NULL,terminal_at=NULL
           WHERE event_id=$1 AND status='attention_required'`,
          [input.eventId, this.now()],
        );
      }
      await client.query(
        `INSERT INTO care_event_recovery_audit
          (recovery_id,event_id,operator_id,reason_code,dry_run,before_state,after_state,
           result,correlation_id,occurred_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          recoveryId,
          input.eventId,
          input.operatorId,
          input.reasonCode,
          input.dryRun,
          beforeState,
          afterState,
          result,
          input.correlationId,
          this.now(),
        ],
      );
      await client.query("COMMIT");
      return { eventId: input.eventId, beforeState, afterState, result };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async countRows(
    table:
      "care_tasks" | "care_outbox" | "care_audit" | "care_timeline_events" | "care_task_handoffs",
  ): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ${table}`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private assertHouseholdActor(actorId: string, householdId: string): void {
    const member = fixtureMember(actorId);
    if (!member || !member.active || member.householdId !== householdId) {
      throw new CareError(404, "TASK_NOT_FOUND", "errors.task.notFound");
    }
  }

  private assertCreatePermission(actorId: string, householdId: string, assigneeId: string): void {
    this.assertHouseholdActor(actorId, householdId);
    const actor = fixtureMember(actorId);
    const assignee = fixtureMember(assigneeId);
    if (actor?.role !== "caregiver") {
      throw new CareError(404, "TASK_NOT_FOUND", "errors.task.notFound");
    }
    if (!assignee || !assignee.active || assignee.householdId !== householdId) {
      throw new CareError(400, "TASK_VALIDATION_FAILED", "errors.task.validation", false, {
        assigneeId: "ineligible",
      });
    }
  }

  private canSee(actorId: string, householdId: string): boolean {
    const member = fixtureMember(actorId);
    return Boolean(member?.active && member.householdId === householdId);
  }

  private async findTask(taskId: string): Promise<TaskRow | undefined> {
    const result = await this.pool.query<TaskRow>(`${taskSelection} WHERE task.task_id = $1`, [
      taskId,
    ]);
    return result.rows[0];
  }

  private async lockIdempotency(
    client: PoolClient,
    operation: string,
    actorId: string,
    key: string,
  ): Promise<void> {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${operation}:${actorId}:${key}`,
    ]);
  }

  private async readIdempotency(
    client: PoolClient,
    operation: string,
    actorId: string,
    key: string,
  ): Promise<IdempotencyRow | undefined> {
    const result = await client.query<IdempotencyRow>(
      `SELECT request_hash, response_status, response_body
       FROM care_idempotency
       WHERE operation = $1 AND actor_id = $2 AND idempotency_key = $3`,
      [operation, actorId, key],
    );
    return result.rows[0];
  }

  private async writeIdempotency(
    client: PoolClient,
    input: {
      operation: string;
      actorId: string;
      key: string;
      requestHash: string;
      statusCode: number;
      response: TaskProjection;
      now: Date;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO care_idempotency (
        operation, actor_id, idempotency_key, request_hash,
        response_status, response_body, created_at, expires_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$7::timestamptz + INTERVAL '24 hours')`,
      [
        input.operation,
        input.actorId,
        input.key,
        input.requestHash,
        input.statusCode,
        JSON.stringify(input.response),
        input.now,
      ],
    );
  }

  private async writeAudit(
    client: PoolClient,
    input: {
      actorId: string;
      householdId: string | null;
      action: string;
      resourceId: string;
      result: string;
      correlationId: string;
      now: Date;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO care_audit (
        audit_id, actor_id, household_id, action, resource_type,
        resource_id, result, occurred_at, correlation_id, metadata
      ) VALUES ($1,$2,$3,$4,'care_task',$5,$6,$7,$8,'{}'::jsonb)`,
      [
        this.id("audit"),
        input.actorId,
        input.householdId,
        input.action,
        input.resourceId,
        input.result,
        input.now,
        input.correlationId,
      ],
    );
  }
}
