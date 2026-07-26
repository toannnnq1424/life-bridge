import { z } from "zod";

export const RuntimeModeSchema = z.enum(["local", "test", "production"]);

export function requireFixtureSafeMode(
  modeValue: unknown,
  fixtureEnabledValue: unknown,
): {
  mode: "local" | "test" | "production";
  fixtureEnabled: boolean;
} {
  const mode = RuntimeModeSchema.parse(modeValue);
  const fixtureEnabled = z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .parse(fixtureEnabledValue);

  if (mode === "production" && fixtureEnabled) {
    throw new Error("FIXTURE_IDENTITY_FORBIDDEN");
  }

  return { mode, fixtureEnabled };
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
