import { createHash, randomUUID } from "node:crypto";

import {
  CareCoordinationEventSchema,
  type CareCoordinationEvent,
  type ConsumerAcknowledgement,
  type Notification,
} from "@lifebridge/contracts";
import { SafeLogger } from "@lifebridge/observability";
import type { Pool, QueryResultRow } from "pg";

interface InboxRow extends QueryResultRow {
  payload_hash: string;
  result: "stored" | "suppressed_self";
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
      await this.pool.query("SELECT 1");
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
        return {
          eventId: event.eventId,
          result: inbox.result === "stored" ? "duplicate" : "suppressed_self",
          notificationId: inbox.notification_id,
          processedAt: inbox.processed_at.toISOString(),
        };
      }

      const processedAt = this.now();
      if (
        event.eventType === "care.task.completed.v1" &&
        event.payload.notificationDisposition === "suppress_self"
      ) {
        await client.query(
          `INSERT INTO notification_inbox (
            source_event_id, payload_hash, event_type, event_version,
            result, notification_id, processed_at
          ) VALUES ($1,$2,$3,$4,'suppressed_self',NULL,$5)`,
          [event.eventId, hash, event.eventType, event.eventVersion, processedAt],
        );
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
          result, notification_id, processed_at
        ) VALUES ($1,$2,$3,$4,'stored',$5,$6)`,
        [event.eventId, hash, event.eventType, event.eventVersion, id, processedAt],
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
      if (!(error instanceof EventIdReusedError)) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
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

  public async countRows(table: "notification_inbox" | "notifications"): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ${table}`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
