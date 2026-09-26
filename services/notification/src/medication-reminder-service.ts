import { createHash, randomUUID } from "node:crypto";

import {
  AcknowledgeMedicationReminderRequestSchema,
  CoordinationAuthorizationDecisionSchema,
  MedicationReminderAcknowledgementResultSchema,
  MedicationReminderIntentEventSchema,
  MedicationReminderNotificationListSchema,
  MedicationReminderNotificationProjectionSchema,
  MedicationReminderSeenEventSchema,
  type AcknowledgeMedicationReminderRequest,
  type ApiErrorCode,
  type ConsumerAcknowledgement,
  type CoordinationAuthorizationDecision,
  type MedicationReminderAcknowledgementResult,
  type MedicationReminderNotificationList,
  type MedicationReminderNotificationProjection,
  type MedicationReminderSeenEvent,
} from "@lifebridge/contracts";
import { SafeLogger } from "@lifebridge/observability";
import type { Pool, PoolClient, QueryResultRow } from "pg";

const DECISION_MAX_AGE_MS = 10_000;
const DECISION_FUTURE_TOLERANCE_MS = 2_000;
const DELIVERY_WINDOW_MS = 15 * 60_000;

interface Options {
  now?: () => Date;
  id?: (prefix: string) => string;
  logger?: SafeLogger;
  beforeCommit?: (operation: "delivery" | "acknowledgement") => void | Promise<void>;
}

interface InboxRow extends QueryResultRow {
  payload_hash: string;
  result: "medication_reminder_scheduled" | "medication_reminder_cancelled";
  processed_at: Date;
}

interface IdempotencyRow extends QueryResultRow {
  request_hash: string;
  response_body: unknown;
}

interface ProjectionRow extends QueryResultRow {
  occurrence_id: string;
  reminder_id: string;
  household_id: string;
  recipient_context_id: string;
  recipient_id: string;
  occurrence_version: number;
  intent_state: "pending" | "cancelled";
  delivery_state: MedicationReminderNotificationProjection["deliveryState"];
  delivery_evidence: MedicationReminderNotificationProjection["deliveryEvidence"];
  scheduled_at_utc: Date | null;
  source_local_start: string | null;
  source_time_zone: string | null;
  source_utc_offset: string | null;
  message_key: "notifications.medication_reminder.generic";
  attempt_count: number;
  delivered_at: Date | null;
  failed_at: Date | null;
  missed_at: Date | null;
  version: number;
  notification_id: string | null;
  acknowledgement_state: "unacknowledged" | "seen" | null;
  acknowledged_at: Date | null;
}

const projectionSelection = `
  SELECT intent.occurrence_id, intent.reminder_id, intent.household_id,
         intent.recipient_context_id, intent.recipient_id,
         intent.occurrence_version, intent.intent_state, intent.delivery_state,
         intent.delivery_evidence, intent.scheduled_at_utc,
         intent.source_local_start, intent.source_time_zone,
         intent.source_utc_offset, intent.message_key, intent.attempt_count,
         intent.delivered_at, intent.failed_at, intent.missed_at, intent.version,
         notification.notification_id, notification.acknowledgement_state,
         notification.acknowledged_at
  FROM medication_reminder_intents AS intent
  LEFT JOIN medication_reminder_notifications AS notification
    ON notification.occurrence_id = intent.occurrence_id`;

export class NotificationBoundaryError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    public readonly messageKey: string,
    public readonly retryable = false,
  ) {
    super(code);
    this.name = "NotificationBoundaryError";
  }
}

export class MedicationReminderNotificationService {
  private readonly now: () => Date;
  private readonly id: (prefix: string) => string;
  private readonly logger: SafeLogger;
  private readonly beforeCommit?: Options["beforeCommit"];

  public constructor(
    private readonly pool: Pool,
    options: Options = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? ((prefix) => `${prefix}_${randomUUID().replaceAll("-", "")}`);
    this.logger = options.logger ?? new SafeLogger("notification");
    this.beforeCommit = options.beforeCommit;
  }

  public static requestDigest(value: unknown): string {
    return digestJson(value);
  }

  public async isReady(): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `SELECT 1 FROM notification_schema_state
         WHERE service = 'notification' AND version >= 3`,
      );
      await this.pool.query("SELECT 1 FROM medication_reminder_notifications LIMIT 0");
      return result.rows.length === 1;
    } catch {
      return false;
    }
  }

  public async consume(input: unknown): Promise<ConsumerAcknowledgement> {
    const event = MedicationReminderIntentEventSchema.parse(input);
    const hash = digestJson(event);
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [event.eventId]);
      const existing = await client.query<InboxRow>(
        `SELECT payload_hash, result, processed_at
         FROM notification_inbox WHERE source_event_id = $1`,
        [event.eventId],
      );
      const inbox = existing.rows[0];
      if (inbox) {
        if (inbox.payload_hash !== hash) {
          throw new NotificationBoundaryError(
            409,
            "INTERNAL_CONTRACT_INVALID",
            "errors.event.reused",
          );
        }
        await client.query("COMMIT");
        open = false;
        return {
          eventId: event.eventId,
          result: "duplicate",
          notificationId: null,
          processedAt: inbox.processed_at.toISOString(),
        };
      }
      const processedAt = this.now();
      const result =
        event.payload.intent === "schedule"
          ? "medication_reminder_scheduled"
          : "medication_reminder_cancelled";
      await client.query(
        `INSERT INTO notification_inbox (
          source_event_id, payload_hash, event_type, event_version,
          result, notification_id, processed_at
        ) VALUES ($1,$2,$3,$4,$5,NULL,$6)`,
        [event.eventId, hash, event.eventType, event.eventVersion, result, processedAt],
      );
      if (event.payload.intent === "schedule") {
        await client.query(
          `INSERT INTO medication_reminder_intents (
            occurrence_id, reminder_id, household_id, recipient_context_id,
            recipient_id, source_event_id, occurrence_version, intent_state,
            delivery_state, delivery_evidence, scheduled_at_utc,
            source_local_start, source_time_zone, source_utc_offset, message_key,
            attempt_count, delivered_at, failed_at, missed_at, last_failure_reason,
            version, processed_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,'pending','pending','none',$8,$9,$10,$11,$12,
            0,NULL,NULL,NULL,NULL,1,$13,$13
          )
          ON CONFLICT (occurrence_id) DO UPDATE SET
            reminder_id = EXCLUDED.reminder_id,
            household_id = EXCLUDED.household_id,
            recipient_context_id = EXCLUDED.recipient_context_id,
            recipient_id = EXCLUDED.recipient_id,
            source_event_id = EXCLUDED.source_event_id,
            occurrence_version = EXCLUDED.occurrence_version,
            intent_state = 'pending', delivery_state = 'pending',
            delivery_evidence = 'none', scheduled_at_utc = EXCLUDED.scheduled_at_utc,
            source_local_start = EXCLUDED.source_local_start,
            source_time_zone = EXCLUDED.source_time_zone,
            source_utc_offset = EXCLUDED.source_utc_offset,
            message_key = EXCLUDED.message_key, attempt_count = 0,
            delivered_at = NULL, failed_at = NULL, missed_at = NULL,
            last_failure_reason = NULL,
            version = medication_reminder_intents.version + 1,
            processed_at = EXCLUDED.processed_at, updated_at = EXCLUDED.updated_at
          WHERE medication_reminder_intents.occurrence_version <= EXCLUDED.occurrence_version`,
          [
            event.payload.occurrenceId,
            event.payload.reminderId,
            event.payload.householdId,
            event.payload.recipientContextId,
            event.payload.recipientId,
            event.eventId,
            event.payload.occurrenceVersion,
            event.payload.scheduledAtUtc,
            event.payload.sourceLocalStart,
            event.payload.sourceTimeZone,
            event.payload.sourceUtcOffset,
            event.payload.messageKey,
            processedAt,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO medication_reminder_intents (
            occurrence_id, reminder_id, household_id, recipient_context_id,
            recipient_id, source_event_id, occurrence_version, intent_state,
            delivery_state, delivery_evidence, scheduled_at_utc,
            source_local_start, source_time_zone, source_utc_offset, message_key,
            attempt_count, delivered_at, failed_at, missed_at, last_failure_reason,
            version, processed_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,'cancelled','cancelled','none',NULL,NULL,NULL,NULL,$8,
            0,NULL,NULL,NULL,NULL,1,$9,$9
          )
          ON CONFLICT (occurrence_id) DO UPDATE SET
            source_event_id = EXCLUDED.source_event_id,
            occurrence_version = EXCLUDED.occurrence_version,
            intent_state = 'cancelled',
            delivery_state = CASE
              WHEN medication_reminder_intents.delivery_state = 'delivered' THEN 'delivered'
              ELSE 'cancelled'
            END,
            delivery_evidence = CASE
              WHEN medication_reminder_intents.delivery_state = 'delivered' THEN medication_reminder_intents.delivery_evidence
              ELSE 'none'
            END,
            delivered_at = CASE
              WHEN medication_reminder_intents.delivery_state = 'delivered' THEN medication_reminder_intents.delivered_at
              ELSE NULL
            END,
            failed_at = NULL, missed_at = NULL, last_failure_reason = NULL,
            version = medication_reminder_intents.version + 1,
            processed_at = EXCLUDED.processed_at, updated_at = EXCLUDED.updated_at
          WHERE medication_reminder_intents.occurrence_version <= EXCLUDED.occurrence_version`,
          [
            event.payload.occurrenceId,
            event.payload.reminderId,
            event.payload.householdId,
            event.payload.recipientContextId,
            event.payload.recipientId,
            event.eventId,
            event.payload.occurrenceVersion,
            event.payload.messageKey,
            processedAt,
          ],
        );
      }
      await client.query("COMMIT");
      open = false;
      this.logger.emit({
        level: "info",
        eventName: "medication_reminder.intent.received",
        operation: "event.consume",
        result: "success",
        correlationId: event.correlationId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
      });
      return {
        eventId: event.eventId,
        result,
        notificationId: null,
        processedAt: processedAt.toISOString(),
      };
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async processDue(mode: "deliver" | "fail" | "uncertain" = "deliver"): Promise<number> {
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      const now = this.now();
      const due = await client.query<ProjectionRow>(
        `${projectionSelection}
         WHERE intent.intent_state = 'pending'
           AND intent.delivery_state IN ('pending','uncertain')
           AND intent.scheduled_at_utc <= $1
           AND intent.attempt_count < 3
         ORDER BY intent.scheduled_at_utc, intent.occurrence_id
         LIMIT 50
         FOR UPDATE OF intent SKIP LOCKED`,
        [now],
      );
      for (const row of due.rows) {
        const attempt = row.attempt_count + 1;
        const deadline = new Date(row.scheduled_at_utc!.getTime() + DELIVERY_WINDOW_MS);
        const result =
          now > deadline
            ? "missed"
            : mode === "deliver"
              ? "delivered"
              : mode === "fail"
                ? "failed"
                : "uncertain";
        const reason =
          result === "delivered"
            ? "in_app_persisted"
            : result === "missed"
              ? "delivery_window_expired"
              : result === "failed"
                ? "in_app_store_failed"
                : "integration_uncertain";
        await client.query(
          `INSERT INTO medication_delivery_attempts (
            attempt_id, occurrence_id, attempt_number, result, reason_code,
            started_at, completed_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$6)`,
          [this.id("delivery_attempt"), row.occurrence_id, attempt, result, reason, now],
        );
        if (result === "delivered") {
          const notificationId = this.id("medication_notification");
          await client.query(
            `INSERT INTO medication_reminder_notifications (
              notification_id, occurrence_id, recipient_id, message_key,
              delivered_at, acknowledgement_state, acknowledged_at,
              acknowledgement_actor_id
            ) VALUES ($1,$2,$3,$4,$5,'unacknowledged',NULL,NULL)
            ON CONFLICT (occurrence_id) DO NOTHING`,
            [notificationId, row.occurrence_id, row.recipient_id, row.message_key, now],
          );
          await client.query(
            `UPDATE medication_reminder_intents
             SET delivery_state = 'delivered', delivery_evidence = 'in_app_persisted',
                 attempt_count = $2, delivered_at = $3, failed_at = NULL,
                 missed_at = NULL, last_failure_reason = NULL,
                 version = version + 1, updated_at = $3
             WHERE occurrence_id = $1`,
            [row.occurrence_id, attempt, now],
          );
        } else {
          await client.query(
            `UPDATE medication_reminder_intents
             SET delivery_state = $2, delivery_evidence = 'none',
                 attempt_count = $3, delivered_at = NULL,
                 failed_at = CASE
                   WHEN $2::text = 'failed' THEN $4::timestamptz
                   ELSE NULL::timestamptz
                 END,
                 missed_at = CASE
                   WHEN $2::text = 'missed' THEN $4::timestamptz
                   ELSE NULL::timestamptz
                 END,
                 last_failure_reason = CASE
                   WHEN $2::text = 'failed' THEN 'in_app_store_failed'::text
                   WHEN $2::text = 'uncertain' THEN 'integration_uncertain'::text
                   ELSE NULL::text
                 END,
                 version = version + 1, updated_at = $4
             WHERE occurrence_id = $1`,
            [row.occurrence_id, result, attempt, now],
          );
        }
      }
      await this.beforeCommit?.("delivery");
      await client.query("COMMIT");
      open = false;
      if (due.rows.length > 0) {
        this.logger.emit({
          level: "info",
          eventName: "medication_reminder.delivery.processed",
          operation: "delivery.process_due",
          result: "success",
          correlationId: "corr_notification_delivery_processor",
          retryCount: due.rows.length,
        });
      }
      return due.rows.length;
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async list(input: {
    householdId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<MedicationReminderNotificationList> {
    const authorization = this.requireDecision(
      input.authorization,
      "notification.medication_reminder.read",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "medication_notification.list", householdId: input.householdId }),
    );
    const result = await this.pool.query<ProjectionRow>(
      `${projectionSelection}
       WHERE intent.household_id = $1
         AND intent.recipient_context_id = $2
         AND intent.recipient_id = $3
       ORDER BY intent.scheduled_at_utc DESC NULLS LAST, intent.occurrence_id
       LIMIT 50`,
      [input.householdId, authorization.recipientContextId, authorization.actor.actorId],
    );
    return MedicationReminderNotificationListSchema.parse({
      items: result.rows.map(projectNotification),
      snapshotAt: this.now().toISOString(),
    });
  }

  public async acknowledge(input: {
    householdId: string;
    occurrenceId: string;
    request: AcknowledgeMedicationReminderRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<MedicationReminderAcknowledgementResult> {
    const request = AcknowledgeMedicationReminderRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "notification.medication_reminder.acknowledge",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "medication_notification.acknowledge",
        householdId: input.householdId,
        occurrenceId: input.occurrenceId,
        request,
      }),
    );
    const operation = "medication_notification.acknowledge";
    const keyDigest = digestText(input.idempotencyKey);
    const requestHash = digestJson({
      householdId: input.householdId,
      recipientContextId: authorization.recipientContextId,
      occurrenceId: input.occurrenceId,
      request,
    });
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `medication-ack:${input.occurrenceId}`,
      ]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `${operation}:${keyDigest}`,
      ]);
      const replay = await this.readIdempotency(
        client,
        operation,
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        await client.query("COMMIT");
        open = false;
        return MedicationReminderAcknowledgementResultSchema.parse(replay.response_body);
      }
      const row = (
        await client.query<ProjectionRow>(
          `${projectionSelection} WHERE intent.occurrence_id = $1 FOR UPDATE OF intent`,
          [input.occurrenceId],
        )
      ).rows[0];
      if (
        !row ||
        row.household_id !== input.householdId ||
        row.recipient_context_id !== authorization.recipientContextId ||
        row.recipient_id !== authorization.actor.actorId
      ) {
        throw inaccessible();
      }
      if (row.acknowledgement_state === "seen") {
        const duplicate = MedicationReminderAcknowledgementResultSchema.parse({
          result: "duplicate",
          notification: projectNotification(row),
        });
        await this.writeIdempotency(
          client,
          operation,
          authorization.actor.actorId,
          keyDigest,
          requestHash,
          200,
          duplicate,
          this.now(),
        );
        await client.query("COMMIT");
        open = false;
        return duplicate;
      }
      if (row.version !== request.expectedVersion) {
        throw new NotificationBoundaryError(
          409,
          "MEDICATION_ACKNOWLEDGEMENT_VERSION_CONFLICT",
          "medication_notification.version_conflict",
        );
      }
      if (row.delivery_state !== "delivered" || !row.notification_id) {
        throw new NotificationBoundaryError(
          409,
          "MEDICATION_DELIVERY_STATE_CONFLICT",
          "medication_notification.delivery_state_conflict",
        );
      }
      const now = this.now();
      const nextVersion = row.version + 1;
      await client.query(
        `UPDATE medication_reminder_notifications
         SET acknowledgement_state = 'seen', acknowledged_at = $2,
             acknowledgement_actor_id = $3
         WHERE occurrence_id = $1`,
        [input.occurrenceId, now, authorization.actor.actorId],
      );
      await client.query(
        `UPDATE medication_reminder_intents SET version = $2, updated_at = $3
         WHERE occurrence_id = $1`,
        [input.occurrenceId, nextVersion, now],
      );
      const event: MedicationReminderSeenEvent = MedicationReminderSeenEventSchema.parse({
        eventId: this.id("evt"),
        eventType: "notification.medication_reminder.seen.v1",
        eventVersion: 1,
        occurredAt: now.toISOString(),
        producer: "notification",
        aggregateId: input.occurrenceId,
        aggregateVersion: nextVersion,
        correlationId: input.correlationId,
        causationId: this.id("cmd"),
        payload: {
          reminderId: row.reminder_id,
          occurrenceId: input.occurrenceId,
          outcome: "seen",
          acknowledgedAt: now.toISOString(),
        },
      });
      await client.query(
        `INSERT INTO notification_audit (
          audit_id, actor_id, action, resource_type, resource_id,
          resource_version, result, reason_code, decision_id, occurred_at,
          correlation_id
        ) VALUES ($1,$2,'medication_notification.acknowledge',
          'medication_reminder_notification',$3,$4,'success','seen',$5,$6,$7)`,
        [
          this.id("audit"),
          authorization.actor.actorId,
          input.occurrenceId,
          nextVersion,
          authorization.decisionId,
          now,
          input.correlationId,
        ],
      );
      await client.query(
        `INSERT INTO notification_outbox (
          event_id, event_type, event_version, aggregate_id, aggregate_version,
          correlation_id, causation_id, payload, occurred_at, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
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
      const updated = (
        await client.query<ProjectionRow>(
          `${projectionSelection} WHERE intent.occurrence_id = $1`,
          [input.occurrenceId],
        )
      ).rows[0]!;
      const response = MedicationReminderAcknowledgementResultSchema.parse({
        result: "recorded",
        notification: projectNotification(updated),
      });
      await this.writeIdempotency(
        client,
        operation,
        authorization.actor.actorId,
        keyDigest,
        requestHash,
        200,
        response,
        now,
      );
      await this.beforeCommit?.("acknowledgement");
      await client.query("COMMIT");
      open = false;
      this.logger.emit({
        level: "info",
        eventName: "medication_reminder.acknowledged",
        operation,
        result: "success",
        correlationId: input.correlationId,
      });
      return response;
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private requireDecision(
    input: CoordinationAuthorizationDecision,
    permission:
      "notification.medication_reminder.read" | "notification.medication_reminder.acknowledge",
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

  private async readIdempotency(
    client: PoolClient,
    operation: string,
    actorId: string,
    keyDigest: string,
  ): Promise<IdempotencyRow | undefined> {
    const result = await client.query<IdempotencyRow>(
      `SELECT request_hash, response_body FROM notification_idempotency
       WHERE operation = $1 AND actor_id = $2 AND idempotency_key = $3`,
      [operation, actorId, keyDigest],
    );
    return result.rows[0];
  }

  private async writeIdempotency(
    client: PoolClient,
    operation: string,
    actorId: string,
    keyDigest: string,
    requestHash: string,
    status: number,
    response: unknown,
    now: Date,
  ): Promise<void> {
    await client.query(
      `INSERT INTO notification_idempotency (
        operation, actor_id, idempotency_key, request_hash,
        response_status, response_body, created_at, expires_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$7::timestamptz + INTERVAL '24 hours')`,
      [operation, actorId, keyDigest, requestHash, status, JSON.stringify(response), now],
    );
  }
}

function projectNotification(row: ProjectionRow): MedicationReminderNotificationProjection {
  return MedicationReminderNotificationProjectionSchema.parse({
    notificationId: row.notification_id,
    reminderId: row.reminder_id,
    occurrenceId: row.occurrence_id,
    sourceLocalStart: row.source_local_start,
    sourceTimeZone: row.source_time_zone,
    sourceUtcOffset: row.source_utc_offset,
    scheduledAtUtc: row.scheduled_at_utc?.toISOString() ?? null,
    messageKey: row.message_key,
    intentState: row.intent_state,
    deliveryState: row.delivery_state,
    deliveryEvidence: row.delivery_evidence,
    attemptCount: row.attempt_count,
    deliveredAt: row.delivered_at?.toISOString() ?? null,
    failedAt: row.failed_at?.toISOString() ?? null,
    missedAt: row.missed_at?.toISOString() ?? null,
    acknowledgementState: row.acknowledgement_state ?? "unacknowledged",
    acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
    version: row.version,
  });
}

function digestJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function digestText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function inaccessible(): NotificationBoundaryError {
  return new NotificationBoundaryError(
    404,
    "COORDINATION_RESOURCE_NOT_FOUND",
    "coordination.resource_not_found",
  );
}

function idempotencyConflict(): NotificationBoundaryError {
  return new NotificationBoundaryError(409, "IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict");
}
