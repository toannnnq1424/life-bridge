import { createHash, randomUUID } from "node:crypto";

import {
  CareCoordinationEventSchema,
  type CareCoordinationEvent,
  type ConsumerAcknowledgement,
  type Notification,
} from "@lifebridge/contracts";
import { SafeLogger } from "@lifebridge/observability";
import type { Pool, PoolClient, QueryResultRow } from "pg";

interface InboxRow extends QueryResultRow {
  payload_hash: string;
  result:
    | "stored"
    | "suppressed_self"
    | "reminder_scheduled"
    | "reminder_cancelled"
    | "out_of_order_rejected";
  notification_id: string | null;
  processed_at: Date;
}

interface NotificationRow extends QueryResultRow {
  notification_id: string;
  recipient_id: string;
  source_event_id: string;
  source_task_id: string;
  message_key: "notifications.task.completed" | "notifications.task.handed_off";
  message_params: { taskId: string };
  is_read: boolean;
  created_at: Date;
}

export class EventIdReusedError extends Error {
  public constructor() {
    super("EVENT_ID_REUSED");
    this.name = "EventIdReusedError";
  }
}

export class OutOfOrderEventError extends Error {
  public constructor() {
    super("OUT_OF_ORDER_EVENT");
    this.name = "OutOfOrderEventError";
  }
}

function eventHash(event: CareCoordinationEvent): string {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex");
}

function notificationId(): string {
  return `notification_${randomUUID().replaceAll("-", "")}`;
}

function projectNotification(row: NotificationRow): Notification {
  return {
    notificationId: row.notification_id,
    recipientId: row.recipient_id,
    sourceEventId: row.source_event_id,
    sourceTaskId: row.source_task_id,
    messageKey: row.message_key,
    messageParams: row.message_params,
    read: row.is_read,
    createdAt: row.created_at.toISOString(),
  };
}

export class NotificationService {
  public constructor(
    private readonly pool: Pool,
    private readonly now: () => Date = () => new Date(),
    private readonly createNotificationId: () => string = notificationId,
    private readonly logger = new SafeLogger("notification"),
  ) {}

  public async isReady(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1 FROM appointment_reminder_intents LIMIT 0");
      return true;
    } catch {
      return false;
    }
  }

  public async consume(input: unknown): Promise<ConsumerAcknowledgement> {
    const event = CareCoordinationEventSchema.parse(input);
    const hash = eventHash(event);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [event.eventId]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `${event.eventType}:${event.aggregateId}`,
      ]);
      const existing = await client.query<InboxRow>(
        `SELECT payload_hash, result, notification_id, processed_at
         FROM notification_inbox
         WHERE source_event_id = $1`,
        [event.eventId],
      );
      const inbox = existing.rows[0];
      if (inbox) {
        if (inbox.payload_hash !== hash) {
          await client.query("ROLLBACK");
          throw new EventIdReusedError();
        }
        await client.query("COMMIT");
        if (inbox.result === "out_of_order_rejected") throw new OutOfOrderEventError();
        const duplicateResult =
          inbox.result === "stored"
            ? "duplicate"
            : inbox.result === "suppressed_self"
              ? "suppressed_self"
              : "duplicate";
        return {
          eventId: event.eventId,
          result: duplicateResult,
          notificationId: inbox.notification_id,
          processedAt: inbox.processed_at.toISOString(),
        };
      }

      const head = await client.query<{ aggregate_version: number }>(
        `SELECT aggregate_version FROM notification_event_heads
         WHERE aggregate_id=$1 AND event_type=$2`,
        [event.aggregateId, event.eventType],
      );
      if ((head.rows[0]?.aggregate_version ?? 0) > event.aggregateVersion) {
        const processedAt = this.now();
        await client.query(
          `INSERT INTO notification_inbox
            (source_event_id,payload_hash,event_type,event_version,result,notification_id,
             processed_at,aggregate_id,aggregate_version,payload_size)
           VALUES ($1,$2,$3,$4,'out_of_order_rejected',NULL,$5,$6,$7,$8)`,
          [
            event.eventId,
            hash,
            event.eventType,
            event.eventVersion,
            processedAt,
            event.aggregateId,
            event.aggregateVersion,
            Buffer.byteLength(JSON.stringify(event.payload)),
          ],
        );
        await client.query("COMMIT");
        throw new OutOfOrderEventError();
      }

      const processedAt = this.now();
      if (event.eventType === "care.appointment.reminder_intent.v1") {
        const result =
          event.payload.intent === "schedule" ? "reminder_scheduled" : "reminder_cancelled";
        await client.query(
          `INSERT INTO notification_inbox (
            source_event_id, payload_hash, event_type, event_version,
            result, notification_id, processed_at, aggregate_id, aggregate_version, payload_size
          ) VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9)`,
          [
            event.eventId,
            hash,
            event.eventType,
            event.eventVersion,
            result,
            processedAt,
            event.aggregateId,
            event.aggregateVersion,
            Buffer.byteLength(JSON.stringify(event.payload)),
          ],
        );
        await client.query(
          `INSERT INTO appointment_reminder_intents (
            appointment_id, source_event_id, recipient_id, intent_state,
            remind_at_utc, starts_at_utc, message_key, processed_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (appointment_id)
          DO UPDATE SET
            source_event_id = EXCLUDED.source_event_id,
            recipient_id = EXCLUDED.recipient_id,
            intent_state = EXCLUDED.intent_state,
            remind_at_utc = EXCLUDED.remind_at_utc,
            starts_at_utc = EXCLUDED.starts_at_utc,
            message_key = EXCLUDED.message_key,
            processed_at = EXCLUDED.processed_at`,
          [
            event.aggregateId,
            event.eventId,
            event.payload.recipientId,
            event.payload.intent === "schedule" ? "scheduled" : "cancelled",
            event.payload.intent === "schedule" ? event.payload.remindAtUtc : null,
            event.payload.intent === "schedule" ? event.payload.startsAtUtc : null,
            event.payload.messageKey,
            processedAt,
          ],
        );
        await this.recordHead(client, event, processedAt);
        await client.query("COMMIT");
        this.logger.emit({
          level: "info",
          eventName: "appointment.reminder_intent.received",
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
      }

      if (
        event.eventType === "care.task.completed.v1" &&
        event.payload.notificationDisposition === "suppress_self"
      ) {
        await client.query(
          `INSERT INTO notification_inbox (
            source_event_id, payload_hash, event_type, event_version,
            result, notification_id, processed_at, aggregate_id, aggregate_version, payload_size
          ) VALUES ($1,$2,$3,$4,'suppressed_self',NULL,$5,$6,$7,$8)`,
          [
            event.eventId,
            hash,
            event.eventType,
            event.eventVersion,
            processedAt,
            event.aggregateId,
            event.aggregateVersion,
            Buffer.byteLength(JSON.stringify(event.payload)),
          ],
        );
        await this.recordHead(client, event, processedAt);
        await client.query("COMMIT");
        this.logger.emit({
          level: "info",
          eventName: "task.notification.suppressed_self",
          operation: "event.consume",
          result: "success",
          correlationId: event.correlationId,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
        });
        return {
          eventId: event.eventId,
          result: "suppressed_self",
          notificationId: null,
          processedAt: processedAt.toISOString(),
        };
      }

      const id = this.createNotificationId();
      if (!("recipientId" in event.payload)) {
        throw new Error("INVALID_NOTIFICATION_DISPOSITION");
      }
      const recipientId = event.payload.recipientId;
      const messageKey =
        event.eventType === "care.task.handed_off.v1"
          ? "notifications.task.handed_off"
          : "notifications.task.completed";
      await client.query(
        `INSERT INTO notification_inbox (
          source_event_id, payload_hash, event_type, event_version,
          result, notification_id, processed_at, aggregate_id, aggregate_version, payload_size
        ) VALUES ($1,$2,$3,$4,'stored',$5,$6,$7,$8,$9)`,
        [
          event.eventId,
          hash,
          event.eventType,
          event.eventVersion,
          id,
          processedAt,
          event.aggregateId,
          event.aggregateVersion,
          Buffer.byteLength(JSON.stringify(event.payload)),
        ],
      );
      await client.query(
        `INSERT INTO notifications (
          notification_id, recipient_id, source_event_id, source_task_id,
          message_key, message_params, is_read, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,false,$7)`,
        [
          id,
          recipientId,
          event.eventId,
          event.aggregateId,
          messageKey,
          JSON.stringify({ taskId: event.aggregateId }),
          processedAt,
        ],
      );
      await this.recordHead(client, event, processedAt);
      await client.query("COMMIT");
      this.logger.emit({
        level: "info",
        eventName: "task.notification.delivered",
        operation: "event.consume",
        result: "success",
        correlationId: event.correlationId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
      });
      return {
        eventId: event.eventId,
        result: "stored",
        notificationId: id,
        processedAt: processedAt.toISOString(),
      };
    } catch (error) {
      if (!(error instanceof EventIdReusedError) && !(error instanceof OutOfOrderEventError)) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async receiptEvidence(eventId: string): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query<{
      source_event_id: string;
      payload_hash: string;
      event_type: string;
      event_version: number;
      aggregate_id: string | null;
      aggregate_version: number | null;
      result: string;
      notification_id: string | null;
      processed_at: Date;
    }>(
      `SELECT source_event_id,payload_hash,event_type,event_version,aggregate_id,
              aggregate_version,result,notification_id,processed_at
       FROM notification_inbox WHERE source_event_id=$1`,
      [eventId],
    );
    const row = result.rows[0];
    return row
      ? {
          eventId: row.source_event_id,
          payloadDigest: row.payload_hash,
          eventType: row.event_type,
          eventVersion: row.event_version,
          aggregateId: row.aggregate_id,
          aggregateVersion: row.aggregate_version,
          result: row.result,
          durableResult: row.notification_id !== null,
          processedAt: row.processed_at.toISOString(),
        }
      : null;
  }

  private async recordHead(
    client: PoolClient,
    event: CareCoordinationEvent,
    processedAt: Date,
  ): Promise<void> {
    await client.query(
      `INSERT INTO notification_event_heads
        (aggregate_id,event_type,aggregate_version,source_event_id,processed_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (aggregate_id,event_type) DO UPDATE SET
         aggregate_version=EXCLUDED.aggregate_version,
         source_event_id=EXCLUDED.source_event_id,
         processed_at=EXCLUDED.processed_at
       WHERE notification_event_heads.aggregate_version <= EXCLUDED.aggregate_version`,
      [event.aggregateId, event.eventType, event.aggregateVersion, event.eventId, processedAt],
    );
  }

  public async list(recipientId: string): Promise<Notification[]> {
    const result = await this.pool.query<NotificationRow>(
      `SELECT notification_id, recipient_id, source_event_id, source_task_id,
              message_key, message_params, is_read, created_at
       FROM notifications
       WHERE recipient_id = $1
       ORDER BY created_at DESC, notification_id`,
      [recipientId],
    );
    return result.rows.map(projectNotification);
  }

  public async countRows(
    table: "notification_inbox" | "notifications" | "appointment_reminder_intents",
  ): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ${table}`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
