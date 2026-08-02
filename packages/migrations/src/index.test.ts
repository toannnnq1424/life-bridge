import { describe, expect, it } from "vitest";

import { migrationHealthLine } from "./index.js";

describe("migration health telemetry", () => {
  it("emits only the bounded owner, version, outcome, class and duration", () => {
    const line = migrationHealthLine({
      owner: "notification",
      version: 4,
      result: "failed",
      failureClass: "lock_timeout",
      durationMs: 125,
    });
    expect(JSON.parse(line)).toEqual({
      eventName: "migration.health",
      owner: "notification",
      version: 4,
      result: "failed",
      failureClass: "lock_timeout",
      durationMs: 125,
    });
    expect(line).not.toMatch(/url|password|sql|stack|row|token/i);
  });
});
