import { randomUUID, timingSafeEqual } from "node:crypto";

import {
  CompleteAccountOnboardingSchema,
  FactorRecoveryRequestSchema,
  PasswordRecoveryRequestSchema,
  RegistrationRequestSchema,
  UpdateIdentityPreferencesSchema,
  type CompleteAccountOnboarding,
  type FactorRecoveryRequest,
  type IdentityPreferences,
  type IdentitySessionProjection,
  type PasswordRecoveryRequest,
  type RegistrationRequest,
  type UpdateIdentityPreferences,
} from "@lifebridge/contracts";
import { SafeLogger } from "@lifebridge/observability";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import {
  digestSecret,
  generateRecoveryCodes,
  hashPassword,
  keyedDigest,
  newTotpSecret,
  openSecret,
  randomToken,
  sealSecret,
  totpProvisioningUri,
  validateTotp,
  verifyPassword,
} from "./crypto.js";
import { IdentityError } from "./errors.js";

type ChallengePurpose =
  "registration_factor" | "registration_recovery_ack" | "signin_factor" | "factor_recovery_confirm";

interface AccountRow extends QueryResultRow {
  account_id: string;
  login_name: string;
  password_hash: string;
  status: "pending_factor" | "active" | "disabled";
  authentication_version: number;
  failed_password_attempts: number;
  locked_until: Date | null;
  onboarding_completed: boolean;
}

interface ChallengeRow extends QueryResultRow {
  challenge_id: string;
  account_id: string | null;
  purpose: ChallengePurpose;
  is_decoy: boolean;
  encrypted_artifact: string | null;
  attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
}

interface AuthenticatorRow extends QueryResultRow {
  authenticator_id: string;
  account_id: string;
  encrypted_secret: string;
  last_accepted_step: string | number | null;
}

interface RecoveryRow extends QueryResultRow {
  recovery_code_id: string;
}

interface SessionRow extends QueryResultRow {
  session_id: string;
  session_family_id: string;
  account_id: string;
  csrf_digest: string;
  authentication_version: number;
  idle_expires_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
  account_authentication_version: number;
  onboarding_completed: boolean;
  locale: "vi-VN" | "en";
  text_scale: "default" | "large";
  contrast: "system" | "more";
  motion: "system" | "reduce";
  preference_version: number;
}

export interface EnrollmentChallenge {
  code: "REGISTRATION_ACCEPTED" | "RECOVERY_ACCEPTED";
  messageKey: string;
  challengeToken: string;
  provisioningUri: string;
  manualSecret: string;
}

export interface RecoveryCodeResult {
  code: "REGISTRATION_ACCEPTED" | "RECOVERY_ACCEPTED";
  messageKey: string;
  challengeToken: string;
  recoveryCodes: string[];
}

export interface AuthenticationContinuation {
  code: "AUTHENTICATION_CONTINUE";
  messageKey: "auth.continue";
  challengeToken: string;
}

export interface AuthenticatedSession {
  sessionToken: string;
  projection: IdentitySessionProjection;
}

export interface IdentityServiceOptions {
  dataKey: Buffer;
  rateLimitKey: Buffer;
  dummyPasswordHash: string;
  now?: () => Date;
  id?: (prefix: string) => string;
  logger?: SafeLogger;
}

const CHALLENGE_TTL_MS = 5 * 60_000;
const SESSION_IDLE_MS = 30 * 60_000;
const SESSION_ABSOLUTE_MS = 12 * 60 * 60_000;
const MAX_CHALLENGE_ATTEMPTS = 5;

function safeId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function normalizeLoginName(loginName: string): string {
  return loginName.trim().toLowerCase();
}

function dateMin(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}

export class IdentityService {
  private readonly dataKey: Buffer;
  private readonly rateLimitKey: Buffer;
  private readonly dummyPasswordHash: string;
  private readonly now: () => Date;
  private readonly id: (prefix: string) => string;
  private readonly logger: SafeLogger;

  public constructor(
    private readonly pool: Pool,
    options: IdentityServiceOptions,
  ) {
    this.dataKey = options.dataKey;
    this.rateLimitKey = options.rateLimitKey;
    this.dummyPasswordHash = options.dummyPasswordHash;
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? safeId;
    this.logger = options.logger ?? new SafeLogger("identity-consent");
  }

  public async isReady(): Promise<boolean> {
    try {
      const result = await this.pool.query<{ ready: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM identity_schema_state
           WHERE service = 'identity-consent' AND version >= 3
         ) AS ready`,
      );
      return result.rows[0]?.ready === true;
    } catch {
      return false;
    }
  }

  public async requireAccountSession(
    sessionToken: string,
    csrfToken?: string,
  ): Promise<{ accountId: string }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const session = await this.requireSession(client, sessionToken, csrfToken);
      await client.query("COMMIT");
      return { accountId: session.account_id };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async register(input: {
    request: RegistrationRequest;
    correlationId: string;
    sourceKey: string;
  }): Promise<EnrollmentChallenge> {
    const request = RegistrationRequestSchema.parse(input.request);
    await this.requireRate("registration.source", input.sourceKey, 5, 60 * 60_000);
    const passwordHash = await hashPassword(request.password);
    const loginName = normalizeLoginName(request.loginName);
    const secret = newTotpSecret();
    const now = this.now();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const accountId = this.id("account");
      const inserted = await client.query<{ account_id: string }>(
        `INSERT INTO identity_accounts (
          account_id, login_name, password_hash, status, authentication_version,
          created_at, updated_at
        ) VALUES ($1,$2,$3,'pending_factor',1,$4,$4)
        ON CONFLICT (login_name) DO NOTHING
        RETURNING account_id`,
        [accountId, loginName, passwordHash, now],
      );
      const realAccountId = inserted.rows[0]?.account_id ?? null;
      if (realAccountId) {
        await client.query(
          `INSERT INTO identity_preferences (
            account_id, locale, text_scale, contrast, motion, version, created_at, updated_at
          ) VALUES ($1,'vi-VN','default','system','system',1,$2,$2)`,
          [realAccountId, now],
        );
      }
      const challenge = await this.createChallenge(client, {
        accountId: realAccountId,
        purpose: "registration_factor",
        isDecoy: !realAccountId,
        artifactSecret: secret,
        now,
      });
      await this.writeAudit(client, {
        accountId: realAccountId,
        action: "account.registration.accepted",
        result: "accepted",
        correlationId: input.correlationId,
        now,
      });
      await client.query("COMMIT");
      return {
        code: "REGISTRATION_ACCEPTED",
        messageKey: "registration.accepted",
        challengeToken: challenge.token,
        provisioningUri: totpProvisioningUri(loginName, secret),
        manualSecret: secret,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async verifyRegistrationFactor(input: {
    challengeToken: string;
    code: string;
    correlationId: string;
    sourceKey: string;
  }): Promise<RecoveryCodeResult> {
    return this.consumeEnrollmentFactor({
      ...input,
      expectedPurpose: "registration_factor",
      nextPurpose: "registration_recovery_ack",
      resultCode: "REGISTRATION_ACCEPTED",
      action: "auth.factor.succeeded",
    });
  }

  public async confirmRegistrationRecovery(input: {
    challengeToken: string;
    acknowledged: true;
    correlationId: string;
  }): Promise<{ code: "REGISTRATION_ACCEPTED"; messageKey: "registration.accepted" }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const challenge = await this.findChallengeForUpdate(client, input.challengeToken);
      if (
        challenge &&
        challenge.purpose === "registration_recovery_ack" &&
        !challenge.consumed_at &&
        challenge.expires_at.getTime() > this.now().getTime()
      ) {
        if (challenge.account_id && !challenge.is_decoy) {
          await client.query(
            `UPDATE identity_accounts
             SET status = 'active', updated_at = $2
             WHERE account_id = $1 AND status = 'pending_factor'`,
            [challenge.account_id, this.now()],
          );
        }
        await client.query(
          "UPDATE identity_challenges SET consumed_at = $2 WHERE challenge_id = $1",
          [challenge.challenge_id, this.now()],
        );
      }
      await client.query("COMMIT");
      return { code: "REGISTRATION_ACCEPTED", messageKey: "registration.accepted" };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async beginSignIn(input: {
    request: RegistrationRequest;
    correlationId: string;
    sourceKey: string;
  }): Promise<AuthenticationContinuation> {
    const request = RegistrationRequestSchema.parse(input.request);
    const loginName = normalizeLoginName(request.loginName);
    await this.requireRate("signin.source", input.sourceKey, 30, 15 * 60_000);
    await this.requireRate("signin.account", loginName, 5, 15 * 60_000);
    const accountResult = await this.pool.query<AccountRow>(
      "SELECT * FROM identity_accounts WHERE login_name = $1",
      [loginName],
    );
    const account = accountResult.rows[0];
    const passwordMatches = await verifyPassword(
      account?.password_hash ?? this.dummyPasswordHash,
      request.password,
    );
    const now = this.now();
    const eligible = Boolean(
      account &&
      passwordMatches &&
      account.status === "active" &&
      (!account.locked_until || account.locked_until.getTime() <= now.getTime()),
    );
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (account) {
        if (eligible) {
          await client.query(
            `UPDATE identity_accounts
             SET failed_password_attempts = 0, locked_until = NULL, updated_at = $2
             WHERE account_id = $1`,
            [account.account_id, now],
          );
        } else if (!passwordMatches) {
          await client.query(
            `UPDATE identity_accounts
             SET failed_password_attempts = failed_password_attempts + 1,
                 locked_until = CASE WHEN failed_password_attempts + 1 >= 5
                   THEN $2::timestamptz + INTERVAL '15 minutes' ELSE locked_until END,
                 updated_at = $2
             WHERE account_id = $1`,
            [account.account_id, now],
          );
        }
      }
      const decoySecret = eligible ? undefined : newTotpSecret();
      const challenge = await this.createChallenge(client, {
        accountId: eligible ? (account?.account_id ?? null) : null,
        purpose: "signin_factor",
        isDecoy: !eligible,
        ...(decoySecret ? { artifactSecret: decoySecret } : {}),
        now,
      });
      if (!eligible) {
        await this.writeAudit(client, {
          accountId: null,
          action: "auth.password.failed",
          result: "failed",
          correlationId: input.correlationId,
          now,
        });
      }
      await client.query("COMMIT");
      return {
        code: "AUTHENTICATION_CONTINUE",
        messageKey: "auth.continue",
        challengeToken: challenge.token,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async completeSignIn(input: {
    challengeToken: string;
    code: string;
    correlationId: string;
    sourceKey: string;
  }): Promise<AuthenticatedSession> {
    await this.requireRate("factor.source", input.sourceKey, 30, 15 * 60_000);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const challenge = await this.findChallengeForUpdate(client, input.challengeToken);
      const now = this.now();
      const validChallenge = Boolean(
        challenge &&
        challenge.purpose === "signin_factor" &&
        !challenge.consumed_at &&
        challenge.attempts < MAX_CHALLENGE_ATTEMPTS &&
        challenge.expires_at.getTime() > now.getTime(),
      );
      let authenticator: AuthenticatorRow | undefined;
      let secret = newTotpSecret();
      if (validChallenge && challenge?.account_id && !challenge.is_decoy) {
        const result = await client.query<AuthenticatorRow>(
          `SELECT * FROM identity_authenticators
           WHERE account_id = $1 AND status = 'active'
           FOR UPDATE`,
          [challenge.account_id],
        );
        authenticator = result.rows[0];
        if (authenticator) {
          secret = openSecret(
            authenticator.encrypted_secret,
            this.dataKey,
            authenticator.authenticator_id,
          );
        }
      } else if (validChallenge && challenge?.encrypted_artifact) {
        secret = openSecret(challenge.encrypted_artifact, this.dataKey, challenge.challenge_id);
      }
      const acceptedStep = validateTotp(secret, input.code, now.getTime());
      const priorStep = authenticator?.last_accepted_step;
      const unusedStep =
        acceptedStep !== null && (priorStep === null || acceptedStep > Number(priorStep));
      if (!validChallenge || !authenticator || !unusedStep || !challenge?.account_id) {
        if (challenge) {
          await client.query(
            "UPDATE identity_challenges SET attempts = attempts + 1 WHERE challenge_id = $1",
            [challenge.challenge_id],
          );
        }
        await this.writeAudit(client, {
          accountId: null,
          action: "auth.factor.failed",
          result: "failed",
          correlationId: input.correlationId,
          now,
        });
        await client.query("COMMIT");
        throw this.authenticationFailed();
      }
      await client.query(
        `UPDATE identity_authenticators
         SET last_accepted_step = $2
         WHERE authenticator_id = $1`,
        [authenticator.authenticator_id, acceptedStep],
      );
      await client.query(
        "UPDATE identity_challenges SET consumed_at = $2 WHERE challenge_id = $1",
        [challenge.challenge_id, now],
      );
      const session = await this.createSession(client, challenge.account_id, now);
      await this.writeAudit(client, {
        accountId: challenge.account_id,
        action: "auth.factor.succeeded",
        result: "success",
        correlationId: input.correlationId,
        now,
      });
      await this.writeAudit(client, {
        accountId: challenge.account_id,
        action: "session.created",
        result: "success",
        correlationId: input.correlationId,
        now,
      });
      await client.query("COMMIT");
      this.safeLog("session.created", "success", input.correlationId);
      return session;
    } catch (error) {
      if (!(error instanceof IdentityError)) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async getSession(sessionToken: string): Promise<IdentitySessionProjection> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const session = await this.requireSession(client, sessionToken);
      const csrfToken = randomToken();
      await client.query("UPDATE identity_sessions SET csrf_digest = $2 WHERE session_id = $1", [
        session.session_id,
        digestSecret(csrfToken),
      ]);
      await client.query("COMMIT");
      return this.projectSession(session, csrfToken);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async updatePreferences(input: {
    sessionToken: string;
    csrfToken: string;
    request: UpdateIdentityPreferences;
    correlationId: string;
  }): Promise<IdentitySessionProjection> {
    const request = UpdateIdentityPreferencesSchema.parse(input.request);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const session = await this.requireSession(client, input.sessionToken, input.csrfToken);
      const updated = await client.query(
        `UPDATE identity_preferences
         SET locale = $2, text_scale = $3, contrast = $4, motion = $5,
             version = version + 1, updated_at = $6
         WHERE account_id = $1 AND version = $7`,
        [
          session.account_id,
          request.locale,
          request.textScale,
          request.contrast,
          request.motion,
          this.now(),
          request.expectedVersion,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new IdentityError(409, "PREFERENCES_VERSION_CONFLICT", "preferences.versionConflict");
      }
      await this.writeAudit(client, {
        accountId: session.account_id,
        action: "preferences.updated",
        result: "success",
        correlationId: input.correlationId,
        now: this.now(),
      });
      const refreshed = await this.readSessionRow(client, session.session_id);
      const csrfToken = randomToken();
      await client.query("UPDATE identity_sessions SET csrf_digest = $2 WHERE session_id = $1", [
        session.session_id,
        digestSecret(csrfToken),
      ]);
      await client.query("COMMIT");
      return this.projectSession(refreshed, csrfToken);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async completeOnboarding(input: {
    sessionToken: string;
    csrfToken: string;
    request: CompleteAccountOnboarding;
    correlationId: string;
  }): Promise<AuthenticatedSession> {
    const request = CompleteAccountOnboardingSchema.parse(input.request);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const session = await this.requireSession(client, input.sessionToken, input.csrfToken);
      const now = this.now();
      await client.query(
        `UPDATE identity_accounts
         SET onboarding_completed = TRUE, role_intent = $2, updated_at = $3
         WHERE account_id = $1`,
        [session.account_id, request.roleIntent ?? null, now],
      );
      await client.query(
        `UPDATE identity_sessions
         SET revoked_at = $2, revoke_reason = 'onboarding_rotation'
         WHERE session_id = $1 AND revoked_at IS NULL`,
        [session.session_id, now],
      );
      const rotated = await this.createSession(
        client,
        session.account_id,
        now,
        session.session_family_id,
      );
      await this.writeAudit(client, {
        accountId: session.account_id,
        action: "onboarding.completed",
        result: "success",
        correlationId: input.correlationId,
        now,
      });
      await this.writeAudit(client, {
        accountId: session.account_id,
        action: "session.rotated",
        result: "success",
        correlationId: input.correlationId,
        now,
      });
      await client.query("COMMIT");
      return rotated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async logout(input: {
    sessionToken: string;
    csrfToken: string;
    correlationId: string;
  }): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const session = await this.requireSession(client, input.sessionToken, input.csrfToken);
      const now = this.now();
      await client.query(
        `UPDATE identity_sessions
         SET revoked_at = $2, revoke_reason = 'logout'
         WHERE session_id = $1`,
        [session.session_id, now],
      );
      await this.writeAudit(client, {
        accountId: session.account_id,
        action: "session.revoked",
        result: "success",
        correlationId: input.correlationId,
        now,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async recoverPassword(input: {
    request: PasswordRecoveryRequest;
    correlationId: string;
    sourceKey: string;
  }): Promise<RecoveryCodeResult> {
    const request = PasswordRecoveryRequestSchema.parse(input.request);
    const loginName = normalizeLoginName(request.loginName);
    await this.requireRate("recovery.source", input.sourceKey, 20, 60 * 60_000);
    await this.requireRate("recovery.account", loginName, 5, 24 * 60 * 60_000);
    const newPasswordHash = await hashPassword(request.newPassword);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const account = await this.findAccountForUpdate(client, loginName);
      const proof = await this.verifyRecoveryProof(
        client,
        account,
        request.recoveryCode,
        request.totpCode,
      );
      if (!account || !proof) {
        await this.writeAudit(client, {
          accountId: null,
          action: "auth.recovery.failed",
          result: "failed",
          correlationId: input.correlationId,
          now: this.now(),
        });
        await client.query("COMMIT");
        throw this.recoveryFailed();
      }
      const now = this.now();
      await client.query(
        `UPDATE identity_accounts
         SET password_hash = $2, authentication_version = authentication_version + 1,
             failed_password_attempts = 0, locked_until = NULL, updated_at = $3
         WHERE account_id = $1`,
        [account.account_id, newPasswordHash, now],
      );
      await this.consumeRecoveryAndRevokeSessions(client, account.account_id, proof.codeId, now);
      await client.query(
        "UPDATE identity_authenticators SET last_accepted_step = $2 WHERE authenticator_id = $1",
        [proof.authenticatorId, proof.acceptedStep],
      );
      const recoveryCodes = await this.replaceRecoveryCodes(client, account.account_id, now);
      await this.writeAudit(client, {
        accountId: account.account_id,
        action: "auth.recovery.succeeded",
        result: "success",
        correlationId: input.correlationId,
        now,
      });
      await client.query("COMMIT");
      return {
        code: "RECOVERY_ACCEPTED",
        messageKey: "recovery.accepted",
        challengeToken: randomToken(),
        recoveryCodes,
      };
    } catch (error) {
      if (!(error instanceof IdentityError)) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async beginFactorRecovery(input: {
    request: FactorRecoveryRequest;
    correlationId: string;
    sourceKey: string;
  }): Promise<EnrollmentChallenge> {
    const request = FactorRecoveryRequestSchema.parse(input.request);
    const loginName = normalizeLoginName(request.loginName);
    await this.requireRate("recovery.source", input.sourceKey, 20, 60 * 60_000);
    await this.requireRate("recovery.account", loginName, 5, 24 * 60 * 60_000);
    const accountResult = await this.pool.query<AccountRow>(
      "SELECT * FROM identity_accounts WHERE login_name = $1",
      [loginName],
    );
    const candidate = accountResult.rows[0];
    const passwordMatches = await verifyPassword(
      candidate?.password_hash ?? this.dummyPasswordHash,
      request.password,
    );
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const account = await this.findAccountForUpdate(client, loginName);
      const recovery = account
        ? await this.findRecoveryForUpdate(client, account.account_id, request.recoveryCode)
        : undefined;
      if (!account || !passwordMatches || account.status !== "active" || !recovery) {
        await this.writeAudit(client, {
          accountId: null,
          action: "auth.recovery.failed",
          result: "failed",
          correlationId: input.correlationId,
          now: this.now(),
        });
        await client.query("COMMIT");
        throw this.recoveryFailed();
      }
      const now = this.now();
      await this.consumeRecoveryAndRevokeSessions(
        client,
        account.account_id,
        recovery.recovery_code_id,
        now,
      );
      await client.query(
        `UPDATE identity_authenticators
         SET status = 'revoked', revoked_at = $2
         WHERE account_id = $1 AND status = 'active'`,
        [account.account_id, now],
      );
      await client.query(
        `UPDATE identity_accounts
         SET status = 'pending_factor', authentication_version = authentication_version + 1,
             updated_at = $2
         WHERE account_id = $1`,
        [account.account_id, now],
      );
      const secret = newTotpSecret();
      const challenge = await this.createChallenge(client, {
        accountId: account.account_id,
        purpose: "factor_recovery_confirm",
        isDecoy: false,
        artifactSecret: secret,
        now,
      });
      await client.query("COMMIT");
      return {
        code: "RECOVERY_ACCEPTED",
        messageKey: "recovery.accepted",
        challengeToken: challenge.token,
        provisioningUri: totpProvisioningUri(loginName, secret),
        manualSecret: secret,
      };
    } catch (error) {
      if (!(error instanceof IdentityError)) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  public async confirmFactorRecovery(input: {
    challengeToken: string;
    code: string;
    correlationId: string;
    sourceKey: string;
  }): Promise<RecoveryCodeResult> {
    const result = await this.consumeEnrollmentFactor({
      ...input,
      expectedPurpose: "factor_recovery_confirm",
      nextPurpose: null,
      resultCode: "RECOVERY_ACCEPTED",
      action: "auth.recovery.succeeded",
    });
    return result;
  }

  public async countRows(table: string): Promise<number> {
    const allowed = new Set([
      "identity_accounts",
      "identity_authenticators",
      "identity_recovery_codes",
      "identity_challenges",
      "identity_sessions",
      "identity_rate_limits",
      "identity_preferences",
      "identity_audit",
    ]);
    if (!allowed.has(table)) {
      throw new Error("TABLE_NOT_ALLOWED");
    }
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ${table}`,
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async consumeEnrollmentFactor(input: {
    challengeToken: string;
    code: string;
    correlationId: string;
    sourceKey: string;
    expectedPurpose: "registration_factor" | "factor_recovery_confirm";
    nextPurpose: "registration_recovery_ack" | null;
    resultCode: "REGISTRATION_ACCEPTED" | "RECOVERY_ACCEPTED";
    action: "auth.factor.succeeded" | "auth.recovery.succeeded";
  }): Promise<RecoveryCodeResult> {
    await this.requireRate("factor.source", input.sourceKey, 30, 15 * 60_000);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const challenge = await this.findChallengeForUpdate(client, input.challengeToken);
      const now = this.now();
      const validChallenge = Boolean(
        challenge &&
        challenge.purpose === input.expectedPurpose &&
        !challenge.consumed_at &&
        challenge.attempts < MAX_CHALLENGE_ATTEMPTS &&
        challenge.expires_at.getTime() > now.getTime() &&
        challenge.encrypted_artifact,
      );
      const secret =
        validChallenge && challenge?.encrypted_artifact
          ? openSecret(challenge.encrypted_artifact, this.dataKey, challenge.challenge_id)
          : newTotpSecret();
      const acceptedStep = validateTotp(secret, input.code, now.getTime());
      if (!validChallenge || acceptedStep === null || !challenge) {
        if (challenge) {
          await client.query(
            "UPDATE identity_challenges SET attempts = attempts + 1 WHERE challenge_id = $1",
            [challenge.challenge_id],
          );
        }
        await this.writeAudit(client, {
          accountId: null,
          action: "auth.factor.failed",
          result: "failed",
          correlationId: input.correlationId,
          now,
        });
        await client.query("COMMIT");
        throw this.authenticationFailed();
      }
      const recoveryCodes = generateRecoveryCodes();
      if (challenge.account_id && !challenge.is_decoy) {
        await client.query(
          `UPDATE identity_authenticators
           SET status = 'revoked', revoked_at = $2
           WHERE account_id = $1 AND status = 'active'`,
          [challenge.account_id, now],
        );
        const authenticatorId = this.id("authenticator");
        await client.query(
          `INSERT INTO identity_authenticators (
            authenticator_id, account_id, type, status, encrypted_secret,
            key_version, last_accepted_step, created_at
          ) VALUES ($1,$2,'totp','active',$3,1,$4,$5)`,
          [
            authenticatorId,
            challenge.account_id,
            sealSecret(secret, this.dataKey, authenticatorId),
            acceptedStep,
            now,
          ],
        );
        await client.query(
          `UPDATE identity_recovery_codes
           SET revoked_at = $2
           WHERE account_id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
          [challenge.account_id, now],
        );
        await this.storeRecoveryCodes(client, challenge.account_id, recoveryCodes, now);
        if (input.expectedPurpose === "factor_recovery_confirm") {
          await client.query(
            `UPDATE identity_accounts
             SET status = 'active', authentication_version = authentication_version + 1,
                 updated_at = $2
             WHERE account_id = $1`,
            [challenge.account_id, now],
          );
        }
      }
      if (input.nextPurpose) {
        await client.query(
          `UPDATE identity_challenges
           SET purpose = $2, encrypted_artifact = NULL, attempts = 0,
               expires_at = $3
           WHERE challenge_id = $1`,
          [challenge.challenge_id, input.nextPurpose, new Date(now.getTime() + CHALLENGE_TTL_MS)],
        );
      } else {
        await client.query(
          "UPDATE identity_challenges SET consumed_at = $2 WHERE challenge_id = $1",
          [challenge.challenge_id, now],
        );
      }
      await this.writeAudit(client, {
        accountId: challenge.account_id,
        action: input.action,
        result: "success",
        correlationId: input.correlationId,
        now,
      });
      await client.query("COMMIT");
      return {
        code: input.resultCode,
        messageKey:
          input.resultCode === "REGISTRATION_ACCEPTED"
            ? "registration.accepted"
            : "recovery.accepted",
        challengeToken: input.challengeToken,
        recoveryCodes,
      };
    } catch (error) {
      if (!(error instanceof IdentityError)) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async createChallenge(
    client: PoolClient,
    input: {
      accountId: string | null;
      purpose: ChallengePurpose;
      isDecoy: boolean;
      artifactSecret?: string;
      now: Date;
    },
  ): Promise<{ id: string; token: string }> {
    const id = this.id("challenge");
    const token = randomToken();
    const artifact = input.artifactSecret
      ? sealSecret(input.artifactSecret, this.dataKey, id)
      : null;
    await client.query(
      `INSERT INTO identity_challenges (
        challenge_id, token_digest, account_id, purpose, is_decoy,
        encrypted_artifact, attempts, expires_at, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8)`,
      [
        id,
        digestSecret(token),
        input.accountId,
        input.purpose,
        input.isDecoy,
        artifact,
        new Date(input.now.getTime() + CHALLENGE_TTL_MS),
        input.now,
      ],
    );
    return { id, token };
  }

  private async findChallengeForUpdate(
    client: PoolClient,
    token: string,
  ): Promise<ChallengeRow | undefined> {
    const result = await client.query<ChallengeRow>(
      "SELECT * FROM identity_challenges WHERE token_digest = $1 FOR UPDATE",
      [digestSecret(token)],
    );
    return result.rows[0];
  }

  private async findAccountForUpdate(
    client: PoolClient,
    loginName: string,
  ): Promise<AccountRow | undefined> {
    const result = await client.query<AccountRow>(
      "SELECT * FROM identity_accounts WHERE login_name = $1 FOR UPDATE",
      [loginName],
    );
    return result.rows[0];
  }

  private async findRecoveryForUpdate(
    client: PoolClient,
    accountId: string,
    recoveryCode: string,
  ): Promise<RecoveryRow | undefined> {
    const result = await client.query<RecoveryRow>(
      `SELECT recovery_code_id FROM identity_recovery_codes
       WHERE account_id = $1 AND code_digest = $2
         AND used_at IS NULL AND revoked_at IS NULL
       FOR UPDATE`,
      [accountId, digestSecret(`${accountId}:${recoveryCode}`)],
    );
    return result.rows[0];
  }

  private async verifyRecoveryProof(
    client: PoolClient,
    account: AccountRow | undefined,
    recoveryCode: string,
    totpCode: string,
  ): Promise<{ codeId: string; authenticatorId: string; acceptedStep: number } | undefined> {
    if (!account || account.status !== "active") {
      validateTotp(newTotpSecret(), totpCode, this.now().getTime());
      return undefined;
    }
    const recovery = await this.findRecoveryForUpdate(client, account.account_id, recoveryCode);
    const result = await client.query<AuthenticatorRow>(
      `SELECT * FROM identity_authenticators
       WHERE account_id = $1 AND status = 'active'
       FOR UPDATE`,
      [account.account_id],
    );
    const authenticator = result.rows[0];
    if (!authenticator) {
      return undefined;
    }
    const secret = openSecret(
      authenticator.encrypted_secret,
      this.dataKey,
      authenticator.authenticator_id,
    );
    const acceptedStep = validateTotp(secret, totpCode, this.now().getTime());
    if (
      !recovery ||
      acceptedStep === null ||
      (authenticator.last_accepted_step !== null &&
        acceptedStep <= Number(authenticator.last_accepted_step))
    ) {
      return undefined;
    }
    return {
      codeId: recovery.recovery_code_id,
      authenticatorId: authenticator.authenticator_id,
      acceptedStep,
    };
  }

  private async consumeRecoveryAndRevokeSessions(
    client: PoolClient,
    accountId: string,
    codeId: string,
    now: Date,
  ): Promise<void> {
    await client.query(
      "UPDATE identity_recovery_codes SET used_at = $2 WHERE recovery_code_id = $1",
      [codeId, now],
    );
    await client.query(
      `UPDATE identity_recovery_codes
       SET revoked_at = $2
       WHERE account_id = $1 AND recovery_code_id <> $3
         AND used_at IS NULL AND revoked_at IS NULL`,
      [accountId, now, codeId],
    );
    await client.query(
      `UPDATE identity_sessions
       SET revoked_at = $2, revoke_reason = 'recovery'
       WHERE account_id = $1 AND revoked_at IS NULL`,
      [accountId, now],
    );
  }

  private async replaceRecoveryCodes(
    client: PoolClient,
    accountId: string,
    now: Date,
  ): Promise<string[]> {
    await client.query(
      `UPDATE identity_recovery_codes
       SET revoked_at = $2
       WHERE account_id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
      [accountId, now],
    );
    const codes = generateRecoveryCodes();
    await this.storeRecoveryCodes(client, accountId, codes, now);
    return codes;
  }

  private async storeRecoveryCodes(
    client: PoolClient,
    accountId: string,
    codes: string[],
    now: Date,
  ): Promise<void> {
    for (const code of codes) {
      await client.query(
        `INSERT INTO identity_recovery_codes (
          recovery_code_id, account_id, code_digest, created_at
        ) VALUES ($1,$2,$3,$4)`,
        [this.id("recovery"), accountId, digestSecret(`${accountId}:${code}`), now],
      );
    }
  }

  private async createSession(
    client: PoolClient,
    accountId: string,
    now: Date,
    familyId = this.id("sessionfamily"),
  ): Promise<AuthenticatedSession> {
    const account = await client.query<AccountRow>(
      "SELECT * FROM identity_accounts WHERE account_id = $1",
      [accountId],
    );
    const row = account.rows[0];
    if (!row || row.status !== "active") {
      throw this.authenticationFailed();
    }
    const sessionId = this.id("session");
    const sessionToken = randomToken();
    const csrfToken = randomToken();
    const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
    await client.query(
      `INSERT INTO identity_sessions (
        session_id, session_family_id, account_id, token_digest, csrf_digest,
        authentication_version, authenticated_at, last_seen_at,
        idle_expires_at, absolute_expires_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)`,
      [
        sessionId,
        familyId,
        accountId,
        digestSecret(sessionToken),
        digestSecret(csrfToken),
        row.authentication_version,
        now,
        idleExpiresAt,
        absoluteExpiresAt,
      ],
    );
    const session = await this.readSessionRow(client, sessionId);
    return { sessionToken, projection: this.projectSession(session, csrfToken) };
  }

  private async requireSession(
    client: PoolClient,
    sessionToken: string,
    csrfToken?: string,
  ): Promise<SessionRow> {
    const result = await client.query<SessionRow>(
      `${this.sessionSelection()}
       WHERE session.token_digest = $1
       FOR UPDATE OF session`,
      [digestSecret(sessionToken)],
    );
    const session = result.rows[0];
    const now = this.now();
    if (!session) {
      throw new IdentityError(401, "SESSION_REQUIRED", "session.required");
    }
    const expired = Boolean(
      session.revoked_at ||
      session.idle_expires_at.getTime() <= now.getTime() ||
      session.absolute_expires_at.getTime() <= now.getTime() ||
      session.authentication_version !== session.account_authentication_version,
    );
    if (expired) {
      if (!session.revoked_at) {
        await client.query(
          `UPDATE identity_sessions
           SET revoked_at = $2, revoke_reason = 'expired'
           WHERE session_id = $1`,
          [session.session_id, now],
        );
      }
      throw new IdentityError(401, "SESSION_EXPIRED", "session.expired");
    }
    if (csrfToken !== undefined && !this.digestMatches(session.csrf_digest, csrfToken)) {
      throw new IdentityError(403, "CSRF_REJECTED", "session.csrfRejected");
    }
    const nextIdle = dateMin(
      new Date(now.getTime() + SESSION_IDLE_MS),
      session.absolute_expires_at,
    );
    await client.query(
      `UPDATE identity_sessions
       SET last_seen_at = $2, idle_expires_at = $3
       WHERE session_id = $1`,
      [session.session_id, now, nextIdle],
    );
    session.idle_expires_at = nextIdle;
    return session;
  }

  private async readSessionRow(client: PoolClient, sessionId: string): Promise<SessionRow> {
    const result = await client.query<SessionRow>(
      `${this.sessionSelection()} WHERE session.session_id = $1`,
      [sessionId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new IdentityError(401, "SESSION_REQUIRED", "session.required");
    }
    return row;
  }

  private sessionSelection(): string {
    return `SELECT session.*,
      account.authentication_version AS account_authentication_version,
      account.onboarding_completed,
      preferences.locale,
      preferences.text_scale,
      preferences.contrast,
      preferences.motion,
      preferences.version AS preference_version
    FROM identity_sessions AS session
    JOIN identity_accounts AS account ON account.account_id = session.account_id
    JOIN identity_preferences AS preferences ON preferences.account_id = session.account_id`;
  }

  private projectSession(session: SessionRow, csrfToken: string): IdentitySessionProjection {
    const preferences: IdentityPreferences = {
      locale: session.locale,
      textScale: session.text_scale,
      contrast: session.contrast,
      motion: session.motion,
      version: session.preference_version,
    };
    return {
      accountId: session.account_id,
      onboardingState: session.onboarding_completed ? "complete" : "required",
      authorizationScope: "account",
      preferences,
      session: {
        idleExpiresAt: session.idle_expires_at.toISOString(),
        absoluteExpiresAt: session.absolute_expires_at.toISOString(),
      },
      csrfToken,
    };
  }

  private async requireRate(
    operation: string,
    rawDimension: string,
    limit: number,
    windowMs: number,
  ): Promise<void> {
    const now = this.now();
    const windowStartedAt = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
    const dimension = keyedDigest(this.rateLimitKey, `${operation}:${rawDimension}`);
    const result = await this.pool.query<{ attempt_count: number }>(
      `INSERT INTO identity_rate_limits (
        operation, dimension_digest, window_started_at, attempt_count
      ) VALUES ($1,$2,$3,1)
      ON CONFLICT (operation, dimension_digest, window_started_at)
      DO UPDATE SET attempt_count = identity_rate_limits.attempt_count + 1
      RETURNING attempt_count`,
      [operation, dimension, windowStartedAt],
    );
    if ((result.rows[0]?.attempt_count ?? limit + 1) > limit) {
      throw new IdentityError(429, "AUTHENTICATION_RATE_LIMITED", "auth.rateLimited", true);
    }
  }

  private digestMatches(expectedDigest: string, rawValue: string): boolean {
    const actual = Buffer.from(digestSecret(rawValue), "hex");
    const expected = Buffer.from(expectedDigest, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private async writeAudit(
    client: PoolClient,
    input: {
      accountId: string | null;
      action: string;
      result: string;
      correlationId: string;
      now: Date;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO identity_audit (
        audit_id, account_id, action, result, correlation_id, occurred_at
      ) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        this.id("audit"),
        input.accountId,
        input.action,
        input.result,
        input.correlationId,
        input.now,
      ],
    );
  }

  private safeLog(eventName: string, result: "success" | "failed", correlationId: string): void {
    this.logger.emit({
      level: result === "success" ? "info" : "warn",
      eventName,
      operation: "identity",
      result,
      correlationId,
    });
  }

  private authenticationFailed(): IdentityError {
    return new IdentityError(401, "AUTHENTICATION_FAILED", "auth.failed");
  }

  private recoveryFailed(): IdentityError {
    return new IdentityError(401, "AUTHENTICATION_FAILED", "recovery.accepted");
  }
}
