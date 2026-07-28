import { createHash, randomUUID } from "node:crypto";

import {
  AuditHistoryProjectionSchema,
  ConsentGrantProjectionSchema,
  ConsentOverviewProjectionSchema,
  ConsentSubjectProjectionSchema,
  ConsentTransitionEventSchema,
  CoordinationAuthorizationDecisionSchema,
  CoordinationAuthorizationRequestSchema,
  EstablishConsentSubjectRequestSchema,
  GovernedRecipientContextProjectionSchema,
  GrantConsentRequestSchema,
  NarrowConsentRequestSchema,
  PrivacyPreferencesProjectionSchema,
  RevokeConsentRequestSchema,
  UpdatePrivacyPreferencesSchema,
  type AuditHistoryProjection,
  type AuditHistoryQuery,
  type ConsentGrantProjection,
  type ConsentOverviewProjection,
  type ConsentScope,
  type ConsentSubjectProjection,
  type CoordinationActor,
  type CoordinationAuthorizationDecision,
  type CoordinationAuthorizationRequest,
  type EstablishConsentSubjectRequest,
  type GovernedRecipientContextProjection,
  type GrantConsentRequest,
  type NarrowConsentRequest,
  type PrivacyPreferencesProjection,
  type RevokeConsentRequest,
  type UpdatePrivacyPreferences,
} from "@lifebridge/contracts";
import {
  SafeLogger,
  SafeMetrics,
  SafeTracer,
  type PrivacySafeOperation,
  type TelemetryResult,
} from "@lifebridge/observability";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { keyedDigest, openSecret, sealSecret } from "./crypto.js";
import { IdentityError } from "./errors.js";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
const AUDIT_RETENTION_MS = 90 * 24 * 60 * 60_000;
const CURSOR_TTL_MS = 15 * 60_000;

interface SubjectRow extends QueryResultRow {
  subject_id: string;
  household_id: string;
  recipient_context_id: string;
  account_id: string;
  version: number;
  established_at: Date;
}

interface GrantRow extends QueryResultRow {
  grant_id: string;
  subject_id: string;
  grantee_account_id: string;
  purpose: "household_coordination";
  scopes: ConsentScope[];
  state: "active" | "revoked";
  effective_at: Date;
  revoked_effective_at: Date | null;
  display_time_zone: string;
  version: number;
}

interface AuditRow extends QueryResultRow {
  audit_id: string;
  category:
    | "consent.subject_established"
    | "consent.granted"
    | "consent.narrowed"
    | "consent.revoked"
    | "recipient_context.access_allowed"
    | "recipient_context.access_denied"
    | "privacy.confirmed";
  actor_account_id: string | null;
  outcome: "confirmed" | "allowed" | "denied";
  occurred_at: Date;
}

interface ConsentServiceOptions {
  rateLimitKey: Buffer;
  cursorKey: Buffer;
  now?: () => Date;
  id?: (prefix: string) => string;
  logger?: SafeLogger;
  metrics?: SafeMetrics;
  tracer?: SafeTracer;
}

export class ConsentService {
  private readonly now: () => Date;
  private readonly id: (prefix: string) => string;
  private readonly logger: SafeLogger;
  private readonly metrics: SafeMetrics;
  private readonly tracer: SafeTracer;

  public constructor(
    private readonly pool: Pool,
    private readonly options: ConsentServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? ((prefix) => `${prefix}_${randomUUID().replaceAll("-", "")}`);
    this.logger = options.logger ?? new SafeLogger("identity-consent");
    this.metrics = options.metrics ?? new SafeMetrics("identity-consent");
    this.tracer = options.tracer ?? new SafeTracer("identity-consent");
  }

  public async establishSubject(input: {
    accountId: string;
    householdId: string;
    request: EstablishConsentSubjectRequest;
    correlationId: string;
  }): Promise<ConsentSubjectProjection> {
    const request = EstablishConsentSubjectRequestSchema.parse(input.request);
    return this.observed("consent.bind", input.correlationId, async () => {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
          `consent-subject:${input.householdId}`,
        ]);
        await this.requireActiveMember(client, input.accountId, input.householdId);

        const existing = await client.query<SubjectRow>(
          `SELECT * FROM identity_consent_subjects
           WHERE household_id = $1
           FOR UPDATE`,
          [input.householdId],
        );
        if (existing.rows[0]) {
          const row = existing.rows[0];
          if (
            row.account_id !== input.accountId ||
            row.recipient_context_id !== request.recipientContextId
          ) {
            throw inaccessible();
          }
          await client.query("COMMIT");
          return this.subjectProjection(row);
        }

        const context = await client.query<{
          recipient_context_id: string;
          created_by_account_id: string | null;
        }>(
          `SELECT recipient_context_id, created_by_account_id
           FROM identity_care_recipient_contexts
           WHERE household_id = $1 AND recipient_context_id = $2
           FOR UPDATE`,
          [input.householdId, request.recipientContextId],
        );
        const contextRow = context.rows[0];
        if (!contextRow || contextRow.created_by_account_id !== input.accountId) {
          throw new IdentityError(403, "CONSENT_AUTHORITY_REQUIRED", "consent.authority_required");
        }

        const now = this.now();
        const subjectId = this.id("subject");
        const inserted = await client.query<SubjectRow>(
          `INSERT INTO identity_consent_subjects
           (subject_id, household_id, recipient_context_id, account_id, authority,
            version, established_at, updated_at)
           VALUES ($1, $2, $3, $4, 'self', 1, $5, $5)
           RETURNING *`,
          [subjectId, input.householdId, request.recipientContextId, input.accountId, now],
        );
        await this.audit(
          client,
          subjectId,
          input.accountId,
          null,
          "consent.subject_established",
          "confirmed",
          input.correlationId,
          now,
        );
        await client.query("COMMIT");
        return this.subjectProjection(inserted.rows[0]!);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    });
  }

  public async overview(input: {
    accountId: string;
    householdId: string;
  }): Promise<ConsentOverviewProjection> {
    const client = await this.pool.connect();
    try {
      await this.requireActiveMember(client, input.accountId, input.householdId);
      const subjectResult = await client.query<SubjectRow>(
        `SELECT * FROM identity_consent_subjects
         WHERE household_id = $1 AND account_id = $2`,
        [input.householdId, input.accountId],
      );
      const subject = subjectResult.rows[0];
      if (!subject) {
        return ConsentOverviewProjectionSchema.parse({
          authority: "unbound",
          subject: null,
          eligibleRecipients: [],
          grants: [],
          serverTime: this.now().toISOString(),
        });
      }
      const [members, grants] = await Promise.all([
        client.query<{ account_id: string; role: "organizer" | "caregiver" | "member" }>(
          `SELECT account_id, role FROM identity_household_memberships
           WHERE household_id = $1 AND status = 'active' AND account_id <> $2
           ORDER BY created_at ASC LIMIT 25`,
          [input.householdId, input.accountId],
        ),
        client.query<GrantRow>(
          `SELECT * FROM identity_consent_grants
           WHERE subject_id = $1
           ORDER BY updated_at DESC, grant_id DESC LIMIT 25`,
          [subject.subject_id],
        ),
      ]);
      return ConsentOverviewProjectionSchema.parse({
        authority: "self",
        subject: this.subjectProjection(subject),
        eligibleRecipients: members.rows.map((row) => ({
          recipientRef: this.recipientRef(subject.subject_id, row.account_id),
          role: row.role,
          displayKey: "consent.recipient.household_member",
        })),
        grants: grants.rows.map((row) => this.grantProjection(row)),
        serverTime: this.now().toISOString(),
      });
    } finally {
      client.release();
    }
  }

  public async grant(input: {
    accountId: string;
    householdId: string;
    request: GrantConsentRequest;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<ConsentGrantProjection> {
    const request = GrantConsentRequestSchema.parse(input.request);
    return this.command(
      "consent.grant",
      input,
      request,
      async (client, subject, now, afterVersion) => {
        const granteeAccountId = await this.resolveRecipientRef(
          client,
          input.householdId,
          subject.subject_id,
          input.accountId,
          request.recipientRef,
        );
        const active = await client.query(
          `SELECT 1 FROM identity_consent_grants
           WHERE subject_id = $1 AND grantee_account_id = $2
             AND purpose = $3 AND state = 'active'`,
          [subject.subject_id, granteeAccountId, request.purpose],
        );
        if (active.rows[0]) throw conflict();

        const grantId = this.id("grant");
        const result = await client.query<GrantRow>(
          `INSERT INTO identity_consent_grants
           (grant_id, subject_id, grantee_account_id, purpose, scopes, state,
            effective_at, revoked_effective_at, display_time_zone, version,
            created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'active', $6, NULL, $7, 1, $6, $6)
           RETURNING *`,
          [
            grantId,
            subject.subject_id,
            granteeAccountId,
            request.purpose,
            sortedScopes(request.scopes),
            now,
            request.effectiveTime.displayTimeZone,
          ],
        );
        const row = result.rows[0]!;
        await this.recordTransition(
          client,
          subject,
          row,
          "grant",
          sortedScopes(request.scopes),
          now,
          afterVersion,
          input.correlationId,
        );
        return this.grantProjection(row);
      },
    );
  }

  public async narrow(input: {
    accountId: string;
    householdId: string;
    grantId: string;
    request: NarrowConsentRequest;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<ConsentGrantProjection> {
    const request = NarrowConsentRequestSchema.parse(input.request);
    return this.command(
      "consent.narrow",
      input,
      { grantId: input.grantId, ...request },
      async (client, subject, now, afterVersion) => {
        const current = await this.requireGrant(client, subject.subject_id, input.grantId);
        if (current.state !== "active" || current.version !== request.expectedGrantVersion) {
          throw conflict();
        }
        const prior = new Set(current.scopes);
        const next = new Set(request.scopes);
        if (next.size >= prior.size || [...next].some((scope) => !prior.has(scope))) {
          throw new IdentityError(
            409,
            "CONSENT_SCOPE_BROADENING_REJECTED",
            "consent.scope_broadening_rejected",
          );
        }
        const scopes = sortedScopes(request.scopes);
        const updated = await client.query<GrantRow>(
          `UPDATE identity_consent_grants
           SET scopes = $2, display_time_zone = $3, version = version + 1,
               updated_at = $4
           WHERE grant_id = $1
           RETURNING *`,
          [input.grantId, scopes, request.effectiveTime.displayTimeZone, now],
        );
        const row = updated.rows[0]!;
        await this.recordTransition(
          client,
          subject,
          row,
          "narrow",
          scopes,
          now,
          afterVersion,
          input.correlationId,
        );
        return this.grantProjection(row);
      },
    );
  }

  public async revoke(input: {
    accountId: string;
    householdId: string;
    grantId: string;
    request: RevokeConsentRequest;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<ConsentGrantProjection> {
    const request = RevokeConsentRequestSchema.parse(input.request);
    return this.command(
      "consent.revoke",
      input,
      { grantId: input.grantId, ...request },
      async (client, subject, now, afterVersion) => {
        const current = await this.requireGrant(client, subject.subject_id, input.grantId);
        if (current.state !== "active" || current.version !== request.expectedGrantVersion) {
          throw conflict();
        }
        const updated = await client.query<GrantRow>(
          `UPDATE identity_consent_grants
           SET state = 'revoked', revoked_effective_at = $2,
               display_time_zone = $3, version = version + 1, updated_at = $2
           WHERE grant_id = $1
           RETURNING *`,
          [input.grantId, now, request.effectiveTime.displayTimeZone],
        );
        const row = updated.rows[0]!;
        await this.recordTransition(
          client,
          subject,
          row,
          "revoke",
          row.scopes,
          now,
          afterVersion,
          input.correlationId,
        );
        return this.grantProjection(row);
      },
    );
  }

  public async governedRecipientContext(input: {
    accountId: string;
    householdId: string;
    scope: ConsentScope;
    correlationId: string;
  }): Promise<GovernedRecipientContextProjection> {
    return this.observed("consent.authorize", input.correlationId, async () => {
      const client = await this.pool.connect();
      let transactionOpen = false;
      try {
        await client.query("BEGIN");
        transactionOpen = true;
        await this.requireActiveMember(client, input.accountId, input.householdId);
        const subjectResult = await client.query<SubjectRow>(
          `SELECT * FROM identity_consent_subjects
           WHERE household_id = $1
           FOR SHARE`,
          [input.householdId],
        );
        const subject = subjectResult.rows[0];
        if (!subject) throw inaccessible();
        const context = await client.query<{
          recipient_context_id: string;
          display_label: string;
          relationship_label: string;
        }>(
          `SELECT recipient_context_id, display_label, relationship_label
           FROM identity_care_recipient_contexts
           WHERE recipient_context_id = $1`,
          [subject.recipient_context_id],
        );
        if (!context.rows[0]) throw inaccessible();

        let grantId: string | null = null;
        if (subject.account_id !== input.accountId) {
          const decisionTime = this.now();
          const grant = await client.query<{ grant_id: string }>(
            `SELECT grant_id FROM identity_consent_grants
             WHERE subject_id = $1 AND grantee_account_id = $2
               AND purpose = 'household_coordination'
               AND state = 'active' AND effective_at <= $3
               AND revoked_effective_at IS NULL
               AND $4 = ANY(scopes)
             ORDER BY effective_at DESC LIMIT 1`,
            [subject.subject_id, input.accountId, decisionTime, input.scope],
          );
          if (!grant.rows[0]) {
            await this.audit(
              client,
              subject.subject_id,
              input.accountId,
              null,
              "recipient_context.access_denied",
              "denied",
              input.correlationId,
              decisionTime,
            );
            await client.query("COMMIT");
            transactionOpen = false;
            throw inaccessible();
          }
          grantId = grant.rows[0].grant_id;
        }

        const now = this.now();
        await this.audit(
          client,
          subject.subject_id,
          input.accountId,
          grantId,
          "recipient_context.access_allowed",
          "allowed",
          input.correlationId,
          now,
        );
        const value =
          input.scope === "recipient_context.basic_label"
            ? context.rows[0].display_label
            : context.rows[0].relationship_label;
        await client.query("COMMIT");
        transactionOpen = false;
        return GovernedRecipientContextProjectionSchema.parse({
          recipientContextId: context.rows[0].recipient_context_id,
          householdId: input.householdId,
          scope: input.scope,
          value,
          grantId,
          authorizedAt: now.toISOString(),
        });
      } catch (error) {
        if (transactionOpen) {
          await client.query("ROLLBACK");
        }
        throw error;
      } finally {
        client.release();
      }
    });
  }

  public async authorizeCoordination(input: {
    accountId: string;
    request: CoordinationAuthorizationRequest;
    correlationId: string;
  }): Promise<CoordinationAuthorizationDecision> {
    const request = CoordinationAuthorizationRequestSchema.parse(input.request);
    return this.observed("coordination.authorize", input.correlationId, async () => {
      const client = await this.pool.connect();
      let transactionOpen = false;
      try {
        await client.query("BEGIN");
        transactionOpen = true;
        await this.requireActiveMember(client, input.accountId, request.householdId);

        const subjectResult = await client.query<SubjectRow>(
          `SELECT * FROM identity_consent_subjects
           WHERE household_id = $1
           FOR SHARE`,
          [request.householdId],
        );
        const subject = subjectResult.rows[0];
        if (!subject) throw inaccessible();

        const privacyResult = await client.query<{
          coordination_activity_visibility: "hidden" | "household_only";
          version: number;
        }>(
          `SELECT coordination_activity_visibility, version
           FROM identity_privacy_preferences
           WHERE account_id = $1`,
          [subject.account_id],
        );
        const privacy = privacyResult.rows[0];
        const decisionTime = this.now();

        const grants = await client.query<{
          grant_id: string;
          grantee_account_id: string;
          version: number;
        }>(
          `SELECT grant_id, grantee_account_id, version
           FROM identity_consent_grants
           WHERE subject_id = $1
             AND purpose = 'household_coordination'
             AND state = 'active'
             AND effective_at <= $2
             AND revoked_effective_at IS NULL
             AND 'recipient_context.basic_label' = ANY(scopes)
           ORDER BY effective_at DESC, grant_id`,
          [subject.subject_id, decisionTime],
        );
        const grantsByAccount = new Map(grants.rows.map((row) => [row.grantee_account_id, row]));
        const actorGrant = grantsByAccount.get(input.accountId);
        const actorIsSubject = subject.account_id === input.accountId;
        if (
          !actorIsSubject &&
          (!actorGrant || privacy?.coordination_activity_visibility !== "household_only")
        ) {
          await this.audit(
            client,
            subject.subject_id,
            input.accountId,
            actorGrant?.grant_id ?? null,
            "recipient_context.access_denied",
            "denied",
            input.correlationId,
            decisionTime,
          );
          await client.query("COMMIT");
          transactionOpen = false;
          throw inaccessible();
        }

        const members = await client.query<{ account_id: string }>(
          `SELECT account_id
           FROM identity_household_memberships
           WHERE household_id = $1 AND status = 'active'
           ORDER BY account_id`,
          [request.householdId],
        );
        const eligibleAccounts = members.rows
          .map((row) => row.account_id)
          .filter(
            (accountId) =>
              accountId === subject.account_id ||
              (privacy?.coordination_activity_visibility === "household_only" &&
                grantsByAccount.has(accountId)),
          );
        const actorFor = (accountId: string): CoordinationActor => ({
          actorId: accountId,
          actorRef: this.recipientRef(subject.subject_id, accountId),
          displayKey:
            accountId === input.accountId
              ? "coordination.actor.you"
              : "coordination.actor.household_member",
          subject: accountId === subject.account_id,
        });
        const actor = actorFor(input.accountId);
        const carePlanPermission = request.permission.startsWith("coordination.care_plan.");
        const eligibleTargets = carePlanPermission
          ? eligibleAccounts.map(actorFor)
          : request.permission === "coordination.task.handoff"
            ? eligibleAccounts.filter((accountId) => accountId !== input.accountId).map(actorFor)
            : [];
        const target = request.targetActorRef
          ? eligibleTargets.find((candidate) => candidate.actorRef === request.targetActorRef)
          : null;
        if (request.targetActorRef && !target) {
          await this.audit(
            client,
            subject.subject_id,
            input.accountId,
            actorGrant?.grant_id ?? null,
            "recipient_context.access_denied",
            "denied",
            input.correlationId,
            decisionTime,
          );
          await client.query("COMMIT");
          transactionOpen = false;
          throw inaccessible();
        }

        await this.audit(
          client,
          subject.subject_id,
          input.accountId,
          actorGrant?.grant_id ?? null,
          "recipient_context.access_allowed",
          "allowed",
          input.correlationId,
          decisionTime,
        );
        const decision = CoordinationAuthorizationDecisionSchema.parse({
          decisionId: this.id("decision"),
          permission: request.permission,
          actor,
          householdId: request.householdId,
          recipientContextId: subject.recipient_context_id,
          subjectId: subject.subject_id,
          subjectVersion: subject.version,
          grantId: actorGrant?.grant_id ?? null,
          grantVersion: actorGrant?.version ?? null,
          privacyVersion: privacy?.version ?? null,
          target: target ?? null,
          eligibleTargets,
          decidedAt: decisionTime.toISOString(),
          correlationId: input.correlationId,
          requestDigest: request.requestDigest,
        });
        await client.query("COMMIT");
        transactionOpen = false;
        return decision;
      } catch (error) {
        if (transactionOpen) await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    });
  }

  public async auditHistory(input: {
    accountId: string;
    householdId: string;
    query: AuditHistoryQuery;
    correlationId: string;
  }): Promise<AuditHistoryProjection> {
    return this.observed("audit.read", input.correlationId, async () => {
      const client = await this.pool.connect();
      try {
        const subject = await this.requireSubject(client, input.accountId, input.householdId);
        const boundary = input.query.cursor
          ? this.openCursor(input.query.cursor, input.accountId, subject.subject_id, input.query)
          : null;
        const values: unknown[] = [
          subject.subject_id,
          new Date(this.now().getTime() - AUDIT_RETENTION_MS),
        ];
        const where = ["subject_id = $1", "occurred_at >= $2"];
        if (input.query.category) {
          values.push(input.query.category);
          where.push(`category = $${values.length}`);
        }
        if (input.query.from) {
          values.push(input.query.from);
          where.push(`occurred_at >= $${values.length}`);
        }
        if (input.query.to) {
          values.push(input.query.to);
          where.push(`occurred_at <= $${values.length}`);
        }
        if (boundary) {
          values.push(boundary.occurredAt, boundary.auditId);
          where.push(
            `(occurred_at, audit_id) < ($${values.length - 1}::timestamptz, $${values.length})`,
          );
        }
        values.push(input.query.limit + 1);
        const result = await client.query<AuditRow>(
          `SELECT audit_id, category, actor_account_id, outcome, occurred_at
           FROM identity_consent_audit
           WHERE ${where.join(" AND ")}
           ORDER BY occurred_at DESC, audit_id DESC
           LIMIT $${values.length}`,
          values,
        );
        const hasMore = result.rows.length > input.query.limit;
        const rows = result.rows.slice(0, input.query.limit);
        const last = rows.at(-1);
        return AuditHistoryProjectionSchema.parse({
          items: rows.map((row) => ({
            eventRef: row.audit_id,
            category: row.category,
            actorAlias:
              row.actor_account_id === input.accountId
                ? "your_account"
                : row.actor_account_id
                  ? "household_member"
                  : "protected",
            redaction: "protected",
            occurredAt: row.occurred_at.toISOString(),
            displayTimeZone: input.query.displayTimeZone,
            outcome: row.outcome,
          })),
          nextCursor:
            hasMore && last
              ? this.sealCursor(
                  input.accountId,
                  subject.subject_id,
                  input.query,
                  last.occurred_at,
                  last.audit_id,
                )
              : null,
        });
      } finally {
        client.release();
      }
    });
  }

  public async getPrivacy(input: { accountId: string }): Promise<PrivacyPreferencesProjection> {
    const client = await this.pool.connect();
    try {
      const now = this.now();
      const result = await client.query<{
        profile_visibility: "private" | "household_only";
        coordination_activity_visibility: "hidden" | "household_only";
        access_alerts: boolean;
        version: number;
        confirmed_at: Date;
      }>(
        `INSERT INTO identity_privacy_preferences
         (account_id, profile_visibility, coordination_activity_visibility,
          access_alerts, version, confirmed_at, updated_at)
         VALUES ($1, 'private', 'hidden', TRUE, 1, $2, $2)
         ON CONFLICT (account_id) DO UPDATE SET account_id = EXCLUDED.account_id
         RETURNING *`,
        [input.accountId, now],
      );
      return this.privacyProjection(result.rows[0]!);
    } finally {
      client.release();
    }
  }

  public async updatePrivacy(input: {
    accountId: string;
    request: UpdatePrivacyPreferences;
    correlationId: string;
  }): Promise<PrivacyPreferencesProjection> {
    const request = UpdatePrivacyPreferencesSchema.parse(input.request);
    return this.observed("privacy.update", input.correlationId, async () => {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        const current = await client.query<{ version: number }>(
          `SELECT version FROM identity_privacy_preferences
           WHERE account_id = $1 FOR UPDATE`,
          [input.accountId],
        );
        const version = current.rows[0]?.version ?? 1;
        if (version !== request.expectedVersion) {
          throw new IdentityError(409, "PRIVACY_VERSION_CONFLICT", "privacy.conflict");
        }
        const now = this.now();
        const result = await client.query<{
          profile_visibility: "private" | "household_only";
          coordination_activity_visibility: "hidden" | "household_only";
          access_alerts: boolean;
          version: number;
          confirmed_at: Date;
        }>(
          `INSERT INTO identity_privacy_preferences
           (account_id, profile_visibility, coordination_activity_visibility,
            access_alerts, version, confirmed_at, updated_at)
           VALUES ($1, $2, $3, $4, 2, $5, $5)
           ON CONFLICT (account_id) DO UPDATE SET
             profile_visibility = EXCLUDED.profile_visibility,
             coordination_activity_visibility = EXCLUDED.coordination_activity_visibility,
             access_alerts = EXCLUDED.access_alerts,
             version = identity_privacy_preferences.version + 1,
             confirmed_at = EXCLUDED.confirmed_at,
             updated_at = EXCLUDED.updated_at
           RETURNING *`,
          [
            input.accountId,
            request.profileVisibility,
            request.coordinationActivityVisibility,
            request.accessAlerts,
            now,
          ],
        );
        const subject = await client.query<{ subject_id: string }>(
          `SELECT subject_id FROM identity_consent_subjects WHERE account_id = $1`,
          [input.accountId],
        );
        if (subject.rows.length === 0) {
          await this.audit(
            client,
            null,
            input.accountId,
            null,
            "privacy.confirmed",
            "confirmed",
            input.correlationId,
            now,
          );
        } else {
          for (const row of subject.rows) {
            await this.audit(
              client,
              row.subject_id,
              input.accountId,
              null,
              "privacy.confirmed",
              "confirmed",
              input.correlationId,
              now,
            );
          }
        }
        await client.query("COMMIT");
        return this.privacyProjection(result.rows[0]!);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    });
  }

  private async command<TRequest>(
    operation: "consent.grant" | "consent.narrow" | "consent.revoke",
    input: {
      accountId: string;
      householdId: string;
      idempotencyKey: string;
      correlationId: string;
      request: unknown;
    },
    canonicalRequest: TRequest,
    work: (
      client: PoolClient,
      subject: SubjectRow,
      now: Date,
      afterVersion: number,
    ) => Promise<ConsentGrantProjection>,
  ): Promise<ConsentGrantProjection> {
    return this.observed(operation, input.correlationId, async () => {
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        const subject = await this.requireSubject(client, input.accountId, input.householdId, true);
        const keyDigest = keyedDigest(
          this.options.rateLimitKey,
          `consent-idempotency:${operation}:${input.idempotencyKey}`,
        );
        const requestDigest = digestJson(canonicalRequest);
        const idempotencyNow = this.now();
        const replay = await client.query<{
          request_digest: string;
          response_json: ConsentGrantProjection;
        }>(
          `SELECT request_digest, response_json
           FROM identity_consent_idempotency
           WHERE subject_id = $1 AND operation = $2
             AND idempotency_key_digest = $3 AND expires_at > $4
           FOR UPDATE`,
          [subject.subject_id, operation, keyDigest, idempotencyNow],
        );
        if (replay.rows[0]) {
          if (replay.rows[0].request_digest !== requestDigest) {
            throw new IdentityError(409, "IDEMPOTENCY_CONFLICT", "idempotency.conflict");
          }
          await client.query("COMMIT");
          return ConsentGrantProjectionSchema.parse(replay.rows[0].response_json);
        }
        await client.query(
          `DELETE FROM identity_consent_idempotency
           WHERE subject_id = $1 AND operation = $2
             AND idempotency_key_digest = $3 AND expires_at <= $4`,
          [subject.subject_id, operation, keyDigest, idempotencyNow],
        );

        const expectedSubjectVersion = Number(
          (canonicalRequest as { expectedSubjectVersion?: number }).expectedSubjectVersion,
        );
        if (subject.version !== expectedSubjectVersion) throw conflict();
        const now = this.now();
        const afterVersion = subject.version + 1;
        const projection = await work(client, subject, now, afterVersion);
        await client.query(
          `UPDATE identity_consent_subjects
           SET version = $2, updated_at = $3 WHERE subject_id = $1`,
          [subject.subject_id, afterVersion, now],
        );
        await client.query(
          `INSERT INTO identity_consent_idempotency
           (subject_id, operation, idempotency_key_digest, request_digest,
            response_json, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            subject.subject_id,
            operation,
            keyDigest,
            requestDigest,
            JSON.stringify(projection),
            now,
            new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
          ],
        );
        await client.query("COMMIT");
        return projection;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    });
  }

  private async recordTransition(
    client: PoolClient,
    subject: SubjectRow,
    grant: GrantRow,
    action: "grant" | "narrow" | "revoke",
    scopes: ConsentScope[],
    now: Date,
    subjectVersion: number,
    correlationId: string,
  ) {
    const transitionId = this.id("transition");
    const eventId = this.id("event");
    const causationId = this.id("command");
    await client.query(
      `INSERT INTO identity_consent_transitions
       (transition_id, subject_id, grant_id, action, purpose, scopes,
        subject_version, grant_version, effective_at, correlation_id, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $9)`,
      [
        transitionId,
        subject.subject_id,
        grant.grant_id,
        action,
        grant.purpose,
        action === "revoke" ? [] : scopes,
        subjectVersion,
        grant.version,
        now,
        correlationId,
      ],
    );
    const event = ConsentTransitionEventSchema.parse({
      eventId,
      eventType: `identity.consent.${transitionPast(action)}.v1`,
      eventVersion: 1,
      producer: "identity-consent",
      aggregateId: subject.subject_id,
      aggregateVersion: subjectVersion,
      grantId: grant.grant_id,
      grantVersion: grant.version,
      action,
      purpose: grant.purpose,
      scopes: action === "revoke" ? [] : scopes,
      effectiveAt: now.toISOString(),
      occurredAt: now.toISOString(),
      correlationId,
      causationId,
    });
    await client.query(
      `INSERT INTO identity_consent_outbox
       (event_id, subject_id, grant_id, event_type, event_version,
        event_json, occurred_at)
       VALUES ($1, $2, $3, $4, 1, $5, $6)`,
      [eventId, subject.subject_id, grant.grant_id, event.eventType, JSON.stringify(event), now],
    );
    await this.audit(
      client,
      subject.subject_id,
      subject.account_id,
      grant.grant_id,
      `consent.${transitionPast(action)}` as
        "consent.granted" | "consent.narrowed" | "consent.revoked",
      "confirmed",
      correlationId,
      now,
    );
  }

  private async requireSubject(
    client: PoolClient,
    accountId: string,
    householdId: string,
    lock = false,
  ): Promise<SubjectRow> {
    const result = await client.query<SubjectRow>(
      `SELECT s.* FROM identity_consent_subjects s
       JOIN identity_household_memberships m
         ON m.household_id = s.household_id AND m.account_id = s.account_id
       WHERE s.household_id = $1 AND s.account_id = $2
         AND m.status = 'active'
       ${lock ? "FOR UPDATE OF s" : ""}`,
      [householdId, accountId],
    );
    if (!result.rows[0]) throw inaccessible();
    return result.rows[0];
  }

  private async requireGrant(
    client: PoolClient,
    subjectId: string,
    grantId: string,
  ): Promise<GrantRow> {
    const result = await client.query<GrantRow>(
      `SELECT * FROM identity_consent_grants
       WHERE subject_id = $1 AND grant_id = $2 FOR UPDATE`,
      [subjectId, grantId],
    );
    if (!result.rows[0]) throw inaccessible();
    return result.rows[0];
  }

  private async requireActiveMember(client: PoolClient, accountId: string, householdId: string) {
    const result = await client.query(
      `SELECT 1 FROM identity_household_memberships
       WHERE household_id = $1 AND account_id = $2 AND status = 'active'`,
      [householdId, accountId],
    );
    if (!result.rows[0]) throw inaccessible();
  }

  private async resolveRecipientRef(
    client: PoolClient,
    householdId: string,
    subjectId: string,
    subjectAccountId: string,
    recipientRef: string,
  ): Promise<string> {
    const members = await client.query<{ account_id: string }>(
      `SELECT account_id FROM identity_household_memberships
       WHERE household_id = $1 AND status = 'active' AND account_id <> $2
       ORDER BY created_at ASC LIMIT 25`,
      [householdId, subjectAccountId],
    );
    const match = members.rows.find(
      (member) => this.recipientRef(subjectId, member.account_id) === recipientRef,
    );
    if (!match) throw inaccessible();
    return match.account_id;
  }

  private recipientRef(subjectId: string, accountId: string): string {
    return `member_${keyedDigest(
      this.options.rateLimitKey,
      `consent:${subjectId}:${accountId}`,
    ).slice(0, 24)}`;
  }

  private subjectProjection(row: SubjectRow): ConsentSubjectProjection {
    return ConsentSubjectProjectionSchema.parse({
      subjectId: row.subject_id,
      householdId: row.household_id,
      recipientContextId: row.recipient_context_id,
      authority: "self",
      version: row.version,
      establishedAt: row.established_at.toISOString(),
    });
  }

  private grantProjection(row: GrantRow): ConsentGrantProjection {
    return ConsentGrantProjectionSchema.parse({
      grantId: row.grant_id,
      subjectId: row.subject_id,
      recipientRef: this.recipientRef(row.subject_id, row.grantee_account_id),
      recipientDisplayKey: "consent.recipient.household_member",
      purpose: row.purpose,
      scopes: sortedScopes(row.scopes),
      state: row.state,
      effectiveAt: row.effective_at.toISOString(),
      revokedEffectiveAt: row.revoked_effective_at?.toISOString() ?? null,
      displayTimeZone: row.display_time_zone,
      version: row.version,
    });
  }

  private privacyProjection(row: {
    profile_visibility: "private" | "household_only";
    coordination_activity_visibility: "hidden" | "household_only";
    access_alerts: boolean;
    version: number;
    confirmed_at: Date;
  }): PrivacyPreferencesProjection {
    return PrivacyPreferencesProjectionSchema.parse({
      profileVisibility: row.profile_visibility,
      coordinationActivityVisibility: row.coordination_activity_visibility,
      accessAlerts: row.access_alerts,
      version: row.version,
      confirmedAt: row.confirmed_at.toISOString(),
    });
  }

  private async audit(
    client: PoolClient,
    subjectId: string | null,
    actorAccountId: string | null,
    grantId: string | null,
    category: AuditRow["category"],
    outcome: AuditRow["outcome"],
    correlationId: string,
    occurredAt: Date,
  ) {
    await client.query(
      `INSERT INTO identity_consent_audit
       (audit_id, subject_id, actor_account_id, grant_id, category, outcome,
        redaction, correlation_id, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'protected', $7, $8)`,
      [
        this.id("audit"),
        subjectId,
        actorAccountId,
        grantId,
        category,
        outcome,
        correlationId,
        occurredAt,
      ],
    );
  }

  private sealCursor(
    accountId: string,
    subjectId: string,
    query: AuditHistoryQuery,
    occurredAt: Date,
    auditId: string,
  ): string {
    return sealSecret(
      JSON.stringify({
        accountId,
        subjectId,
        filter: filterDigest(query),
        occurredAt: occurredAt.toISOString(),
        auditId,
        expiresAt: new Date(this.now().getTime() + CURSOR_TTL_MS).toISOString(),
      }),
      this.options.cursorKey,
      "identity-audit-cursor-v1",
    );
  }

  private openCursor(
    cursor: string,
    accountId: string,
    subjectId: string,
    query: AuditHistoryQuery,
  ): { occurredAt: string; auditId: string } {
    try {
      const value = JSON.parse(
        openSecret(cursor, this.options.cursorKey, "identity-audit-cursor-v1"),
      ) as {
        accountId: string;
        subjectId: string;
        filter: string;
        occurredAt: string;
        auditId: string;
        expiresAt: string;
      };
      if (
        value.accountId !== accountId ||
        value.subjectId !== subjectId ||
        value.filter !== filterDigest(query) ||
        new Date(value.expiresAt).getTime() <= this.now().getTime()
      ) {
        throw new Error("cursor_scope");
      }
      return { occurredAt: value.occurredAt, auditId: value.auditId };
    } catch {
      throw new IdentityError(400, "AUDIT_CURSOR_INVALID", "audit.cursor_invalid");
    }
  }

  private async observed<T>(
    operation: PrivacySafeOperation,
    correlationId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const started = performance.now();
    let result: TelemetryResult = "success";
    try {
      return await work();
    } catch (error) {
      result =
        error instanceof IdentityError &&
        (error.statusCode === 403 || error.code === "CONSENT_RESOURCE_NOT_FOUND")
          ? "denied"
          : error instanceof IdentityError && error.statusCode === 409
            ? "conflict"
            : "failed";
      throw error;
    } finally {
      const durationMs = Math.max(0, Math.round(performance.now() - started));
      this.logger.emit({
        level: result === "success" ? "info" : result === "failed" ? "error" : "warn",
        eventName: "privacy_safe_operation",
        operation,
        result,
        correlationId,
        durationMs,
      });
      this.metrics.emit({
        metricName: "lifebridge_operation_total",
        operation,
        result,
        value: 1,
      });
      this.metrics.emit({
        metricName: "lifebridge_operation_duration_ms",
        operation,
        result,
        value: durationMs,
      });
      this.tracer.emit({ operation, result, correlationId, durationMs });
    }
  }
}

function sortedScopes(scopes: readonly ConsentScope[]): ConsentScope[] {
  return [...scopes].sort();
}

function digestJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function filterDigest(query: AuditHistoryQuery): string {
  return digestJson({
    category: query.category ?? null,
    from: query.from ?? null,
    to: query.to ?? null,
  });
}

function conflict(): IdentityError {
  return new IdentityError(409, "CONSENT_VERSION_CONFLICT", "consent.conflict");
}

function transitionPast(action: "grant" | "narrow" | "revoke") {
  return action === "grant" ? "granted" : action === "narrow" ? "narrowed" : "revoked";
}

function inaccessible(): IdentityError {
  return new IdentityError(404, "CONSENT_RESOURCE_NOT_FOUND", "consent.resource_not_found");
}
