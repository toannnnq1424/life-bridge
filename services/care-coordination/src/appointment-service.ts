import { createHash, randomUUID } from "node:crypto";

import {
  AppointmentProjectionSchema,
  AppointmentReminderIntentEventSchema,
  AppointmentSeriesProjectionSchema,
  CalendarProjectionSchema,
  CalendarQuerySchema,
  CancelAppointmentRequestSchema,
  ChangeAppointmentRequestSchema,
  CoordinationAuthorizationDecisionSchema,
  CreateAppointmentRequestSchema,
  type AppointmentProjection,
  type AppointmentReminderIntentEvent,
  type AppointmentSeriesProjection,
  type CalendarProjection,
  type CalendarQuery,
  type CancelAppointmentRequest,
  type ChangeAppointmentRequest,
  type CoordinationAuthorizationDecision,
  type CoordinationPermission,
  type CreateAppointmentRequest,
} from "@lifebridge/contracts";
import { SafeLogger } from "@lifebridge/observability";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { CareError } from "./errors.js";

const DECISION_MAX_AGE_MS = 10_000;
const DECISION_FUTURE_TOLERANCE_MS = 2_000;

interface AppointmentServiceOptions {
  now?: () => Date;
  id?: (prefix: string) => string;
  logger?: SafeLogger;
}

interface AppointmentRow extends QueryResultRow {
  appointment_id: string;
  series_id: string;
  household_id: string;
  recipient_context_id: string;
  kind: AppointmentProjection["kind"];
  logistics: AppointmentProjection["logistics"];
  status: AppointmentProjection["status"];
  last_change: AppointmentProjection["lastChange"];
  starts_at_utc: Date;
  ends_at_utc: Date;
  source_local_start: string;
  source_utc_offset: string;
  source_time_zone: string;
  duration_minutes: number;
  occurrence_number: number;
  occurrence_count: number;
  recurrence_frequency: "none" | "weekly";
  recurrence_interval_weeks: number | null;
  recurrence_final_local_date: Date | string;
  reminder_intent: AppointmentProjection["reminderIntent"];
  reminder_lead_minutes: 15 | 60 | 1440 | null;
  version: number;
  created_at: Date;
  updated_at: Date;
  cancelled_at: Date | null;
}

interface IdempotencyRow extends QueryResultRow {
  request_hash: string;
  response_body: unknown;
  expires_at: Date;
}

interface ResolvedOccurrence {
  localStart: string;
  startsAt: Date;
  endsAt: Date;
  offset: string;
}

const appointmentSelection = `
  SELECT appointment_id, series_id, household_id, recipient_context_id,
         kind, logistics, status, last_change, starts_at_utc, ends_at_utc,
         source_local_start, source_utc_offset, source_time_zone,
         duration_minutes, occurrence_number, occurrence_count,
         recurrence_frequency, recurrence_interval_weeks,
         recurrence_final_local_date, reminder_intent, reminder_lead_minutes,
         version, created_at, updated_at, cancelled_at
  FROM care_appointments`;

export class AppointmentService {
  private readonly now: () => Date;
  private readonly id: (prefix: string) => string;
  private readonly logger: SafeLogger;

  public constructor(
    private readonly pool: Pool,
    options: AppointmentServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? ((prefix) => `${prefix}_${randomUUID().replaceAll("-", "")}`);
    this.logger = options.logger ?? new SafeLogger("care-coordination");
  }

  public static requestDigest(value: unknown): string {
    return digestJson(value);
  }

  public async calendar(input: {
    householdId: string;
    query: CalendarQuery;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<CalendarProjection> {
    const query = CalendarQuerySchema.parse(input.query);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.calendar.read",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "calendar.read", householdId: input.householdId, query }),
    );
    const bounds = await this.dayBounds(query.localDate, query.displayTimeZone);
    const coverage = await this.pool.query<{ appointment_coverage_started_at: Date }>(
      `SELECT appointment_coverage_started_at
       FROM care_schema_state
       WHERE service = 'care-coordination' AND version >= 3`,
    );
    const coverageStartedAt = coverage.rows[0]?.appointment_coverage_started_at;
    if (!coverageStartedAt) throw unavailable();

    const values: unknown[] = [
      input.householdId,
      authorization.recipientContextId,
      bounds.start,
      bounds.end,
    ];
    const where = [
      "household_id = $1",
      "recipient_context_id = $2",
      "starts_at_utc < $4",
      "ends_at_utc > $3",
    ];
    if (query.filter !== "all") {
      values.push(query.filter);
      where.push(`status = $${values.length}`);
    }
    values.push(101);
    const result = await this.pool.query<AppointmentRow>(
      `${appointmentSelection}
       WHERE ${where.join(" AND ")}
       ORDER BY starts_at_utc, appointment_id
       LIMIT $${values.length}`,
      values,
    );
    if (result.rows.length > 100) {
      throw new CareError(503, "CALENDAR_RANGE_TOO_DENSE", "calendar.range_too_dense", false);
    }
    const snapshotAt = this.now();
    return CalendarProjectionSchema.parse({
      localDate: query.localDate,
      displayTimeZone: query.displayTimeZone,
      dayStartUtc: bounds.start.toISOString(),
      dayEndUtc: bounds.end.toISOString(),
      filter: query.filter,
      coverageStartedAt: coverageStartedAt.toISOString(),
      coverage: bounds.start >= coverageStartedAt ? "complete" : "history_unavailable",
      items: result.rows.map((row) => projectAppointment(row, snapshotAt)),
      snapshotAt: snapshotAt.toISOString(),
    });
  }

  public async get(input: {
    householdId: string;
    appointmentId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
    permission:
      | "coordination.calendar.read"
      | "coordination.appointment.change"
      | "coordination.appointment.cancel";
    operation: "appointment.read" | "appointment.change.read" | "appointment.cancel.read";
  }): Promise<AppointmentProjection> {
    const authorization = this.requireDecision(
      input.authorization,
      input.permission,
      input.householdId,
      input.correlationId,
      digestJson({
        operation: input.operation,
        householdId: input.householdId,
        appointmentId: input.appointmentId,
      }),
    );
    const row = await this.find(input.appointmentId);
    if (
      !row ||
      row.household_id !== input.householdId ||
      row.recipient_context_id !== authorization.recipientContextId
    ) {
      throw inaccessible();
    }
    return projectAppointment(row, this.now());
  }

  public async create(input: {
    householdId: string;
    request: CreateAppointmentRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<AppointmentSeriesProjection> {
    const request = CreateAppointmentRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.appointment.create",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "appointment.create", householdId: input.householdId, request }),
    );
    const occurrences = resolveOccurrences(request.schedule);
    const requestHash = digestJson({
      householdId: input.householdId,
      recipientContextId: authorization.recipientContextId,
      request,
    });
    const keyDigest = digestText(input.idempotencyKey);
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      await this.lockMutation(
        client,
        authorization.recipientContextId,
        "appointment.create",
        keyDigest,
      );
      const replay = await this.readIdempotency(
        client,
        "appointment.create",
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        await client.query("COMMIT");
        transactionOpen = false;
        return AppointmentSeriesProjectionSchema.parse(replay.response_body);
      }
      await this.assertNoConflicts(client, authorization.recipientContextId, occurrences);

      const now = this.now();
      const seriesId = this.id("series");
      const occurrenceCount = occurrences.length;
      const recurrenceFinalLocalDate = occurrences.at(-1)!.localStart.slice(0, 10);
      const appointments: AppointmentProjection[] = [];
      for (const [index, occurrence] of occurrences.entries()) {
        const appointmentId = this.id("appointment");
        const reminderLead = request.reminder.leadMinutes;
        const reminderIntent = reminderLead === null ? "not_requested" : "recorded";
        await client.query(
          `INSERT INTO care_appointments (
            appointment_id, series_id, household_id, recipient_context_id,
            kind, logistics, status, last_change, starts_at_utc, ends_at_utc,
            source_local_start, source_utc_offset, source_time_zone,
            duration_minutes, occurrence_number, occurrence_count,
            recurrence_frequency, recurrence_interval_weeks,
            recurrence_final_local_date, reminder_intent, reminder_lead_minutes,
            version, created_at, updated_at, cancelled_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,'scheduled','created',$7,$8,$9,$10,$11,
            $12,$13,$14,$15,$16,$17,$18,$19,1,$20,$20,NULL
          )`,
          [
            appointmentId,
            seriesId,
            input.householdId,
            authorization.recipientContextId,
            request.appointmentKind,
            request.logisticsMode,
            occurrence.startsAt,
            occurrence.endsAt,
            occurrence.localStart,
            occurrence.offset,
            request.schedule.sourceTimeZone,
            request.schedule.durationMinutes,
            index + 1,
            occurrenceCount,
            request.schedule.recurrence.frequency,
            request.schedule.recurrence.frequency === "weekly"
              ? request.schedule.recurrence.intervalWeeks
              : null,
            recurrenceFinalLocalDate,
            reminderIntent,
            reminderLead,
            now,
          ],
        );
        await this.writeTransition(client, {
          appointmentId,
          version: 1,
          action: "created",
          actorId: authorization.actor.actorId,
          correlationId: input.correlationId,
          now,
        });
        await this.writeAudit(client, {
          actorId: authorization.actor.actorId,
          householdId: input.householdId,
          action: "appointment.create",
          resourceId: appointmentId,
          result: "success",
          correlationId: input.correlationId,
          now,
        });
        if (reminderLead !== null) {
          await this.writeReminderEvent(
            client,
            appointmentId,
            1,
            authorization.actor.actorId,
            occurrence.startsAt,
            reminderLead,
            "schedule",
            input.correlationId,
            now,
          );
        }
        const inserted = await this.findWithClient(client, appointmentId);
        appointments.push(projectAppointment(inserted!, now));
      }
      const response = AppointmentSeriesProjectionSchema.parse({ seriesId, appointments });
      await this.writeIdempotency(client, {
        operation: "appointment.create",
        actorId: authorization.actor.actorId,
        keyDigest,
        requestHash,
        statusCode: 201,
        response,
        now,
      });
      await client.query("COMMIT");
      transactionOpen = false;
      this.log("appointment.create", input.correlationId, "success");
      return response;
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async change(input: {
    householdId: string;
    appointmentId: string;
    request: ChangeAppointmentRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<AppointmentProjection> {
    const request = ChangeAppointmentRequestSchema.parse(input.request);
    return this.mutate(input, request, "change");
  }

  public async cancel(input: {
    householdId: string;
    appointmentId: string;
    request: CancelAppointmentRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<AppointmentProjection> {
    const request = CancelAppointmentRequestSchema.parse(input.request);
    return this.mutate(input, request, "cancel");
  }

  private async mutate(
    input: {
      householdId: string;
      appointmentId: string;
      idempotencyKey: string;
      authorization: CoordinationAuthorizationDecision;
      correlationId: string;
    },
    request: ChangeAppointmentRequest | CancelAppointmentRequest,
    action: "change" | "cancel",
  ): Promise<AppointmentProjection> {
    const permission = `coordination.appointment.${action}` as CoordinationPermission;
    const authorization = this.requireDecision(
      input.authorization,
      permission,
      input.householdId,
      input.correlationId,
      digestJson({
        operation: `appointment.${action}`,
        householdId: input.householdId,
        appointmentId: input.appointmentId,
        request,
      }),
    );
    const requestHash = digestJson({
      householdId: input.householdId,
      appointmentId: input.appointmentId,
      recipientContextId: authorization.recipientContextId,
      request,
    });
    const operation = `appointment.${action}`;
    const keyDigest = digestText(input.idempotencyKey);
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      await this.lockMutation(client, authorization.recipientContextId, operation, keyDigest);
      const replay = await this.readIdempotency(
        client,
        operation,
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        await client.query("COMMIT");
        transactionOpen = false;
        return AppointmentProjectionSchema.parse(replay.response_body);
      }
      const row = await this.findWithClient(client, input.appointmentId, true);
      if (
        !row ||
        row.household_id !== input.householdId ||
        row.recipient_context_id !== authorization.recipientContextId
      ) {
        throw inaccessible();
      }
      const current = projectAppointment(row, this.now());
      if (row.version !== request.expectedVersion) {
        throw new CareError(
          409,
          "APPOINTMENT_VERSION_CONFLICT",
          "appointment.version_conflict",
          false,
          undefined,
          undefined,
          current,
          undefined,
          "reload_current",
        );
      }
      if (row.status === "cancelled") {
        throw new CareError(
          409,
          "APPOINTMENT_STATE_CONFLICT",
          "appointment.state_conflict",
          false,
          undefined,
          undefined,
          current,
          undefined,
          "reload_current",
        );
      }
      const now = this.now();
      const nextVersion = row.version + 1;
      if (action === "change") {
        const change = request as ChangeAppointmentRequest;
        const [occurrence] = resolveOccurrences(change.schedule);
        await this.assertNoConflicts(
          client,
          authorization.recipientContextId,
          [occurrence!],
          input.appointmentId,
        );
        const reminderIntent = change.reminder.leadMinutes === null ? "not_requested" : "recorded";
        await client.query(
          `UPDATE care_appointments
           SET kind = $2, logistics = $3, starts_at_utc = $4, ends_at_utc = $5,
               source_local_start = $6, source_utc_offset = $7,
               source_time_zone = $8, duration_minutes = $9,
               reminder_intent = $10, reminder_lead_minutes = $11,
               status = 'scheduled', last_change = 'changed',
               version = $12, updated_at = $13
           WHERE appointment_id = $1`,
          [
            input.appointmentId,
            change.appointmentKind,
            change.logisticsMode,
            occurrence!.startsAt,
            occurrence!.endsAt,
            occurrence!.localStart,
            occurrence!.offset,
            change.schedule.sourceTimeZone,
            change.schedule.durationMinutes,
            reminderIntent,
            change.reminder.leadMinutes,
            nextVersion,
            now,
          ],
        );
        if (change.reminder.leadMinutes !== null) {
          await this.writeReminderEvent(
            client,
            input.appointmentId,
            nextVersion,
            authorization.actor.actorId,
            occurrence!.startsAt,
            change.reminder.leadMinutes,
            "schedule",
            input.correlationId,
            now,
          );
        } else if (row.reminder_intent === "recorded") {
          await this.writeReminderEvent(
            client,
            input.appointmentId,
            nextVersion,
            authorization.actor.actorId,
            occurrence!.startsAt,
            null,
            "cancel",
            input.correlationId,
            now,
          );
        }
      } else {
        await client.query(
          `UPDATE care_appointments
           SET status = 'cancelled', last_change = 'cancelled',
               reminder_intent = CASE
                 WHEN reminder_intent = 'recorded' THEN 'cancelled'
                 ELSE reminder_intent
               END,
               version = $2, updated_at = $3, cancelled_at = $3
           WHERE appointment_id = $1`,
          [input.appointmentId, nextVersion, now],
        );
        if (row.reminder_intent === "recorded") {
          await this.writeReminderEvent(
            client,
            input.appointmentId,
            nextVersion,
            authorization.actor.actorId,
            row.starts_at_utc,
            null,
            "cancel",
            input.correlationId,
            now,
          );
        }
      }
      await this.writeTransition(client, {
        appointmentId: input.appointmentId,
        version: nextVersion,
        action: action === "change" ? "changed" : "cancelled",
        actorId: authorization.actor.actorId,
        correlationId: input.correlationId,
        now,
      });
      await this.writeAudit(client, {
        actorId: authorization.actor.actorId,
        householdId: input.householdId,
        action: `appointment.${action}`,
        resourceId: input.appointmentId,
        result: "success",
        correlationId: input.correlationId,
        now,
      });
      const updated = projectAppointment(
        (await this.findWithClient(client, input.appointmentId))!,
        now,
      );
      await this.writeIdempotency(client, {
        operation,
        actorId: authorization.actor.actorId,
        keyDigest,
        requestHash,
        statusCode: 200,
        response: updated,
        now,
      });
      await client.query("COMMIT");
      transactionOpen = false;
      this.log(`appointment.${action}`, input.correlationId, "success");
      return updated;
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK");
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

  private async dayBounds(localDate: string, timeZone: string) {
    const result = await this.pool.query<{ day_start: Date; day_end: Date }>(
      `SELECT
         ($1::date::timestamp AT TIME ZONE $2) AS day_start,
         (($1::date + 1)::timestamp AT TIME ZONE $2) AS day_end`,
      [localDate, timeZone],
    );
    const row = result.rows[0];
    if (!row || row.day_end <= row.day_start) {
      throw new CareError(400, "APPOINTMENT_LOCAL_TIME_INVALID", "appointment.local_time_invalid");
    }
    return { start: row.day_start, end: row.day_end };
  }

  private async assertNoConflicts(
    client: PoolClient,
    recipientContextId: string,
    occurrences: ResolvedOccurrence[],
    excludeAppointmentId?: string,
  ): Promise<void> {
    for (const occurrence of occurrences) {
      const result = await client.query<{ starts_at_utc: Date; ends_at_utc: Date }>(
        `SELECT starts_at_utc, ends_at_utc
         FROM care_appointments
         WHERE recipient_context_id = $1
           AND status = 'scheduled'
           AND starts_at_utc < $3
           AND $2 < ends_at_utc
           AND ($4::text IS NULL OR appointment_id <> $4)
         ORDER BY starts_at_utc, appointment_id
         LIMIT 1`,
        [recipientContextId, occurrence.startsAt, occurrence.endsAt, excludeAppointmentId ?? null],
      );
      const conflict = result.rows[0];
      if (conflict) {
        throw new CareError(
          409,
          "APPOINTMENT_TIME_CONFLICT",
          "appointment.time_conflict",
          false,
          undefined,
          undefined,
          undefined,
          {
            startsAtUtc: conflict.starts_at_utc.toISOString(),
            endsAtUtc: conflict.ends_at_utc.toISOString(),
          },
          "choose_another_time",
        );
      }
    }
  }

  private async lockMutation(
    client: PoolClient,
    recipientContextId: string,
    operation: string,
    keyDigest: string,
  ): Promise<void> {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `appointment-recipient:${recipientContextId}`,
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${operation}:${keyDigest}`]);
  }

  private async readIdempotency(
    client: PoolClient,
    operation: string,
    actorId: string,
    keyDigest: string,
  ): Promise<IdempotencyRow | undefined> {
    const result = await client.query<IdempotencyRow>(
      `SELECT request_hash, response_body, expires_at
       FROM care_idempotency
       WHERE operation = $1 AND actor_id = $2 AND idempotency_key = $3`,
      [operation, actorId, keyDigest],
    );
    return result.rows[0];
  }

  private async writeIdempotency(
    client: PoolClient,
    input: {
      operation: string;
      actorId: string;
      keyDigest: string;
      requestHash: string;
      statusCode: number;
      response: unknown;
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
        input.keyDigest,
        input.requestHash,
        input.statusCode,
        JSON.stringify(input.response),
        input.now,
      ],
    );
  }

  private async writeTransition(
    client: PoolClient,
    input: {
      appointmentId: string;
      version: number;
      action: "created" | "changed" | "cancelled";
      actorId: string;
      correlationId: string;
      now: Date;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO care_appointment_transitions (
        transition_id, appointment_id, appointment_version, action,
        actor_id, occurred_at, correlation_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        this.id("transition"),
        input.appointmentId,
        input.version,
        input.action,
        input.actorId,
        input.now,
        input.correlationId,
      ],
    );
  }

  private async writeAudit(
    client: PoolClient,
    input: {
      actorId: string;
      householdId: string;
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
      ) VALUES ($1,$2,$3,$4,'appointment',$5,$6,$7,$8,'{}'::jsonb)`,
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

  private async writeReminderEvent(
    client: PoolClient,
    appointmentId: string,
    version: number,
    recipientId: string,
    startsAt: Date,
    leadMinutes: 15 | 60 | 1440 | null,
    intent: "schedule" | "cancel",
    correlationId: string,
    now: Date,
  ): Promise<void> {
    const event: AppointmentReminderIntentEvent = AppointmentReminderIntentEventSchema.parse({
      eventId: this.id("evt"),
      eventType: "care.appointment.reminder_intent.v1",
      eventVersion: 1,
      occurredAt: now.toISOString(),
      producer: "care-coordination",
      aggregateId: appointmentId,
      aggregateVersion: version,
      correlationId,
      causationId: this.id("cmd"),
      payload:
        intent === "schedule"
          ? {
              intent,
              recipientId,
              remindAtUtc: new Date(startsAt.getTime() - (leadMinutes ?? 0) * 60_000).toISOString(),
              startsAtUtc: startsAt.toISOString(),
              messageKey: "notifications.appointment.reminder",
            }
          : {
              intent,
              recipientId,
              messageKey: "notifications.appointment.reminder",
            },
    });
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
  }

  private async find(appointmentId: string): Promise<AppointmentRow | undefined> {
    const result = await this.pool.query<AppointmentRow>(
      `${appointmentSelection} WHERE appointment_id = $1`,
      [appointmentId],
    );
    return result.rows[0];
  }

  private async findWithClient(
    client: PoolClient,
    appointmentId: string,
    forUpdate = false,
  ): Promise<AppointmentRow | undefined> {
    const result = await client.query<AppointmentRow>(
      `${appointmentSelection} WHERE appointment_id = $1${forUpdate ? " FOR UPDATE" : ""}`,
      [appointmentId],
    );
    return result.rows[0];
  }

  private log(eventName: string, correlationId: string, result: "success"): void {
    this.logger.emit({
      level: "info",
      eventName,
      operation: eventName,
      result,
      correlationId,
    });
  }
}

export function resolveOccurrences(
  schedule: CreateAppointmentRequest["schedule"] | ChangeAppointmentRequest["schedule"],
): ResolvedOccurrence[] {
  const recurrence = schedule.recurrence;
  const count = recurrence.frequency === "weekly" ? recurrence.occurrenceCount : 1;
  const intervalWeeks = recurrence.frequency === "weekly" ? recurrence.intervalWeeks : 1;
  const occurrences: ResolvedOccurrence[] = [];
  for (let index = 0; index < count; index += 1) {
    const localStart = addLocalWeeks(schedule.localStart, intervalWeeks * index);
    const candidates = localCandidates(localStart, schedule.sourceTimeZone);
    if (candidates.length === 0) {
      throw new CareError(
        400,
        "APPOINTMENT_LOCAL_TIME_INVALID",
        "appointment.local_time_invalid",
        false,
        { localStart: "nonexistent" },
      );
    }
    const selected =
      candidates.length === 1
        ? candidates[0]!
        : schedule.ambiguousTimePolicy === "earlier"
          ? candidates[0]!
          : candidates.at(-1)!;
    const offset = offsetFor(selected, localStart);
    if (index === 0 && offset !== schedule.sourceUtcOffset) {
      throw new CareError(
        400,
        "APPOINTMENT_LOCAL_TIME_INVALID",
        "appointment.local_time_invalid",
        false,
        { sourceUtcOffset: "mismatch" },
      );
    }
    occurrences.push({
      localStart,
      startsAt: selected,
      endsAt: new Date(selected.getTime() + schedule.durationMinutes * 60_000),
      offset,
    });
  }
  return occurrences;
}

function localCandidates(localStart: string, timeZone: string): Date[] {
  const [datePart, timePart] = localStart.split("T");
  const [year, month, day] = datePart!.split("-").map(Number);
  const [hour, minute] = timePart!.split(":").map(Number);
  const nominal = Date.UTC(year!, month! - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const candidates: Date[] = [];
  for (
    let timestamp = nominal - 14 * 60 * 60_000;
    timestamp <= nominal + 14 * 60 * 60_000;
    timestamp += 60_000
  ) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(timestamp))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    if (
      Number(parts.year) === year &&
      Number(parts.month) === month &&
      Number(parts.day) === day &&
      Number(parts.hour) === hour &&
      Number(parts.minute) === minute
    ) {
      candidates.push(new Date(timestamp));
    }
  }
  return candidates;
}

function offsetFor(instant: Date, localStart: string): string {
  const [datePart, timePart] = localStart.split("T");
  const [year, month, day] = datePart!.split("-").map(Number);
  const [hour, minute] = timePart!.split(":").map(Number);
  const localAsUtc = Date.UTC(year!, month! - 1, day, hour, minute);
  const offsetMinutes = Math.round((localAsUtc - instant.getTime()) / 60_000);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(
    absolute % 60,
  ).padStart(2, "0")}`;
}

function addLocalWeeks(localStart: string, weeks: number): string {
  const [datePart, timePart] = localStart.split("T");
  const [year, month, day] = datePart!.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + weeks * 7));
  return `${date.toISOString().slice(0, 10)}T${timePart}`;
}

function projectAppointment(row: AppointmentRow, snapshotAt: Date): AppointmentProjection {
  const finalDate =
    row.recurrence_final_local_date instanceof Date
      ? row.recurrence_final_local_date.toISOString().slice(0, 10)
      : String(row.recurrence_final_local_date).slice(0, 10);
  return AppointmentProjectionSchema.parse({
    appointmentId: row.appointment_id,
    seriesId: row.series_id,
    householdId: row.household_id,
    recipientContextId: row.recipient_context_id,
    kind: row.kind,
    logistics: row.logistics,
    status: row.status,
    lastChange: row.last_change,
    startsAtUtc: row.starts_at_utc.toISOString(),
    endsAtUtc: row.ends_at_utc.toISOString(),
    sourceLocalStart: row.source_local_start,
    sourceUtcOffset: row.source_utc_offset,
    sourceTimeZone: row.source_time_zone,
    durationMinutes: row.duration_minutes,
    occurrenceNumber: row.occurrence_number,
    occurrenceCount: row.occurrence_count,
    recurrenceFrequency: row.recurrence_frequency,
    recurrenceIntervalWeeks: row.recurrence_interval_weeks,
    recurrenceFinalLocalDate: finalDate,
    mutationScope: "occurrence_only",
    reminderIntent: row.reminder_intent,
    reminderLeadMinutes: row.reminder_lead_minutes,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    confirmedAt: snapshotAt.toISOString(),
  });
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

function idempotencyConflict(): CareError {
  return new CareError(409, "IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict");
}
