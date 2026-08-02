import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { z } from "zod";

export type RuntimeMode = "local" | "test" | "production";

export interface ServiceAssertionInput {
  caller: string;
  audience: string;
  scope: string;
  keyId: string;
  secret: string;
  now?: Date;
  lifetimeSeconds?: number;
  nonce?: string;
}

export interface ServiceAssertionPolicy {
  audience: string;
  scope: string;
  allowedCallers: readonly string[];
  keys: Readonly<Record<string, string>>;
  now?: Date;
}

const assertionPart = /^[A-Za-z0-9_.-]{1,128}$/;

export function createServiceAssertion(input: ServiceAssertionInput): string {
  for (const value of [input.caller, input.audience, input.scope, input.keyId]) {
    if (!assertionPart.test(value)) throw new Error("SERVICE_IDENTITY_FIELD_INVALID");
  }
  requiredSecret(input.secret, "SERVICE_IDENTITY_KEY");
  const issuedAt = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const lifetime = Math.min(Math.max(input.lifetimeSeconds ?? 60, 10), 120);
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      kid: input.keyId,
      iss: input.caller,
      aud: input.audience,
      scope: input.scope,
      iat: issuedAt,
      exp: issuedAt + lifetime,
      nonce: input.nonce ?? randomBytes(12).toString("base64url"),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", input.secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyServiceAssertion(value: unknown, policy: ServiceAssertionPolicy): boolean {
  if (typeof value !== "string" || value.length > 1024) return false;
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0]!, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    if (typeof payload.kid !== "string" || !policy.keys[payload.kid]) return false;
    const actual = Buffer.from(parts[1]!, "base64url");
    const declaredKey = policy.keys[payload.kid];
    if (!declaredKey) return false;
    const expected = createHmac("sha256", declaredKey).update(parts[0]!).digest();
    const signatureValid = actual.length === expected.length && timingSafeEqual(actual, expected);
    if (!signatureValid) return false;
    const now = Math.floor((policy.now ?? new Date()).getTime() / 1000);
    return (
      payload.v === 1 &&
      typeof payload.iss === "string" &&
      policy.allowedCallers.includes(payload.iss) &&
      payload.aud === policy.audience &&
      payload.scope === policy.scope &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number" &&
      payload.iat <= now + 5 &&
      payload.exp >= now &&
      payload.exp - payload.iat <= 120 &&
      typeof payload.nonce === "string" &&
      /^[A-Za-z0-9_-]{16,64}$/.test(payload.nonce)
    );
  } catch {
    return false;
  }
}

export function requiredDependencyUrl(value: unknown, name: string, mode: RuntimeMode): string {
  const parsed = new URL(requiredUrl(value, name));
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(`${name}_UNSAFE`);
  }
  const loopback = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (parsed.protocol !== "https:" && !(mode !== "production" && loopback.has(parsed.hostname))) {
    throw new Error(`${name}_TRANSPORT_UNPROTECTED`);
  }
  return parsed.toString().replace(/\/$/, "");
}

export class DependencyUnavailableError extends Error {
  public constructor(public readonly reason: "circuit_open" | "bulkhead_full") {
    super(`DEPENDENCY_${reason.toUpperCase()}`);
    this.name = "DependencyUnavailableError";
  }
}

export class DependencyGuard {
  private active = 0;
  private failures = 0;
  private openUntil = 0;

  public constructor(
    private readonly options: {
      maxConcurrent: number;
      failureThreshold: number;
      openMs: number;
      now?: () => number;
    },
  ) {
    if (options.maxConcurrent < 1 || options.failureThreshold < 1 || options.openMs < 1) {
      throw new Error("DEPENDENCY_GUARD_CONFIG_INVALID");
    }
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    const now = (this.options.now ?? Date.now)();
    if (now < this.openUntil) throw new DependencyUnavailableError("circuit_open");
    if (this.active >= this.options.maxConcurrent) {
      throw new DependencyUnavailableError("bulkhead_full");
    }
    this.active += 1;
    try {
      const result = await operation();
      this.failures = 0;
      this.openUntil = 0;
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.options.failureThreshold) {
        this.openUntil = now + this.options.openMs;
      }
      throw error;
    } finally {
      this.active -= 1;
    }
  }
}

export const RuntimeModeSchema = z.enum(["local", "test", "production"]);

export function requireFixtureSafeMode(
  modeValue: unknown,
  fixtureEnabledValue: unknown,
  bindHostValue: unknown = "127.0.0.1",
  publicOriginValue: unknown = "http://127.0.0.1:3000",
): {
  mode: "local" | "test" | "production";
  fixtureEnabled: boolean;
} {
  const mode = RuntimeModeSchema.parse(modeValue);
  const fixtureEnabled = z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .parse(fixtureEnabledValue);
  const bindHost = z.string().min(1).max(255).parse(bindHostValue);
  const publicOrigin = z.url().parse(publicOriginValue);
  const originHost = new URL(publicOrigin).hostname;
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

  if (
    fixtureEnabled &&
    (mode === "production" || !loopbackHosts.has(bindHost) || !loopbackHosts.has(originHost))
  ) {
    throw new Error("FIXTURE_IDENTITY_FORBIDDEN");
  }

  return { mode, fixtureEnabled };
}

export function requiredKey(value: unknown, name: string): Buffer {
  const parsed = z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .safeParse(value);
  if (!parsed.success) {
    throw new Error(`${name}_MISSING_OR_INVALID`);
  }
  const key = Buffer.from(parsed.data, "base64url");
  if (key.length !== 32) {
    throw new Error(`${name}_MISSING_OR_INVALID`);
  }
  return key;
}

export interface RotationKeyring {
  current: { id: string; key: Buffer };
  previous?: { id: string; key: Buffer };
}

export function requiredRotationKeyring(
  currentValue: unknown,
  currentIdValue: unknown,
  previousValue: unknown,
  previousIdValue: unknown,
  name: string,
): RotationKeyring {
  const id = z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,32}$/)
    .safeParse(currentIdValue);
  if (!id.success) throw new Error(`${name}_CURRENT_ID_MISSING_OR_INVALID`);
  const current = { id: id.data, key: requiredKey(currentValue, `${name}_CURRENT`) };
  if (previousValue === undefined && previousIdValue === undefined) return { current };
  const previousId = z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,32}$/)
    .safeParse(previousIdValue);
  if (!previousId.success) throw new Error(`${name}_PREVIOUS_ID_MISSING_OR_INVALID`);
  const previous = { id: previousId.data, key: requiredKey(previousValue, `${name}_PREVIOUS`) };
  if (previous.id === current.id || timingSafeEqual(previous.key, current.key)) {
    throw new Error(`${name}_ROTATION_KEYS_NOT_DISTINCT`);
  }
  return { current, previous };
}

export function requiredPostgresUrl(value: unknown, name: string, mode: RuntimeMode): string {
  const raw = requiredUrl(value, name);
  const parsed = new URL(raw);
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw new Error(`${name}_NOT_POSTGRESQL`);
  }
  if (mode === "production" && parsed.searchParams.get("sslmode") !== "verify-full") {
    throw new Error(`${name}_TRANSPORT_UNPROTECTED`);
  }
  return raw;
}

export function requiredSecret(value: unknown, name: string): string {
  const parsed = z.string().min(24).max(256).safeParse(value);
  if (!parsed.success) {
    throw new Error(`${name}_MISSING_OR_INVALID`);
  }
  return parsed.data;
}

export function requiredUrl(value: unknown, name: string): string {
  const parsed = z.url().safeParse(value);
  if (!parsed.success) {
    throw new Error(`${name}_MISSING_OR_INVALID`);
  }
  return parsed.data;
}

export function port(value: unknown, fallback: number): number {
  return z.coerce
    .number()
    .int()
    .min(1)
    .max(65_535)
    .parse(value ?? fallback);
}
