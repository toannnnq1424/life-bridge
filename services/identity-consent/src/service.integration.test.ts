import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SafeLogger } from "@lifebridge/observability";

import { generateTotp, hashPassword } from "./crypto.js";
import { HouseholdService } from "./household-service.js";
import { migrateIdentityDatabase } from "./migration.js";
import { IdentityService } from "./service.js";

const databaseUrl = process.env.IDENTITY_DATABASE_URL ?? "";
const integration = databaseUrl ? describe : describe.skip;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 8 }) : undefined;
const clock = { value: Date.parse("2026-08-03T02:00:00.000Z") };
let identity: IdentityService;
let households: HouseholdService;
const householdLogs: string[] = [];

integration("P2-S1 identity lifecycle", () => {
  beforeAll(async () => {
    await migrateIdentityDatabase(databaseUrl);
    identity = new IdentityService(pool!, {
      dataKey: Buffer.alloc(32, 7),
      rateLimitKey: Buffer.alloc(32, 9),
      dummyPasswordHash: await hashPassword("synthetic dummy password"),
      now: () => new Date(clock.value),
    });
    households = new HouseholdService(pool!, {
      rateLimitKey: Buffer.alloc(32, 9),
      now: () => new Date(clock.value),
      logger: new SafeLogger(
        "identity-consent",
        (serialized) => householdLogs.push(serialized),
        () => new Date(clock.value),
      ),
    });
  });

  beforeEach(async () => {
    clock.value = Date.parse("2026-08-03T02:00:00.000Z");
    householdLogs.length = 0;
    await pool!.query(`TRUNCATE
      identity_audit, identity_care_recipient_contexts, identity_household_idempotency,
      identity_household_invitations, identity_household_memberships, identity_households,
      identity_preferences, identity_rate_limits, identity_sessions,
      identity_challenges, identity_recovery_codes, identity_authenticators,
      identity_accounts RESTART IDENTITY CASCADE`);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("registers, requires factor/recovery acknowledgement, rotates the session, and persists preferences", async () => {
    const enrolled = await enroll("synthetic.user", "A long synthetic passphrase");
    clock.value += 30_000;
    const authenticated = await signIn(
      "synthetic.user",
      "A long synthetic passphrase",
      enrolled.secret,
    );

    const current = await identity.getSession(authenticated.sessionToken);
    expect(current).toMatchObject({
      onboardingState: "required",
      authorizationScope: "account",
      preferences: { locale: "vi-VN", version: 1 },
    });
    const preferences = await identity.updatePreferences({
      sessionToken: authenticated.sessionToken,
      csrfToken: current.csrfToken,
      request: {
        locale: "en",
        textScale: "large",
        contrast: "more",
        motion: "reduce",
        expectedVersion: 1,
      },
      correlationId: "corr_preferences_1",
    });
    expect(preferences.preferences).toMatchObject({ locale: "en", version: 2 });

    const rotated = await identity.completeOnboarding({
      sessionToken: authenticated.sessionToken,
      csrfToken: preferences.csrfToken,
      request: { roleIntent: "coordinate" },
      correlationId: "corr_onboarding_1",
    });
    expect(rotated.sessionToken).not.toBe(authenticated.sessionToken);
    await expect(identity.getSession(authenticated.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
    await expect(identity.getSession(rotated.sessionToken)).resolves.toMatchObject({
      onboardingState: "complete",
      preferences: { locale: "en", textScale: "large", contrast: "more", motion: "reduce" },
    });
    expect(await identity.countRows("identity_audit")).toBeGreaterThanOrEqual(6);
  });

  it("creates a household, consumes one digest-only invitation, and shares only minimum context", async () => {
    const organizerFactor = await enroll("organizer.user", "Organizer synthetic passphrase");
    const inviteeFactor = await enroll("invitee.user", "Invitee synthetic passphrase");
    const expiryFactor = await enroll("expiry.user", "Expiry synthetic passphrase");
    clock.value += 30_000;
    const organizerSession = await signIn(
      "organizer.user",
      "Organizer synthetic passphrase",
      organizerFactor.secret,
    );
    const inviteeSession = await signIn(
      "invitee.user",
      "Invitee synthetic passphrase",
      inviteeFactor.secret,
    );
    const expirySession = await signIn(
      "expiry.user",
      "Expiry synthetic passphrase",
      expiryFactor.secret,
    );
    const householdResults = await Promise.all([
      households.createHousehold({
        accountId: organizerSession.projection.accountId,
        request: { displayLabel: "Synthetic household" },
        idempotencyKey: "create-household-0001",
        correlationId: "corr_household_create",
      }),
      households.createHousehold({
        accountId: organizerSession.projection.accountId,
        request: { displayLabel: "Synthetic household" },
        idempotencyKey: "create-household-0001",
        correlationId: "corr_household_replay",
      }),
    ]);
    const household = householdResults[0]!;
    expect(householdResults[1]).toEqual(household);

    const invitationResults = await Promise.all([
      households.createInvitation({
        accountId: organizerSession.projection.accountId,
        householdId: household.householdId,
        request: { inviteeLoginName: "invitee.user", role: "member" },
        idempotencyKey: "create-invitation-0001",
        correlationId: "corr_invitation_create",
      }),
      households.createInvitation({
        accountId: organizerSession.projection.accountId,
        householdId: household.householdId,
        request: { inviteeLoginName: "invitee.user", role: "member" },
        idempotencyKey: "create-invitation-0001",
        correlationId: "corr_invitation_retry",
      }),
    ]);
    const invitation = invitationResults.find((candidate) => candidate.invitationToken)!;
    expect(invitation).toMatchObject({ state: "pending", role: "member" });
    expect(invitation.invitationToken).toHaveLength(43);
    const persisted = await pool!.query(
      `SELECT token_digest, to_jsonb(invitation)::text AS serialized
       FROM identity_household_invitations AS invitation
       WHERE invitation_id = $1`,
      [invitation.invitationId],
    );
    expect(persisted.rows[0].token_digest).toHaveLength(64);
    expect(persisted.rows[0].serialized).not.toContain(invitation.invitationToken);

    const accepted = await households.respondToInvitation({
      accountId: inviteeSession.projection.accountId,
      invitationToken: invitation.invitationToken!,
      decision: "accepted",
      correlationId: "corr_invitation_accept",
    });
    expect(accepted.state).toBe("accepted");
    await expect(
      households.respondToInvitation({
        accountId: inviteeSession.projection.accountId,
        invitationToken: invitation.invitationToken!,
        decision: "accepted",
        correlationId: "corr_invitation_replay",
      }),
    ).resolves.toMatchObject({ state: "accepted" });

    const context = await households.upsertRecipientContext({
      accountId: organizerSession.projection.accountId,
      householdId: household.householdId,
      request: {
        displayLabel: "Synthetic recipient",
        relationshipLabel: "Family member",
        expectedVersion: 0,
      },
      correlationId: "corr_context_create",
    });
    await expect(
      households.getRecipientContext({
        accountId: inviteeSession.projection.accountId,
        householdId: household.householdId,
      }),
    ).resolves.toEqual(context);

    const decoy = await households.createInvitation({
      accountId: organizerSession.projection.accountId,
      householdId: household.householdId,
      request: { inviteeLoginName: "unknown.user", role: "member" },
      idempotencyKey: "create-invitation-decoy",
      correlationId: "corr_invitation_decoy",
    });
    expect(decoy).toMatchObject({ state: "pending", role: "member" });
    const decoyRow = await pool!.query(
      `SELECT is_decoy, invitee_account_id, to_jsonb(invitation)::text AS serialized
       FROM identity_household_invitations AS invitation
       WHERE invitation_id = $1`,
      [decoy.invitationId],
    );
    expect(decoyRow.rows[0]).toMatchObject({ is_decoy: true, invitee_account_id: null });
    expect(decoyRow.rows[0].serialized).not.toContain("unknown.user");
    expect(decoyRow.rows[0].serialized).not.toContain(decoy.invitationToken);

    const expiring = await households.createInvitation({
      accountId: organizerSession.projection.accountId,
      householdId: household.householdId,
      request: { inviteeLoginName: "expiry.user", role: "caregiver" },
      idempotencyKey: "create-invitation-expiry",
      correlationId: "corr_invitation_expiry",
    });
    clock.value += 48 * 60 * 60_000 + 1;
    await expect(
      households.respondToInvitation({
        accountId: expirySession.projection.accountId,
        invitationToken: expiring.invitationToken!,
        decision: "accepted",
        correlationId: "corr_invitation_expired",
      }),
    ).resolves.toMatchObject({ state: "expired" });
    await expect(
      pool!.query(`SELECT state FROM identity_household_invitations WHERE invitation_id = $1`, [
        expiring.invitationId,
      ]),
    ).resolves.toMatchObject({ rows: [{ state: "expired" }] });
    await expect(
      households.respondToInvitation({
        accountId: inviteeSession.projection.accountId,
        invitationToken: invitation.invitationToken!,
        decision: "accepted",
        correlationId: "corr_invitation_terminal_expired",
      }),
    ).rejects.toMatchObject({ code: "HOUSEHOLD_NOT_FOUND", statusCode: 404 });
    const auditActions = await pool!.query<{ action: string }>(
      `SELECT action FROM identity_audit
       WHERE household_id = $1 AND action IN ('membership.grant', 'invitation.expire')`,
      [household.householdId],
    );
    expect(auditActions.rows.map((row) => row.action)).toEqual(
      expect.arrayContaining(["membership.grant", "invitation.expire"]),
    );
    expect(householdLogs.join("\n")).not.toContain("unknown.user");
    expect(householdLogs.join("\n")).not.toContain(invitation.invitationToken);
    expect(householdLogs.join("\n")).not.toContain("Synthetic recipient");
  });

  it("bounds decoys and resolves invitation and first-context races without disclosure", async () => {
    const organizerFactor = await enroll("race.organizer", "Organizer race passphrase");
    const realFactor = await enroll("race.real", "Real invitee passphrase");
    const inactiveFactor = await enroll("race.inactive", "Inactive invitee passphrase");
    const concurrentFactor = await enroll("race.concurrent", "Concurrent invitee passphrase");
    clock.value += 30_000;
    const organizer = await signIn(
      "race.organizer",
      "Organizer race passphrase",
      organizerFactor.secret,
    );
    const real = await signIn("race.real", "Real invitee passphrase", realFactor.secret);
    const inactive = await signIn(
      "race.inactive",
      "Inactive invitee passphrase",
      inactiveFactor.secret,
    );
    const concurrent = await signIn(
      "race.concurrent",
      "Concurrent invitee passphrase",
      concurrentFactor.secret,
    );
    const household = await households.createHousehold({
      accountId: organizer.projection.accountId,
      request: { displayLabel: "Race household" },
      idempotencyKey: "race-household-create",
      correlationId: "corr_race_household",
    });

    const realInvitation = await households.createInvitation({
      accountId: organizer.projection.accountId,
      householdId: household.householdId,
      request: { inviteeLoginName: "race.real", role: "member" },
      idempotencyKey: "race-real-first",
      correlationId: "corr_race_real_first",
    });
    const decoyInvitation = await households.createInvitation({
      accountId: organizer.projection.accountId,
      householdId: household.householdId,
      request: { inviteeLoginName: "race.unknown", role: "member" },
      idempotencyKey: "race-decoy-first",
      correlationId: "corr_race_decoy_first",
    });
    const realDuplicate = households.createInvitation({
      accountId: organizer.projection.accountId,
      householdId: household.householdId,
      request: { inviteeLoginName: "race.real", role: "member" },
      idempotencyKey: "race-real-second",
      correlationId: "corr_race_real_second",
    });
    const decoyDuplicate = households.createInvitation({
      accountId: organizer.projection.accountId,
      householdId: household.householdId,
      request: { inviteeLoginName: "race.unknown", role: "member" },
      idempotencyKey: "race-decoy-second",
      correlationId: "corr_race_decoy_second",
    });
    const duplicateResults = await Promise.allSettled([realDuplicate, decoyDuplicate]);
    expect(
      duplicateResults.map((result) =>
        result.status === "rejected"
          ? {
              code: (result.reason as { code: string }).code,
              statusCode: (result.reason as { statusCode: number }).statusCode,
            }
          : result.status,
      ),
    ).toEqual([
      { code: "HOUSEHOLD_CONFLICT", statusCode: 409 },
      { code: "HOUSEHOLD_CONFLICT", statusCode: 409 },
    ]);
    await expect(
      households.respondToInvitation({
        accountId: real.projection.accountId,
        invitationToken: realInvitation.invitationToken!,
        decision: "declined",
        correlationId: "corr_race_real_decline",
      }),
    ).resolves.toMatchObject({ state: "declined" });
    await expect(
      households.revokeInvitation({
        accountId: organizer.projection.accountId,
        householdId: household.householdId,
        invitationId: decoyInvitation.invitationId,
        expectedVersion: 1,
        correlationId: "corr_race_decoy_revoke",
      }),
    ).resolves.toMatchObject({ state: "revoked" });

    const contextRace = await Promise.allSettled([
      households.upsertRecipientContext({
        accountId: organizer.projection.accountId,
        householdId: household.householdId,
        request: {
          displayLabel: "Synthetic A",
          relationshipLabel: "Relative A",
          expectedVersion: 0,
        },
        correlationId: "corr_context_race_a",
      }),
      households.upsertRecipientContext({
        accountId: organizer.projection.accountId,
        householdId: household.householdId,
        request: {
          displayLabel: "Synthetic B",
          relationshipLabel: "Relative B",
          expectedVersion: 0,
        },
        correlationId: "corr_context_race_b",
      }),
    ]);
    expect(contextRace.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(contextRace.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(
      (contextRace.find((result) => result.status === "rejected") as PromiseRejectedResult).reason,
    ).toMatchObject({ code: "HOUSEHOLD_CONFLICT", statusCode: 409 });

    const inactiveInvitation = await households.createInvitation({
      accountId: organizer.projection.accountId,
      householdId: household.householdId,
      request: { inviteeLoginName: "race.inactive", role: "caregiver" },
      idempotencyKey: "race-inactive-invite",
      correlationId: "corr_race_inactive_invite",
    });
    clock.value += 5 * 60_000;
    let rotated = await households.resendInvitation({
      accountId: organizer.projection.accountId,
      householdId: household.householdId,
      invitationId: inactiveInvitation.invitationId,
      expectedVersion: 1,
      correlationId: "corr_race_resend_1",
    });
    await expect(
      households.respondToInvitation({
        accountId: inactive.projection.accountId,
        invitationToken: inactiveInvitation.invitationToken!,
        decision: "accepted",
        correlationId: "corr_race_rotated_token",
      }),
    ).rejects.toMatchObject({ code: "HOUSEHOLD_NOT_FOUND", statusCode: 404 });
    await expect(
      households.resendInvitation({
        accountId: organizer.projection.accountId,
        householdId: household.householdId,
        invitationId: inactiveInvitation.invitationId,
        expectedVersion: 1,
        correlationId: "corr_race_stale_resend",
      }),
    ).rejects.toMatchObject({ code: "HOUSEHOLD_CONFLICT", statusCode: 409 });
    for (let resend = 2; resend <= 3; resend += 1) {
      clock.value += 5 * 60_000;
      rotated = await households.resendInvitation({
        accountId: organizer.projection.accountId,
        householdId: household.householdId,
        invitationId: inactiveInvitation.invitationId,
        expectedVersion: rotated.version,
        correlationId: `corr_race_resend_${resend}`,
      });
    }
    clock.value += 5 * 60_000;
    await expect(
      households.resendInvitation({
        accountId: organizer.projection.accountId,
        householdId: household.householdId,
        invitationId: inactiveInvitation.invitationId,
        expectedVersion: rotated.version,
        correlationId: "corr_race_resend_limited",
      }),
    ).rejects.toMatchObject({ code: "INVITATION_RATE_LIMITED", statusCode: 429 });
    await pool!.query(
      `INSERT INTO identity_household_memberships
       (membership_id, household_id, account_id, role, status, version, created_at, updated_at)
       VALUES ('membership_inactive_test', $1, $2, 'member', 'left', 1, $3, $3)`,
      [household.householdId, inactive.projection.accountId, new Date(clock.value)],
    );
    await expect(
      households.respondToInvitation({
        accountId: inactive.projection.accountId,
        invitationToken: rotated.invitationToken!,
        decision: "accepted",
        correlationId: "corr_race_inactive_accept",
      }),
    ).rejects.toMatchObject({ code: "HOUSEHOLD_CONFLICT", statusCode: 409 });
    await expect(
      pool!.query(`SELECT state FROM identity_household_invitations WHERE invitation_id = $1`, [
        inactiveInvitation.invitationId,
      ]),
    ).resolves.toMatchObject({ rows: [{ state: "pending" }] });
    await expect(
      households.getRecipientContext({
        accountId: real.projection.accountId,
        householdId: household.householdId,
      }),
    ).rejects.toMatchObject({ code: "HOUSEHOLD_NOT_FOUND", statusCode: 404 });

    const concurrentInvitation = await households.createInvitation({
      accountId: organizer.projection.accountId,
      householdId: household.householdId,
      request: { inviteeLoginName: "race.concurrent", role: "member" },
      idempotencyKey: "race-concurrent-invite",
      correlationId: "corr_race_concurrent_invite",
    });
    const terminalRace = await Promise.all([
      households.respondToInvitation({
        accountId: concurrent.projection.accountId,
        invitationToken: concurrentInvitation.invitationToken!,
        decision: "accepted",
        correlationId: "corr_race_concurrent_accept",
      }),
      households.revokeInvitation({
        accountId: organizer.projection.accountId,
        householdId: household.householdId,
        invitationId: concurrentInvitation.invitationId,
        expectedVersion: 1,
        correlationId: "corr_race_concurrent_revoke",
      }),
    ]);
    expect(terminalRace[0].state).toBe(terminalRace[1].state);
    const terminalRow = await pool!.query<{ state: string; memberships: string }>(
      `SELECT invitation.state,
              (SELECT count(*) FROM identity_household_memberships
               WHERE household_id = invitation.household_id
                 AND account_id = $2 AND status = 'active') AS memberships
       FROM identity_household_invitations AS invitation
       WHERE invitation.invitation_id = $1`,
      [concurrentInvitation.invitationId, concurrent.projection.accountId],
    );
    expect(Number(terminalRow.rows[0]!.memberships)).toBe(
      terminalRow.rows[0]!.state === "accepted" ? 1 : 0,
    );
  });

  it("keeps sign-in and recovery failure responses generic and rate limits a source", async () => {
    await enroll("known.user", "Known synthetic passphrase");
    const duplicate = await identity.register({
      request: { loginName: "known.user", password: "Another synthetic passphrase" },
      correlationId: "corr_duplicate_known",
      sourceKey: "duplicate-source",
    });
    expect(duplicate).toMatchObject({
      code: "REGISTRATION_ACCEPTED",
      messageKey: "registration.accepted",
    });
    expect(duplicate.challengeToken).toHaveLength(43);
    expect(duplicate.manualSecret.length).toBeGreaterThan(20);
    const known = await identity.beginSignIn({
      request: { loginName: "known.user", password: "Wrong synthetic passphrase" },
      correlationId: "corr_generic_known",
      sourceKey: "known-source",
    });
    const unknown = await identity.beginSignIn({
      request: { loginName: "unknown.user", password: "Wrong synthetic passphrase" },
      correlationId: "corr_generic_unknown",
      sourceKey: "unknown-source",
    });
    expect({ code: known.code, messageKey: known.messageKey }).toEqual({
      code: unknown.code,
      messageKey: unknown.messageKey,
    });
    await expect(
      identity.recoverPassword({
        request: {
          loginName: "unknown.user",
          totpCode: "000000",
          recoveryCode: "AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD",
          newPassword: "Replacement synthetic passphrase",
        },
        correlationId: "corr_recovery_unknown",
        sourceKey: "recovery-source",
      }),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED", messageKey: "recovery.accepted" });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await identity.beginSignIn({
        request: { loginName: `unknown-${attempt}`, password: "Wrong synthetic passphrase" },
        correlationId: `corr_rate_${attempt}`,
        sourceKey: "shared-rate-source",
      });
    }
    await expect(
      identity.beginSignIn({
        request: { loginName: "unknown-final", password: "Wrong synthetic passphrase" },
        correlationId: "corr_rate_final",
        sourceKey: "shared-rate-source",
      }),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_RATE_LIMITED", statusCode: 429 });
  });

  it("accepts one factor proof under concurrency and supports both bounded recovery paths", async () => {
    const enrolled = await enroll("recovery.user", "Original synthetic passphrase");
    clock.value += 30_000;
    const firstChallenge = await identity.beginSignIn({
      request: { loginName: "recovery.user", password: "Original synthetic passphrase" },
      correlationId: "corr_concurrent_1",
      sourceKey: "source-one",
    });
    const secondChallenge = await identity.beginSignIn({
      request: { loginName: "recovery.user", password: "Original synthetic passphrase" },
      correlationId: "corr_concurrent_2",
      sourceKey: "source-two",
    });
    const factor = generateTotp(enrolled.secret, clock.value);
    const settled = await Promise.allSettled([
      identity.completeSignIn({
        challengeToken: firstChallenge.challengeToken,
        code: factor,
        correlationId: "corr_concurrent_1",
        sourceKey: "source-one",
      }),
      identity.completeSignIn({
        challengeToken: secondChallenge.challengeToken,
        code: factor,
        correlationId: "corr_concurrent_2",
        sourceKey: "source-two",
      }),
    ]);
    expect(settled.filter((entry) => entry.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((entry) => entry.status === "rejected")).toHaveLength(1);
    const session = settled.find((entry) => entry.status === "fulfilled")!.value;

    clock.value += 30_000;
    const passwordRecovery = await identity.recoverPassword({
      request: {
        loginName: "recovery.user",
        totpCode: generateTotp(enrolled.secret, clock.value),
        recoveryCode: enrolled.recoveryCodes[0]!,
        newPassword: "Replacement synthetic passphrase",
      },
      correlationId: "corr_password_recovery",
      sourceKey: "recovery-password-source",
    });
    expect(passwordRecovery.recoveryCodes).toHaveLength(10);
    await expect(identity.getSession(session.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
    await expect(
      identity.recoverPassword({
        request: {
          loginName: "recovery.user",
          totpCode: generateTotp(enrolled.secret, clock.value),
          recoveryCode: enrolled.recoveryCodes[0]!,
          newPassword: "A second replacement passphrase",
        },
        correlationId: "corr_password_recovery_replay",
        sourceKey: "recovery-password-replay",
      }),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });

    const factorRecovery = await identity.beginFactorRecovery({
      request: {
        loginName: "recovery.user",
        password: "Replacement synthetic passphrase",
        recoveryCode: passwordRecovery.recoveryCodes[0]!,
      },
      correlationId: "corr_factor_recovery",
      sourceKey: "recovery-factor-source",
    });
    const confirmed = await identity.confirmFactorRecovery({
      challengeToken: factorRecovery.challengeToken,
      code: generateTotp(factorRecovery.manualSecret, clock.value),
      correlationId: "corr_factor_confirm",
      sourceKey: "recovery-factor-source",
    });
    expect(confirmed.recoveryCodes).toHaveLength(10);
    expect(await identity.countRows("identity_authenticators")).toBe(2);
  });

  it("expires an idle session and rejects a session after explicit logout", async () => {
    const enrolled = await enroll("session.user", "Session synthetic passphrase");
    clock.value += 30_000;
    const expiring = await signIn("session.user", "Session synthetic passphrase", enrolled.secret);
    clock.value += 30 * 60_000 + 1;
    await expect(identity.getSession(expiring.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });

    clock.value += 30_000;
    const revocable = await signIn("session.user", "Session synthetic passphrase", enrolled.secret);
    const current = await identity.getSession(revocable.sessionToken);
    await identity.logout({
      sessionToken: revocable.sessionToken,
      csrfToken: current.csrfToken,
      correlationId: "corr_logout_1",
    });
    await expect(identity.getSession(revocable.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
  });

  it("enforces the absolute expiry even while idle expiry is refreshed", async () => {
    const enrolled = await enroll("absolute.user", "Absolute synthetic passphrase");
    clock.value += 30_000;
    const authenticated = await signIn(
      "absolute.user",
      "Absolute synthetic passphrase",
      enrolled.secret,
    );
    for (let refresh = 0; refresh < 24; refresh += 1) {
      clock.value += 29 * 60_000;
      await expect(identity.getSession(authenticated.sessionToken)).resolves.toBeDefined();
    }
    clock.value += 29 * 60_000;
    await expect(identity.getSession(authenticated.sessionToken)).rejects.toMatchObject({
      code: "SESSION_EXPIRED",
    });
  });
});

async function enroll(loginName: string, password: string) {
  const registration = await identity.register({
    request: { loginName, password },
    correlationId: `corr_register_${loginName}`,
    sourceKey: `source-${loginName}`,
  });
  const factor = await identity.verifyRegistrationFactor({
    challengeToken: registration.challengeToken,
    code: generateTotp(registration.manualSecret, clock.value),
    correlationId: `corr_factor_${loginName}`,
    sourceKey: `source-${loginName}`,
  });
  await identity.confirmRegistrationRecovery({
    challengeToken: factor.challengeToken,
    acknowledged: true,
    correlationId: `corr_ack_${loginName}`,
  });
  return { secret: registration.manualSecret, recoveryCodes: factor.recoveryCodes };
}

async function signIn(loginName: string, password: string, secret: string) {
  const challenge = await identity.beginSignIn({
    request: { loginName, password },
    correlationId: `corr_signin_${loginName}`,
    sourceKey: `signin-${loginName}`,
  });
  return identity.completeSignIn({
    challengeToken: challenge.challengeToken,
    code: generateTotp(secret, clock.value),
    correlationId: `corr_signin_factor_${loginName}`,
    sourceKey: `signin-${loginName}`,
  });
}
