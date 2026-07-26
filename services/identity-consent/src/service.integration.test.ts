import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { generateTotp, hashPassword } from "./crypto.js";
import { migrateIdentityDatabase } from "./migration.js";
import { IdentityService } from "./service.js";

const databaseUrl = process.env.IDENTITY_DATABASE_URL ?? "";
const integration = databaseUrl ? describe : describe.skip;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 8 }) : undefined;
const clock = { value: Date.parse("2026-08-03T02:00:00.000Z") };
let identity: IdentityService;

integration("P2-S1 identity lifecycle", () => {
  beforeAll(async () => {
    await migrateIdentityDatabase(databaseUrl);
    identity = new IdentityService(pool!, {
      dataKey: Buffer.alloc(32, 7),
      rateLimitKey: Buffer.alloc(32, 9),
      dummyPasswordHash: await hashPassword("synthetic dummy password"),
      now: () => new Date(clock.value),
    });
  });

  beforeEach(async () => {
    clock.value = Date.parse("2026-08-03T02:00:00.000Z");
    await pool!.query(`TRUNCATE
      identity_audit, identity_preferences, identity_rate_limits, identity_sessions,
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
