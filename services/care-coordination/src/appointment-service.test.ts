import { describe, expect, it } from "vitest";

import { resolveOccurrences } from "./appointment-service.js";

describe("P3-S2 deterministic local time resolution", () => {
  it("rejects a spring-forward gap", () => {
    expect(() =>
      resolveOccurrences({
        localStart: "2026-03-08T02:30",
        sourceTimeZone: "America/New_York",
        sourceUtcOffset: "-05:00",
        ambiguousTimePolicy: "earlier",
        durationMinutes: 60,
        recurrence: { frequency: "none" },
      }),
    ).toThrowError(expect.objectContaining({ code: "APPOINTMENT_LOCAL_TIME_INVALID" }));
  });

  it("uses the explicit overlap policy and submitted offset", () => {
    const earlier = resolveOccurrences({
      localStart: "2026-11-01T01:30",
      sourceTimeZone: "America/New_York",
      sourceUtcOffset: "-04:00",
      ambiguousTimePolicy: "earlier",
      durationMinutes: 60,
      recurrence: { frequency: "none" },
    });
    const later = resolveOccurrences({
      localStart: "2026-11-01T01:30",
      sourceTimeZone: "America/New_York",
      sourceUtcOffset: "-05:00",
      ambiguousTimePolicy: "later",
      durationMinutes: 60,
      recurrence: { frequency: "none" },
    });
    expect(earlier[0]?.startsAt.toISOString()).toBe("2026-11-01T05:30:00.000Z");
    expect(later[0]?.startsAt.toISOString()).toBe("2026-11-01T06:30:00.000Z");
    expect(() =>
      resolveOccurrences({
        localStart: "2026-11-01T01:30",
        sourceTimeZone: "America/New_York",
        sourceUtcOffset: "-04:00",
        ambiguousTimePolicy: "later",
        durationMinutes: 60,
        recurrence: { frequency: "none" },
      }),
    ).toThrowError(expect.objectContaining({ code: "APPOINTMENT_LOCAL_TIME_INVALID" }));
  });

  it("preserves weekly wall time while materializing changing offsets", () => {
    const occurrences = resolveOccurrences({
      localStart: "2026-10-25T09:00",
      sourceTimeZone: "America/New_York",
      sourceUtcOffset: "-04:00",
      ambiguousTimePolicy: "earlier",
      durationMinutes: 45,
      recurrence: { frequency: "weekly", intervalWeeks: 1, occurrenceCount: 3 },
    });
    expect(occurrences.map((item) => item.localStart)).toEqual([
      "2026-10-25T09:00",
      "2026-11-01T09:00",
      "2026-11-08T09:00",
    ]);
    expect(occurrences.map((item) => item.offset)).toEqual(["-04:00", "-05:00", "-05:00"]);
    expect(occurrences.map((item) => item.startsAt.toISOString())).toEqual([
      "2026-10-25T13:00:00.000Z",
      "2026-11-01T14:00:00.000Z",
      "2026-11-08T14:00:00.000Z",
    ]);
  });
});
