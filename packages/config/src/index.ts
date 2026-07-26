import { z } from "zod";

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
