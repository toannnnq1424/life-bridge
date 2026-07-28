import { createHash, randomUUID } from "node:crypto";

import {
  ChangeMedicationReminderRequestSchema,
  CoordinationAuthorizationDecisionSchema,
  CreateMedicationReminderRequestSchema,
  DisableMedicationReminderRequestSchema,
  MedicationReminderIntentEventSchema,
  MedicationReminderListProjectionSchema,
  MedicationReminderProjectionSchema,
  type ChangeMedicationReminderRequest,
  type CoordinationAuthorizationDecision,
  type CoordinationPermission,
  type CreateMedicationReminderRequest,
  type DisableMedicationReminderRequest,
  type MedicationReminderIntentEvent,
  type MedicationReminderListProjection,
  type MedicationReminderProjection,
  type MedicationReminderSchedule,
} from "@lifebridge/contracts";
import { SafeLogger } from "@lifebridge/observability";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { CareError } from "./errors.js";

const DECISION_MAX_AGE_MS = 10_000;
const DECISION_FUTURE_TOLERANCE_MS = 2_000;

interface MedicationReminderServiceOptions {
  now?: () => Date;
  id?: (prefix: string) => string;
  logger?: SafeLogger;
  beforeCommit?: (operation: "create" | "change" | "disable") => void | Promise<void>;
}

interface ReminderRow extends QueryResultRow {
  reminder_id: string;
  household_id: string;
  recipient_context_id: string;
  notification_recipient_id: string;
  medication_label: string;
  amount: string;
  unit: MedicationReminderProjection["unit"];
  other_unit_label: string | null;
  source_local_start: string;
  source_time_zone: string;
  source_utc_offset: string;
  ambiguous_time_policy: "earlier" | "later" | null;
  recurrence_frequency: "none" | "daily" | "weekly";
  recurrence_interval: number | null;
  occurrence_count: number;
  recurrence_final_local_date: Date | string;
  status: MedicationReminderProjection["status"];
  version: number;
  created_at: Date;
  updated_at: Date;
  disabled_at: Date | null;
}

interface OccurrenceRow extends QueryResultRow {
  occurrence_id: string;
  reminder_id: string;
  schedule_version: number;
  occurrence_number: number;
  occurrence_count: number;
  source_local_start: string;
  source_time_zone: string;
  source_utc_offset: string;
  scheduled_at_utc: Date;
  recurrence_final_local_date: Date | string;
  state: "current" | "superseded" | "disabled";
  notification_intent: "recorded" | "cancelled";
  created_at: Date;
  updated_at: Date;
}

interface IdempotencyRow extends QueryResultRow {
  request_hash: string;
  response_body: unknown;
}

export interface ResolvedMedicationOccurrence {
  localStart: string;
  scheduledAt: Date;
  offset: string;
}

const reminderSelection = `
  SELECT reminder_id, household_id, recipient_context_id,
         notification_recipient_id, medication_label, amount, unit,
         other_unit_label, source_local_start, source_time_zone,
         source_utc_offset, ambiguous_time_policy, recurrence_frequency,
         recurrence_interval, occurrence_count, recurrence_final_local_date,
         status, version, created_at, updated_at, disabled_at
  FROM care_medication_reminders`;

const occurrenceSelection = `
  SELECT occurrence_id, reminder_id, schedule_version, occurrence_number,
         occurrence_count, source_local_start, source_time_zone,
         source_utc_offset, scheduled_at_utc, recurrence_final_local_date,
         state, notification_intent, created_at, updated_at
  FROM care_medication_reminder_occurrences`;

export class MedicationReminderService {
  private readonly now: () => Date;
  private readonly id: (prefix: string) => string;
  private readonly logger: SafeLogger;
  private readonly beforeCommit?: MedicationReminderServiceOptions["beforeCommit"];

  public constructor(
    private readonly pool: Pool,
    options: MedicationReminderServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? ((prefix) => `${prefix}_${randomUUID().replaceAll("-", "")}`);
    this.logger = options.logger ?? new SafeLogger("care-coordination");
    this.beforeCommit = options.beforeCommit;
  }

  public static requestDigest(value: unknown): string {
    return digestJson(value);
  }

  public async list(input: {
    householdId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<MedicationReminderListProjection> {
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.medication_reminder.read",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "medication_reminder.list", householdId: input.householdId }),
    );
    const rows = await this.pool.query<ReminderRow>(
      `${reminderSelection}
       WHERE household_id = $1 AND recipient_context_id = $2
       ORDER BY created_at, reminder_id
       LIMIT 50`,
      [input.householdId, authorization.recipientContextId],
    );
    const snapshotAt = this.now();
    const occurrences = await this.occurrencesFor(rows.rows);
    return MedicationReminderListProjectionSchema.parse({
      items: rows.rows.map((row) =>
        projectReminder(row, occurrences.get(row.reminder_id) ?? [], snapshotAt),
      ),
      snapshotAt: snapshotAt.toISOString(),
    });
  }

  public async get(input: {
    householdId: string;
    reminderId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<MedicationReminderProjection> {
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.medication_reminder.read",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "medication_reminder.read",
        householdId: input.householdId,
        reminderId: input.reminderId,
      }),
    );
    const result = await this.pool.query<ReminderRow>(
      `${reminderSelection} WHERE reminder_id = $1`,
      [input.reminderId],
    );
    const row = result.rows[0];
    if (
      !row ||
      row.household_id !== input.householdId ||
      row.recipient_context_id !== authorization.recipientContextId
    ) {
      throw inaccessible();
    }
    const occurrences = await this.occurrencesFor([row]);
    return projectReminder(row, occurrences.get(row.reminder_id) ?? [], this.now());
  }

  public async create(input: {
    householdId: string;
    request: CreateMedicationReminderRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<MedicationReminderProjection> {
    const request = CreateMedicationReminderRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.medication_reminder.create",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "medication_reminder.create",
        householdId: input.householdId,
        request,
      }),
    );
    const resolved = resolveMedicationOccurrences(request.schedule);
    const requestHash = digestJson({
      householdId: input.householdId,
      recipientContextId: authorization.recipientContextId,
      actorId: authorization.actor.actorId,
      request,
    });
    const keyDigest = digestText(input.idempotencyKey);
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      await this.lock(client, authorization.recipientContextId, "create", keyDigest);
      const replay = await this.readIdempotency(
        client,
        "medication_reminder.create",
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        await client.query("COMMIT");
        open = false;
        return MedicationReminderProjectionSchema.parse(replay.response_body);
      }

      const now = this.now();
      const reminderId = this.id("medication_reminder");
      await this.insertReminder(client, {
        reminderId,
        householdId: input.householdId,
        recipientContextId: authorization.recipientContextId,
        recipientId: authorization.actor.actorId,
        request,
        version: 1,
        resolved,
        now,
      });
      await this.insertOccurrencesAndEvents(client, {
        reminderId,
        householdId: input.householdId,
        recipientContextId: authorization.recipientContextId,
        recipientId: authorization.actor.actorId,
        version: 1,
        schedule: request.schedule,
        resolved,
        correlationId: input.correlationId,
        now,
      });
      await this.writeTransition(
        client,
        reminderId,
        1,
        "created",
        authorization.actor.actorId,
        input.correlationId,
        now,
      );
      await this.writeAudit(
        client,
        reminderId,
        input.householdId,
        "medication_reminder.create",
        authorization,
        input.correlationId,
        now,
      );
      const response = await this.projectWithClient(client, reminderId, now);
      await this.writeIdempotency(
        client,
        "medication_reminder.create",
        authorization.actor.actorId,
        keyDigest,
        requestHash,
        201,
        response,
        now,
      );
      await this.beforeCommit?.("create");
      await client.query("COMMIT");
      open = false;
      this.log("medication_reminder.create", input.correlationId, "success");
      return response;
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async change(input: {
    householdId: string;
    reminderId: string;
    request: ChangeMedicationReminderRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<MedicationReminderProjection> {
    const request = ChangeMedicationReminderRequestSchema.parse(input.request);
    return this.mutate(input, request, "change");
  }

  public async disable(input: {
    householdId: string;
    reminderId: string;
    request: DisableMedicationReminderRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<MedicationReminderProjection> {
    const request = DisableMedicationReminderRequestSchema.parse(input.request);
    return this.mutate(input, request, "disable");
  }

  private async mutate(
    input: {
      householdId: string;
      reminderId: string;
      idempotencyKey: string;
      authorization: CoordinationAuthorizationDecision;
      correlationId: string;
    },
    request: ChangeMedicationReminderRequest | DisableMedicationReminderRequest,
    action: "change" | "disable",
  ): Promise<MedicationReminderProjection> {
    const permission = `coordination.medication_reminder.${action}` as CoordinationPermission;
    const authorization = this.requireDecision(
      input.authorization,
      permission,
      input.householdId,
      input.correlationId,
      digestJson({
        operation: `medication_reminder.${action}`,
        householdId: input.householdId,
        reminderId: input.reminderId,
        request,
      }),
    );
    const resolved =
      action === "change"
        ? resolveMedicationOccurrences((request as ChangeMedicationReminderRequest).schedule)
        : null;
    const requestHash = digestJson({
      householdId: input.householdId,
      recipientContextId: authorization.recipientContextId,
      reminderId: input.reminderId,
      request,
    });
    const keyDigest = digestText(input.idempotencyKey);
    const operation = `medication_reminder.${action}`;
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      await this.lock(client, authorization.recipientContextId, action, keyDigest);
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
        return MedicationReminderProjectionSchema.parse(replay.response_body);
      }
      const rowResult = await client.query<ReminderRow>(
        `${reminderSelection} WHERE reminder_id = $1 FOR UPDATE`,
        [input.reminderId],
      );
      const row = rowResult.rows[0];
      if (
        !row ||
        row.household_id !== input.householdId ||
        row.recipient_context_id !== authorization.recipientContextId
      ) {
        throw inaccessible();
      }
      if (row.version !== request.expectedVersion) {
        throw new CareError(
          409,
          "MEDICATION_REMINDER_VERSION_CONFLICT",
          "medication_reminder.version_conflict",
          false,
        );
      }
      if (row.status === "disabled") {
        throw new CareError(
          409,
          "MEDICATION_REMINDER_STATE_CONFLICT",
          "medication_reminder.state_conflict",
          false,
        );
      }
      const now = this.now();
      const nextVersion = row.version + 1;
      const prior = await client.query<OccurrenceRow>(
        `${occurrenceSelection}
         WHERE reminder_id = $1 AND schedule_version = $2 AND state = 'current'
         ORDER BY occurrence_number`,
        [input.reminderId, row.version],
      );
      for (const occurrence of prior.rows) {
        await this.writeIntentEvent(client, {
          reminderId: row.reminder_id,
          occurrenceId: occurrence.occurrence_id,
          householdId: row.household_id,
          recipientContextId: row.recipient_context_id,
          recipientId: row.notification_recipient_id,
          version: nextVersion,
          intent: "cancel",
          reason: action === "change" ? "schedule_changed" : "schedule_disabled",
          correlationId: input.correlationId,
          now,
        });
      }
      await client.query(
        `UPDATE care_medication_reminder_occurrences
         SET state = $2, notification_intent = 'cancelled', updated_at = $3
         WHERE reminder_id = $1 AND schedule_version = $4 AND state = 'current'`,
        [input.reminderId, action === "change" ? "superseded" : "disabled", now, row.version],
      );

      if (action === "change") {
        const change = request as ChangeMedicationReminderRequest;
        await this.updateReminder(client, row, change, nextVersion, resolved!, now);
        await this.insertOccurrencesAndEvents(client, {
          reminderId: row.reminder_id,
          householdId: row.household_id,
          recipientContextId: row.recipient_context_id,
          recipientId: row.notification_recipient_id,
          version: nextVersion,
          schedule: change.schedule,
          resolved: resolved!,
          correlationId: input.correlationId,
          now,
        });
      } else {
        await client.query(
          `UPDATE care_medication_reminders
           SET status = 'disabled', version = $2, updated_at = $3, disabled_at = $3
           WHERE reminder_id = $1`,
          [input.reminderId, nextVersion, now],
        );
      }
      await this.writeTransition(
        client,
        input.reminderId,
        nextVersion,
        action === "change" ? "changed" : "disabled",
        authorization.actor.actorId,
        input.correlationId,
        now,
      );
      await this.writeAudit(
        client,
        input.reminderId,
        input.householdId,
        `medication_reminder.${action}`,
        authorization,
        input.correlationId,
        now,
      );
      const response = await this.projectWithClient(client, input.reminderId, now);
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
      await this.beforeCommit?.(action);
      await client.query("COMMIT");
      open = false;
      this.log(operation, input.correlationId, "success");
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

  private async insertReminder(
    client: PoolClient,
    input: {
      reminderId: string;
      householdId: string;
      recipientContextId: string;
      recipientId: string;
      request: CreateMedicationReminderRequest;
      version: number;
      resolved: ResolvedMedicationOccurrence[];
      now: Date;
    },
  ): Promise<void> {
    const recurrence = recurrenceColumns(input.request.schedule, input.resolved);
    await client.query(
      `INSERT INTO care_medication_reminders (
        reminder_id, household_id, recipient_context_id, notification_recipient_id,
        medication_label, amount, unit, other_unit_label, source_local_start,
        source_time_zone, source_utc_offset, ambiguous_time_policy,
        recurrence_frequency, recurrence_interval, occurrence_count,
        recurrence_final_local_date, status, version, created_at, updated_at, disabled_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'active',$17,$18,$18,NULL)`,
      [
        input.reminderId,
        input.householdId,
        input.recipientContextId,
        input.recipientId,
        input.request.medicationLabel,
        input.request.amount,
        input.request.unit,
        input.request.otherUnitLabel,
        input.request.schedule.localStart,
        input.request.schedule.sourceTimeZone,
        input.request.schedule.sourceUtcOffset,
        input.request.schedule.ambiguousTimePolicy,
        recurrence.frequency,
        recurrence.interval,
        input.resolved.length,
        recurrence.finalLocalDate,
        input.version,
        input.now,
      ],
    );
  }

  private async updateReminder(
    client: PoolClient,
    row: ReminderRow,
    request: ChangeMedicationReminderRequest,
    version: number,
    resolved: ResolvedMedicationOccurrence[],
    now: Date,
  ): Promise<void> {
    const recurrence = recurrenceColumns(request.schedule, resolved);
    await client.query(
      `UPDATE care_medication_reminders
       SET medication_label = $2, amount = $3, unit = $4, other_unit_label = $5,
           source_local_start = $6, source_time_zone = $7, source_utc_offset = $8,
           ambiguous_time_policy = $9, recurrence_frequency = $10,
           recurrence_interval = $11, occurrence_count = $12,
           recurrence_final_local_date = $13, version = $14, updated_at = $15
       WHERE reminder_id = $1`,
      [
        row.reminder_id,
        request.medicationLabel,
        request.amount,
        request.unit,
        request.otherUnitLabel,
        request.schedule.localStart,
        request.schedule.sourceTimeZone,
        request.schedule.sourceUtcOffset,
        request.schedule.ambiguousTimePolicy,
        recurrence.frequency,
        recurrence.interval,
        resolved.length,
        recurrence.finalLocalDate,
        version,
        now,
      ],
    );
  }

  private async insertOccurrencesAndEvents(
    client: PoolClient,
    input: {
      reminderId: string;
      householdId: string;
      recipientContextId: string;
      recipientId: string;
      version: number;
      schedule: MedicationReminderSchedule;
      resolved: ResolvedMedicationOccurrence[];
      correlationId: string;
      now: Date;
    },
  ): Promise<void> {
    const finalLocalDate = input.resolved.at(-1)!.localStart.slice(0, 10);
    for (const [index, occurrence] of input.resolved.entries()) {
      const occurrenceId = this.id("medication_occurrence");
      await client.query(
        `INSERT INTO care_medication_reminder_occurrences (
          occurrence_id, reminder_id, schedule_version, occurrence_number,
          occurrence_count, source_local_start, source_time_zone,
          source_utc_offset, scheduled_at_utc, recurrence_final_local_date,
          state, notification_intent, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'current','recorded',$11,$11)`,
        [
          occurrenceId,
          input.reminderId,
          input.version,
          index + 1,
          input.resolved.length,
          occurrence.localStart,
          input.schedule.sourceTimeZone,
          occurrence.offset,
          occurrence.scheduledAt,
          finalLocalDate,
          input.now,
        ],
      );
      await this.writeIntentEvent(client, {
        reminderId: input.reminderId,
        occurrenceId,
        householdId: input.householdId,
        recipientContextId: input.recipientContextId,
        recipientId: input.recipientId,
        version: input.version,
        intent: "schedule",
        scheduledAt: occurrence.scheduledAt,
        sourceLocalStart: occurrence.localStart,
        sourceTimeZone: input.schedule.sourceTimeZone,
        sourceUtcOffset: occurrence.offset,
        correlationId: input.correlationId,
        now: input.now,
      });
    }
  }

  private async writeIntentEvent(
    client: PoolClient,
    input: {
      reminderId: string;
      occurrenceId: string;
      householdId: string;
      recipientContextId: string;
      recipientId: string;
      version: number;
      intent: "schedule" | "cancel";
      reason?: "schedule_changed" | "schedule_disabled";
      scheduledAt?: Date;
      sourceLocalStart?: string;
      sourceTimeZone?: string;
      sourceUtcOffset?: string;
      correlationId: string;
      now: Date;
    },
  ): Promise<void> {
    const event: MedicationReminderIntentEvent = MedicationReminderIntentEventSchema.parse({
      eventId: this.id("evt"),
      eventType: "care.medication_reminder.intent.v1",
      eventVersion: 1,
      occurredAt: input.now.toISOString(),
      producer: "care-coordination",
      aggregateId: input.occurrenceId,
      aggregateVersion: input.version,
      correlationId: input.correlationId,
      causationId: this.id("cmd"),
      payload:
        input.intent === "schedule"
          ? {
              intent: "schedule",
              reminderId: input.reminderId,
              occurrenceId: input.occurrenceId,
              householdId: input.householdId,
              recipientContextId: input.recipientContextId,
              recipientId: input.recipientId,
              occurrenceVersion: input.version,
              scheduledAtUtc: input.scheduledAt!.toISOString(),
              sourceLocalStart: input.sourceLocalStart!,
              sourceTimeZone: input.sourceTimeZone!,
              sourceUtcOffset: input.sourceUtcOffset!,
              messageKey: "notifications.medication_reminder.generic",
            }
          : {
              intent: "cancel",
              reminderId: input.reminderId,
              occurrenceId: input.occurrenceId,
              householdId: input.householdId,
              recipientContextId: input.recipientContextId,
              recipientId: input.recipientId,
              occurrenceVersion: input.version,
              reason: input.reason!,
              messageKey: "notifications.medication_reminder.generic",
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

  private async occurrencesFor(rows: ReminderRow[]): Promise<Map<string, OccurrenceRow[]>> {
    const ids = rows.map((row) => row.reminder_id);
    if (ids.length === 0) return new Map();
    const result = await this.pool.query<OccurrenceRow>(
      `${occurrenceSelection}
       WHERE reminder_id = ANY($1::text[])
         AND schedule_version = (
           SELECT MAX(candidate.schedule_version)
           FROM care_medication_reminder_occurrences AS candidate
           WHERE candidate.reminder_id = care_medication_reminder_occurrences.reminder_id
         )
       ORDER BY reminder_id, occurrence_number`,
      [ids],
    );
    return groupOccurrences(result.rows);
  }

  private async projectWithClient(
    client: PoolClient,
    reminderId: string,
    now: Date,
  ): Promise<MedicationReminderProjection> {
    const reminder = (
      await client.query<ReminderRow>(`${reminderSelection} WHERE reminder_id = $1`, [reminderId])
    ).rows[0]!;
    const occurrences = await client.query<OccurrenceRow>(
      `${occurrenceSelection}
       WHERE reminder_id = $1
         AND schedule_version = (
           SELECT MAX(candidate.schedule_version)
           FROM care_medication_reminder_occurrences AS candidate
           WHERE candidate.reminder_id = $1
         )
       ORDER BY occurrence_number`,
      [reminderId],
    );
    return projectReminder(reminder, occurrences.rows, now);
  }

  private async lock(
    client: PoolClient,
    recipientContextId: string,
    operation: string,
    keyDigest: string,
  ): Promise<void> {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `medication-recipient:${recipientContextId}`,
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `medication:${operation}:${keyDigest}`,
    ]);
  }

  private async readIdempotency(
    client: PoolClient,
    operation: string,
    actorId: string,
    keyDigest: string,
  ): Promise<IdempotencyRow | undefined> {
    const result = await client.query<IdempotencyRow>(
      `SELECT request_hash, response_body FROM care_idempotency
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
    statusCode: number,
    response: unknown,
    now: Date,
  ): Promise<void> {
    await client.query(
      `INSERT INTO care_idempotency (
        operation, actor_id, idempotency_key, request_hash,
        response_status, response_body, created_at, expires_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::timestamptz,$7::timestamptz + INTERVAL '24 hours')`,
      [operation, actorId, keyDigest, requestHash, statusCode, JSON.stringify(response), now],
    );
  }

  private async writeTransition(
    client: PoolClient,
    reminderId: string,
    version: number,
    action: "created" | "changed" | "disabled",
    actorId: string,
    correlationId: string,
    now: Date,
  ): Promise<void> {
    await client.query(
      `INSERT INTO care_medication_reminder_transitions (
        transition_id, reminder_id, reminder_version, action,
        actor_id, occurred_at, correlation_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [this.id("transition"), reminderId, version, action, actorId, now, correlationId],
    );
  }

  private async writeAudit(
    client: PoolClient,
    reminderId: string,
    householdId: string,
    action: string,
    authorization: CoordinationAuthorizationDecision,
    correlationId: string,
    now: Date,
  ): Promise<void> {
    await client.query(
      `INSERT INTO care_audit (
        audit_id, actor_id, household_id, action, resource_type,
        resource_id, result, occurred_at, correlation_id, metadata
      ) VALUES ($1,$2,$3,$4,'medication_reminder',$5,'success',$6,$7,$8)`,
      [
        this.id("audit"),
        authorization.actor.actorId,
        householdId,
        action,
        reminderId,
        now,
        correlationId,
        JSON.stringify({ decisionId: authorization.decisionId }),
      ],
    );
  }

  private log(operation: string, correlationId: string, result: "success" | "failed"): void {
    this.logger.emit({
      level: result === "success" ? "info" : "warn",
      eventName: operation,
      operation,
      result,
      correlationId,
    });
  }
}

export function resolveMedicationOccurrences(
  schedule: MedicationReminderSchedule,
): ResolvedMedicationOccurrence[] {
  const recurrence = schedule.recurrence;
  const count = recurrence.frequency === "none" ? 1 : recurrence.occurrenceCount;
  const occurrences: ResolvedMedicationOccurrence[] = [];
  for (let index = 0; index < count; index += 1) {
    const days =
      recurrence.frequency === "daily"
        ? recurrence.intervalDays * index
        : recurrence.frequency === "weekly"
          ? recurrence.intervalWeeks * 7 * index
          : 0;
    const localStart = addLocalDays(schedule.localStart, days);
    const candidates = localCandidates(localStart, schedule.sourceTimeZone);
    if (candidates.length === 0) {
      throw new CareError(
        400,
        "MEDICATION_REMINDER_LOCAL_TIME_INVALID",
        "medication_reminder.local_time_invalid",
        false,
        { localStart: "nonexistent" },
      );
    }
    if (candidates.length === 1 && schedule.ambiguousTimePolicy !== null) {
      throw new CareError(
        400,
        "MEDICATION_REMINDER_LOCAL_TIME_INVALID",
        "medication_reminder.local_time_invalid",
        false,
        { ambiguousTimePolicy: "not_applicable" },
      );
    }
    if (candidates.length > 1 && schedule.ambiguousTimePolicy === null) {
      throw new CareError(
        400,
        "MEDICATION_REMINDER_LOCAL_TIME_INVALID",
        "medication_reminder.local_time_invalid",
        false,
        { ambiguousTimePolicy: "required" },
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
        "MEDICATION_REMINDER_LOCAL_TIME_INVALID",
        "medication_reminder.local_time_invalid",
        false,
        { sourceUtcOffset: "mismatch" },
      );
    }
    occurrences.push({ localStart, scheduledAt: selected, offset });
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
  const offsetMinutes = Math.round(
    (Date.UTC(year!, month! - 1, day, hour, minute) - instant.getTime()) / 60_000,
  );
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

function addLocalDays(localStart: string, days: number): string {
  const [datePart, timePart] = localStart.split("T");
  const [year, month, day] = datePart!.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + days));
  return `${date.toISOString().slice(0, 10)}T${timePart}`;
}

function recurrenceColumns(
  schedule: MedicationReminderSchedule,
  resolved: ResolvedMedicationOccurrence[],
) {
  return {
    frequency: schedule.recurrence.frequency,
    interval:
      schedule.recurrence.frequency === "daily"
        ? schedule.recurrence.intervalDays
        : schedule.recurrence.frequency === "weekly"
          ? schedule.recurrence.intervalWeeks
          : null,
    finalLocalDate: resolved.at(-1)!.localStart.slice(0, 10),
  };
}

function projectReminder(
  row: ReminderRow,
  occurrences: OccurrenceRow[],
  now: Date,
): MedicationReminderProjection {
  const recurrence =
    row.recurrence_frequency === "daily"
      ? {
          frequency: "daily" as const,
          intervalDays: row.recurrence_interval!,
          occurrenceCount: row.occurrence_count,
        }
      : row.recurrence_frequency === "weekly"
        ? {
            frequency: "weekly" as const,
            intervalWeeks: row.recurrence_interval!,
            occurrenceCount: row.occurrence_count,
          }
        : { frequency: "none" as const };
  return MedicationReminderProjectionSchema.parse({
    reminderId: row.reminder_id,
    householdId: row.household_id,
    recipientContextId: row.recipient_context_id,
    medicationLabel: row.medication_label,
    amount: row.amount,
    unit: row.unit,
    otherUnitLabel: row.other_unit_label,
    sourceLocalStart: row.source_local_start,
    sourceTimeZone: row.source_time_zone,
    sourceUtcOffset: row.source_utc_offset,
    ambiguousTimePolicy: row.ambiguous_time_policy,
    recurrence,
    status: row.status,
    version: row.version,
    occurrences: occurrences.map((occurrence) => ({
      occurrenceId: occurrence.occurrence_id,
      reminderId: occurrence.reminder_id,
      scheduleVersion: occurrence.schedule_version,
      occurrenceNumber: occurrence.occurrence_number,
      occurrenceCount: occurrence.occurrence_count,
      sourceLocalStart: occurrence.source_local_start,
      sourceTimeZone: occurrence.source_time_zone,
      sourceUtcOffset: occurrence.source_utc_offset,
      scheduledAtUtc: occurrence.scheduled_at_utc.toISOString(),
      recurrenceFinalLocalDate: dateOnly(occurrence.recurrence_final_local_date),
      state: occurrence.state,
      notificationIntent: occurrence.notification_intent,
    })),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    disabledAt: row.disabled_at?.toISOString() ?? null,
    confirmedAt: now.toISOString(),
  });
}

function groupOccurrences(rows: OccurrenceRow[]): Map<string, OccurrenceRow[]> {
  const result = new Map<string, OccurrenceRow[]>();
  for (const row of rows)
    result.set(row.reminder_id, [...(result.get(row.reminder_id) ?? []), row]);
  return result;
}

function dateOnly(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
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

function idempotencyConflict(): CareError {
  return new CareError(409, "IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict");
}
