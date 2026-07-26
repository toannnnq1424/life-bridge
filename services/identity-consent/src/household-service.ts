import { createHash, randomUUID } from "node:crypto";

import {
  CreateHouseholdInvitationRequestSchema,
  CreateHouseholdRequestSchema,
  type CareRecipientContextProjection,
  type CreateHouseholdInvitationRequest,
  type CreateHouseholdRequest,
  type HouseholdInvitationProjection,
  type HouseholdProjection,
  type UpsertCareRecipientContextRequest,
  UpsertCareRecipientContextRequestSchema,
} from "@lifebridge/contracts";
import { SafeLogger } from "@lifebridge/observability";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { digestSecret, keyedDigest, randomToken } from "./crypto.js";
import { IdentityError } from "./errors.js";

const INVITATION_TTL_MS = 48 * 60 * 60_000;
const RESEND_COOLDOWN_MS = 5 * 60_000;
const MAX_RESENDS = 3;

interface MembershipRow extends QueryResultRow {
  membership_id: string;
  household_id: string;
  account_id: string;
  role: "organizer" | "caregiver" | "member";
  status: "active" | "suspended" | "left";
}

interface InvitationRow extends QueryResultRow {
  invitation_id: string;
  household_id: string;
  invitee_account_id: string | null;
  is_decoy?: boolean;
  role: "caregiver" | "member";
  state: "pending" | "accepted" | "declined" | "expired" | "revoked";
  expires_at: Date;
  resend_count: number;
  last_sent_at: Date;
  version: number;
}

type AfterCommit = (effect: () => void) => void;

export interface HouseholdServiceOptions {
  rateLimitKey: Buffer;
  now?: () => Date;
  id?: (prefix: string) => string;
  logger?: SafeLogger;
}

export class HouseholdService {
  private readonly now: () => Date;
  private readonly id: (prefix: string) => string;
  private readonly logger: SafeLogger;

  public constructor(
    private readonly pool: Pool,
    private readonly options: HouseholdServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? ((prefix) => `${prefix}_${randomUUID().replaceAll("-", "")}`);
    this.logger = options.logger ?? new SafeLogger("identity-consent");
  }

  public async createHousehold(input: {
    accountId: string;
    request: CreateHouseholdRequest;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<HouseholdProjection> {
    const request = CreateHouseholdRequestSchema.parse(input.request);
    return this.mutation(input, "household.create", null, async (client, afterCommit) => {
      const replay = await this.idempotency<HouseholdProjection>(
        client,
        input.accountId,
        "household.create",
        input.idempotencyKey,
        request,
      );
      if (replay) return replay;
      const now = this.now();
      const householdId = this.id("household");
      await client.query(
        `INSERT INTO identity_households
         (household_id, display_label, status, version, created_at, updated_at)
         VALUES ($1, $2, 'active', 1, $3, $3)`,
        [householdId, request.displayLabel, now],
      );
      await client.query(
        `INSERT INTO identity_household_memberships
         (membership_id, household_id, account_id, role, status, version, created_at, updated_at)
         VALUES ($1, $2, $3, 'organizer', 'active', 1, $4, $4)`,
        [this.id("membership"), householdId, input.accountId, now],
      );
      const projection = this.householdProjection(
        householdId,
        request.displayLabel,
        "organizer",
        1,
      );
      await this.storeIdempotency(
        client,
        input.accountId,
        "household.create",
        input.idempotencyKey,
        request,
        projection,
      );
      await this.audit(client, input, "household.create", "success", householdId, "household");
      afterCommit(() => this.log(input, "household.create", "success", householdId, householdId));
      return projection;
    });
  }

  public async createInvitation(input: {
    accountId: string;
    householdId: string;
    request: CreateHouseholdInvitationRequest;
    idempotencyKey: string;
    correlationId: string;
  }): Promise<HouseholdInvitationProjection & { invitationToken?: string }> {
    const request = CreateHouseholdInvitationRequestSchema.parse(input.request);
    return this.mutation(
      input,
      "invitation.create",
      input.householdId,
      async (client, afterCommit) => {
        await this.requireOrganizer(client, input.accountId, input.householdId);
        const replay = await this.idempotency<HouseholdInvitationProjection>(
          client,
          input.accountId,
          `invitation.create:${input.householdId}`,
          input.idempotencyKey,
          request,
        );
        if (replay) return replay;
        const account = await client.query<{ account_id: string }>(
          `SELECT account_id FROM identity_accounts
         WHERE login_name = $1 AND status = 'active'`,
          [request.inviteeLoginName],
        );
        const inviteeAccountId = account.rows[0]?.account_id;
        if (inviteeAccountId) {
          const membership = await client.query(
            `SELECT 1 FROM identity_household_memberships
           WHERE household_id = $1 AND account_id = $2 AND status = 'active'`,
            [input.householdId, inviteeAccountId],
          );
          if (membership.rowCount)
            throw new IdentityError(409, "HOUSEHOLD_CONFLICT", "household.conflict");
        }
        const now = this.now();
        const token = randomToken();
        const invitationId = this.id("invitation");
        const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
        try {
          await client.query(
            `INSERT INTO identity_household_invitations
           (invitation_id, household_id, invitee_account_id, invitee_dimension_digest,
            is_decoy, role, state, token_digest, expires_at, resend_count, last_sent_at, version,
            created_by_account_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8, 0, $9, 1, $10, $9, $9)`,
            [
              invitationId,
              input.householdId,
              inviteeAccountId ?? null,
              keyedDigest(this.options.rateLimitKey, request.inviteeLoginName),
              !inviteeAccountId,
              request.role,
              digestSecret(token),
              expiresAt,
              now,
              input.accountId,
            ],
          );
        } catch (error) {
          if ((error as { code?: string }).code === "23505") {
            throw new IdentityError(409, "HOUSEHOLD_CONFLICT", "household.conflict");
          }
          throw error;
        }
        const projection = {
          ...this.invitationProjection({
            invitation_id: invitationId,
            household_id: input.householdId,
            invitee_account_id: inviteeAccountId ?? null,
            role: request.role,
            state: "pending",
            expires_at: expiresAt,
            resend_count: 0,
            last_sent_at: now,
            version: 1,
          }),
          invitationToken: token,
        };
        await this.storeIdempotency(
          client,
          input.accountId,
          `invitation.create:${input.householdId}`,
          input.idempotencyKey,
          request,
          this.invitationProjection({
            invitation_id: invitationId,
            household_id: input.householdId,
            invitee_account_id: inviteeAccountId ?? null,
            role: request.role,
            state: "pending",
            expires_at: expiresAt,
            resend_count: 0,
            last_sent_at: now,
            version: 1,
          }),
        );
        await this.audit(
          client,
          input,
          "invitation.create",
          "success",
          input.householdId,
          "invitation",
          invitationId,
        );
        afterCommit(() =>
          this.log(input, "invitation.create", "success", input.householdId, invitationId),
        );
        return projection;
      },
    );
  }

  public async getHousehold(input: {
    accountId: string;
    householdId: string;
  }): Promise<HouseholdProjection> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{
        household_id: string;
        display_label: string;
        version: number;
        role: "organizer" | "caregiver" | "member";
      }>(
        `SELECT household.household_id, household.display_label, household.version, membership.role
         FROM identity_households AS household
         INNER JOIN identity_household_memberships AS membership
           ON membership.household_id = household.household_id
         WHERE household.household_id = $1
           AND membership.account_id = $2
           AND household.status = 'active'
           AND membership.status = 'active'`,
        [input.householdId, input.accountId],
      );
      const household = result.rows[0];
      if (!household) throw inaccessible();
      return this.householdProjection(
        household.household_id,
        household.display_label,
        household.role,
        household.version,
      );
    } finally {
      client.release();
    }
  }

  public async respondToInvitation(input: {
    accountId: string;
    invitationToken: string;
    decision: "accepted" | "declined";
    correlationId: string;
  }): Promise<HouseholdInvitationProjection> {
    return this.mutation(
      input,
      `invitation.${input.decision}`,
      null,
      async (client, afterCommit) => {
        const invitation = await this.invitationByToken(client, input.invitationToken);
        if (invitation.invitee_account_id !== input.accountId || invitation.is_decoy) {
          throw inaccessible();
        }
        const expiredNow = await this.expireIfNeeded(client, invitation, input, afterCommit);
        if (!expiredNow && invitation.expires_at.getTime() <= this.now().getTime()) {
          throw inaccessible();
        }
        if (invitation.state !== "pending") return this.invitationProjection(invitation);
        const now = this.now();
        if (input.decision === "accepted") {
          try {
            const membershipId = this.id("membership");
            await client.query(
              `INSERT INTO identity_household_memberships
             (membership_id, household_id, account_id, role, status, version, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'active', 1, $5, $5)`,
              [membershipId, invitation.household_id, input.accountId, invitation.role, now],
            );
            await this.audit(
              client,
              input,
              "membership.grant",
              "success",
              invitation.household_id,
              "membership",
              membershipId,
            );
          } catch (error) {
            if ((error as { code?: string }).code === "23505") {
              throw new IdentityError(409, "HOUSEHOLD_CONFLICT", "household.conflict");
            }
            throw error;
          }
        }
        const updated = await client.query<InvitationRow>(
          `UPDATE identity_household_invitations
         SET state = $2, terminal_at = $3, version = version + 1, updated_at = $3
         WHERE invitation_id = $1
         RETURNING *`,
          [invitation.invitation_id, input.decision, now],
        );
        const projection = this.invitationProjection(updated.rows[0]!);
        await this.audit(
          client,
          input,
          `invitation.${input.decision === "accepted" ? "accept" : "decline"}`,
          "success",
          invitation.household_id,
          "invitation",
          invitation.invitation_id,
        );
        afterCommit(() =>
          this.log(
            input,
            `invitation.${input.decision}`,
            "success",
            invitation.household_id,
            invitation.invitation_id,
          ),
        );
        return projection;
      },
    );
  }

  public async revokeInvitation(input: {
    accountId: string;
    householdId: string;
    invitationId: string;
    expectedVersion: number;
    correlationId: string;
  }): Promise<HouseholdInvitationProjection> {
    return this.transitionManagedInvitation(input, "revoked");
  }

  public async resendInvitation(input: {
    accountId: string;
    householdId: string;
    invitationId: string;
    expectedVersion: number;
    correlationId: string;
  }): Promise<HouseholdInvitationProjection & { invitationToken?: string }> {
    return this.mutation(
      input,
      "invitation.resend",
      input.householdId,
      async (client, afterCommit) => {
        await this.requireOrganizer(client, input.accountId, input.householdId);
        const invitation = await this.managedInvitation(client, input);
        await this.expireIfNeeded(client, invitation, input, afterCommit);
        if (invitation.state !== "pending") return this.invitationProjection(invitation);
        if (invitation.version !== input.expectedVersion) {
          throw new IdentityError(409, "HOUSEHOLD_CONFLICT", "household.conflict");
        }
        const now = this.now();
        if (
          invitation.resend_count >= MAX_RESENDS ||
          now.getTime() - invitation.last_sent_at.getTime() < RESEND_COOLDOWN_MS
        ) {
          throw new IdentityError(429, "INVITATION_RATE_LIMITED", "invitation.rateLimited");
        }
        const token = randomToken();
        const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
        const updated = await client.query<InvitationRow>(
          `UPDATE identity_household_invitations
         SET token_digest = $2, expires_at = $3, resend_count = resend_count + 1,
             last_sent_at = $4, version = version + 1, updated_at = $4
         WHERE invitation_id = $1
         RETURNING *`,
          [invitation.invitation_id, digestSecret(token), expiresAt, now],
        );
        const projection = {
          ...this.invitationProjection(updated.rows[0]!),
          invitationToken: token,
        };
        await this.audit(
          client,
          input,
          "invitation.resend",
          "success",
          input.householdId,
          "invitation",
          input.invitationId,
        );
        afterCommit(() =>
          this.log(input, "invitation.resend", "success", input.householdId, input.invitationId),
        );
        return projection;
      },
    );
  }

  public async upsertRecipientContext(input: {
    accountId: string;
    householdId: string;
    request: UpsertCareRecipientContextRequest;
    correlationId: string;
  }): Promise<CareRecipientContextProjection> {
    const request = UpsertCareRecipientContextRequestSchema.parse(input.request);
    return this.mutation(
      input,
      "recipient_context.upsert",
      input.householdId,
      async (client, afterCommit) => {
        await this.requireOrganizer(client, input.accountId, input.householdId);
        await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
          `recipient-context:${input.householdId}`,
        ]);
        const now = this.now();
        const existing = await client.query<{ recipient_context_id: string; version: number }>(
          `SELECT recipient_context_id, version FROM identity_care_recipient_contexts
         WHERE household_id = $1 FOR UPDATE`,
          [input.householdId],
        );
        const row = existing.rows[0];
        if ((row?.version ?? 0) !== request.expectedVersion) {
          throw new IdentityError(409, "HOUSEHOLD_CONFLICT", "household.conflict");
        }
        const contextId = row?.recipient_context_id ?? this.id("recipient");
        const version = (row?.version ?? 0) + 1;
        await client.query(
          `INSERT INTO identity_care_recipient_contexts
         (recipient_context_id, household_id, display_label, relationship_label, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         ON CONFLICT (household_id) DO UPDATE SET
           display_label = EXCLUDED.display_label,
           relationship_label = EXCLUDED.relationship_label,
           version = EXCLUDED.version,
           updated_at = EXCLUDED.updated_at`,
          [
            contextId,
            input.householdId,
            request.displayLabel,
            request.relationshipLabel,
            version,
            now,
          ],
        );
        const projection = {
          recipientContextId: contextId,
          householdId: input.householdId,
          displayLabel: request.displayLabel,
          relationshipLabel: request.relationshipLabel,
          version,
        };
        await this.audit(
          client,
          input,
          "recipient_context.upsert",
          "success",
          input.householdId,
          "recipient_context",
          contextId,
        );
        afterCommit(() =>
          this.log(input, "recipient_context.upsert", "success", input.householdId, contextId),
        );
        return projection;
      },
    );
  }

  public async getRecipientContext(input: {
    accountId: string;
    householdId: string;
  }): Promise<CareRecipientContextProjection | null> {
    const client = await this.pool.connect();
    try {
      await this.requireMember(client, input.accountId, input.householdId);
      const result = await client.query<{
        recipient_context_id: string;
        household_id: string;
        display_label: string;
        relationship_label: string;
        version: number;
      }>(
        `SELECT recipient_context_id, household_id, display_label, relationship_label, version
         FROM identity_care_recipient_contexts WHERE household_id = $1`,
        [input.householdId],
      );
      const row = result.rows[0];
      return row
        ? {
            recipientContextId: row.recipient_context_id,
            householdId: row.household_id,
            displayLabel: row.display_label,
            relationshipLabel: row.relationship_label,
            version: row.version,
          }
        : null;
    } finally {
      client.release();
    }
  }

  private async transitionManagedInvitation(
    input: {
      accountId: string;
      householdId: string;
      invitationId: string;
      expectedVersion: number;
      correlationId: string;
    },
    state: "revoked",
  ): Promise<HouseholdInvitationProjection> {
    return this.mutation(
      input,
      "invitation.revoke",
      input.householdId,
      async (client, afterCommit) => {
        await this.requireOrganizer(client, input.accountId, input.householdId);
        const invitation = await this.managedInvitation(client, input);
        if (invitation.state !== "pending") return this.invitationProjection(invitation);
        if (invitation.version !== input.expectedVersion) {
          throw new IdentityError(409, "HOUSEHOLD_CONFLICT", "household.conflict");
        }
        const now = this.now();
        const updated = await client.query<InvitationRow>(
          `UPDATE identity_household_invitations
         SET state = $2, terminal_at = $3, version = version + 1, updated_at = $3
         WHERE invitation_id = $1 RETURNING *`,
          [input.invitationId, state, now],
        );
        const projection = this.invitationProjection(updated.rows[0]!);
        await this.audit(
          client,
          input,
          "invitation.revoke",
          "success",
          input.householdId,
          "invitation",
          input.invitationId,
        );
        afterCommit(() =>
          this.log(input, "invitation.revoke", "success", input.householdId, input.invitationId),
        );
        return projection;
      },
    );
  }

  private async requireOrganizer(client: PoolClient, accountId: string, householdId: string) {
    const membership = await this.requireMember(client, accountId, householdId);
    if (membership.role !== "organizer") throw inaccessible();
  }

  private async requireMember(client: PoolClient, accountId: string, householdId: string) {
    const result = await client.query<MembershipRow>(
      `SELECT * FROM identity_household_memberships
       WHERE household_id = $1 AND account_id = $2 AND status = 'active'`,
      [householdId, accountId],
    );
    const membership = result.rows[0];
    if (!membership) throw inaccessible();
    return membership;
  }

  private async invitationByToken(client: PoolClient, token: string): Promise<InvitationRow> {
    const result = await client.query<InvitationRow>(
      `SELECT * FROM identity_household_invitations WHERE token_digest = $1 FOR UPDATE`,
      [digestSecret(token)],
    );
    const invitation = result.rows[0];
    if (!invitation) throw inaccessible();
    return invitation;
  }

  private async managedInvitation(
    client: PoolClient,
    input: { householdId: string; invitationId: string; expectedVersion: number },
  ): Promise<InvitationRow> {
    const result = await client.query<InvitationRow>(
      `SELECT * FROM identity_household_invitations
       WHERE household_id = $1 AND invitation_id = $2 FOR UPDATE`,
      [input.householdId, input.invitationId],
    );
    const invitation = result.rows[0];
    if (!invitation) throw inaccessible();
    return invitation;
  }

  private async expireIfNeeded(
    client: PoolClient,
    invitation: InvitationRow,
    input: { accountId: string; correlationId: string },
    afterCommit: AfterCommit,
  ): Promise<boolean> {
    if (invitation.state === "pending" && invitation.expires_at.getTime() <= this.now().getTime()) {
      const expiredAt = this.now();
      await client.query(
        `UPDATE identity_household_invitations
         SET state = 'expired', terminal_at = $2, version = version + 1, updated_at = $2
         WHERE invitation_id = $1`,
        [invitation.invitation_id, expiredAt],
      );
      invitation.state = "expired";
      invitation.version += 1;
      await this.audit(
        client,
        input,
        "invitation.expire",
        "success",
        invitation.household_id,
        "invitation",
        invitation.invitation_id,
      );
      afterCommit(() =>
        this.log(
          input,
          "invitation.expire",
          "success",
          invitation.household_id,
          invitation.invitation_id,
        ),
      );
      return true;
    }
    return false;
  }

  private householdProjection(
    householdId: string,
    displayLabel: string,
    role: "organizer" | "caregiver" | "member",
    version: number,
  ): HouseholdProjection {
    const capabilities: HouseholdProjection["capabilities"] =
      role === "organizer"
        ? [
            "household.view",
            "household.manage",
            "invitation.manage",
            "recipient_context.view",
            "recipient_context.manage",
          ]
        : ["household.view", "recipient_context.view"];
    return { householdId, displayLabel, role, capabilities, version };
  }

  private invitationProjection(row: InvitationRow): HouseholdInvitationProjection {
    return {
      invitationId: row.invitation_id,
      householdId: row.household_id,
      role: row.role,
      state: row.state,
      expiresAt: row.expires_at.toISOString(),
      version: row.version,
    };
  }

  private async idempotency<T>(
    client: PoolClient,
    accountId: string,
    operation: string,
    key: string,
    request: unknown,
  ): Promise<T | null> {
    const keyDigest = digestSecret(key);
    const requestDigest = objectDigest(request);
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [
      `${accountId}:${operation}:${keyDigest}`,
    ]);
    const result = await client.query<{ request_digest: string; response_json: T }>(
      `SELECT request_digest, response_json FROM identity_household_idempotency
       WHERE account_id = $1 AND operation = $2 AND idempotency_key_digest = $3
       FOR UPDATE`,
      [accountId, operation, keyDigest],
    );
    const replay = result.rows[0];
    if (!replay) return null;
    if (replay.request_digest !== requestDigest) {
      throw new IdentityError(409, "IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict");
    }
    return replay.response_json;
  }

  private async storeIdempotency(
    client: PoolClient,
    accountId: string,
    operation: string,
    key: string,
    request: unknown,
    response: unknown,
  ): Promise<void> {
    try {
      await client.query(
        `INSERT INTO identity_household_idempotency
         (account_id, operation, idempotency_key_digest, request_digest, response_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [accountId, operation, digestSecret(key), objectDigest(request), response, this.now()],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new IdentityError(409, "HOUSEHOLD_CONFLICT", "household.conflict");
      }
      throw error;
    }
  }

  private async audit(
    client: PoolClient,
    input: { accountId: string; correlationId: string },
    action: string,
    result: string,
    householdId: string,
    targetType: string,
    targetId = householdId,
  ): Promise<void> {
    await client.query(
      `INSERT INTO identity_audit
       (audit_id, account_id, action, result, correlation_id, occurred_at,
        household_id, target_type, target_id, reason_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)`,
      [
        this.id("audit"),
        input.accountId,
        action,
        result,
        input.correlationId,
        this.now(),
        householdId,
        targetType,
        targetId,
      ],
    );
  }

  private log(
    input: { accountId: string; correlationId: string },
    operation: string,
    result: "success" | "conflict" | "denied" | "failed",
    householdId: string,
    resourceId: string,
  ) {
    this.logger.emit({
      level: result === "success" ? "info" : "warn",
      eventName: "household_authorization",
      operation,
      result,
      correlationId: input.correlationId,
      actorId: input.accountId,
      householdId,
      resourceId,
    });
  }

  private async mutation<T>(
    input: { accountId: string; correlationId: string },
    operation: string,
    householdId: string | null,
    work: (client: PoolClient, afterCommit: AfterCommit) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.transaction(work);
    } catch (error) {
      const result =
        error instanceof IdentityError
          ? error.statusCode === 409 || error.statusCode === 429
            ? "conflict"
            : error.statusCode === 503
              ? "failed"
              : "denied"
          : "failed";
      await this.auditFailure(input, operation, result, householdId);
      this.log(input, operation, result, householdId ?? "protected", "protected");
      throw error;
    }
  }

  private async auditFailure(
    input: { accountId: string; correlationId: string },
    action: string,
    result: "conflict" | "denied" | "failed",
    householdId: string | null,
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO identity_audit
         (audit_id, account_id, action, result, correlation_id, occurred_at,
          household_id, target_type, target_id, reason_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'protected', NULL, $8)`,
        [
          this.id("audit"),
          input.accountId,
          action,
          result,
          input.correlationId,
          this.now(),
          householdId,
          result === "failed" ? "DEPENDENCY_FAILURE" : "AUTHORIZATION_OR_CONFLICT",
        ],
      );
    } catch {
      // The original result remains authoritative when failure evidence cannot be persisted.
    }
  }

  private async transaction<T>(
    work: (client: PoolClient, afterCommit: AfterCommit) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    const committedEffects: Array<() => void> = [];
    try {
      await client.query("BEGIN");
      const result = await work(client, (effect) => committedEffects.push(effect));
      await client.query("COMMIT");
      for (const effect of committedEffects) effect();
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function objectDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function inaccessible(): IdentityError {
  return new IdentityError(404, "HOUSEHOLD_NOT_FOUND", "household.notFound");
}
