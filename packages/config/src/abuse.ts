import { createHash } from "node:crypto";

export type AbuseBudget = { limit: number; windowMs: number; maxConcurrent: number };
export type Admission = { allowed: boolean; retryAfterSeconds: number; dimensionDigest: string };

export class AbuseAdmissionController {
  private readonly windows = new Map<string, { start: number; count: number }>();
  private readonly concurrent = new Map<string, number>();
  constructor(private readonly now: () => number = Date.now) {}
  admit(scope: string, rawDimension: string, budget: AbuseBudget): Admission {
    if (!/^[a-z0-9_.:-]{1,64}$/u.test(scope) || !rawDimension || rawDimension.length > 256)
      return { allowed: false, retryAfterSeconds: 1, dimensionDigest: "invalid" };
    const dimensionDigest = createHash("sha256").update(rawDimension).digest("hex");
    const key = `${scope}:${dimensionDigest}`,
      timestamp = this.now();
    let window = this.windows.get(key);
    if (!window || timestamp - window.start >= budget.windowMs)
      window = { start: timestamp, count: 0 };
    const active = this.concurrent.get(key) ?? 0;
    if (window.count >= budget.limit || active >= budget.maxConcurrent)
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((window.start + budget.windowMs - timestamp) / 1000),
        ),
        dimensionDigest,
      };
    window.count += 1;
    this.windows.set(key, window);
    this.concurrent.set(key, active + 1);
    return { allowed: true, retryAfterSeconds: 0, dimensionDigest };
  }
  release(scope: string, dimensionDigest: string): void {
    const key = `${scope}:${dimensionDigest}`,
      active = this.concurrent.get(key) ?? 0;
    if (active <= 1) this.concurrent.delete(key);
    else this.concurrent.set(key, active - 1);
  }
}

export function sanitizeEvidenceField(value: string): string {
  return [...value]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code < 32 || code === 127 ? "_" : character;
    })
    .join("")
    .slice(0, 128);
}
