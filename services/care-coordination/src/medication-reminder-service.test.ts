import { describe, expect, it } from "vitest";

import { resolveMedicationOccurrences } from "./medication-reminder-service.js";

describe("P4-S1 medication reminder recurrence resolution", () => {
  it("preserves Bangkok wall time for a finite daily series", () => {
    const occurrences = resolveMedicationOccurrences({
      localStart: "2026-08-03T08:00",
      sourceTimeZone: "Asia/Bangkok",
      sourceUtcOffset: "+07:00",
      ambiguousTimePolicy: null,
      recurrence: { frequency: "daily", intervalDays: 1, occurrenceCount: 3 },
    });
    expect(occurrences.map((item) => item.scheduledAt.toISOString())).toEqual([
      "2026-08-03T01:00:00.000Z",
      "2026-08-04T01:00:00.000Z",
      "2026-08-05T01:00:00.000Z",
    ]);
  });

  it("rejects New York DST gaps", () => {
    expect(() =>
      resolveMedicationOccurrences({
        localStart: "2026-03-08T02:30",
        sourceTimeZone: "America/New_York",
        sourceUtcOffset: "-05:00",
        ambiguousTimePolicy: null,
        recurrence: { frequency: "none" },
      }),
    ).toThrowError("MEDICATION_REMINDER_LOCAL_TIME_INVALID");
  });

  it("requires explicit overlap policy and resolves earlier/later deterministically", () => {
    const base = {
      localStart: "2026-11-01T01:30",
      sourceTimeZone: "America/New_York",
      recurrence: { frequency: "none" as const },
    };
    expect(() =>
      resolveMedicationOccurrences({
        ...base,
        sourceUtcOffset: "-04:00",
        ambiguousTimePolicy: null,
      }),
    ).toThrowError("MEDICATION_REMINDER_LOCAL_TIME_INVALID");
    expect(
      resolveMedicationOccurrences({
        ...base,
        sourceUtcOffset: "-04:00",
        ambiguousTimePolicy: "earlier",
      })[0]?.scheduledAt.toISOString(),
    ).toBe("2026-11-01T05:30:00.000Z");
    expect(
      resolveMedicationOccurrences({
        ...base,
        sourceUtcOffset: "-05:00",
        ambiguousTimePolicy: "later",
      })[0]?.scheduledAt.toISOString(),
    ).toBe("2026-11-01T06:30:00.000Z");
  });

  it("rejects ambiguity policy for an ordinary local time and mismatched offset", () => {
    expect(() =>
      resolveMedicationOccurrences({
        localStart: "2026-08-03T08:00",
        sourceTimeZone: "Asia/Bangkok",
        sourceUtcOffset: "+07:00",
        ambiguousTimePolicy: "earlier",
        recurrence: { frequency: "none" },
      }),
    ).toThrowError("MEDICATION_REMINDER_LOCAL_TIME_INVALID");
    expect(() =>
      resolveMedicationOccurrences({
        localStart: "2026-08-03T08:00",
        sourceTimeZone: "Asia/Bangkok",
        sourceUtcOffset: "+08:00",
        ambiguousTimePolicy: null,
        recurrence: { frequency: "none" },
      }),
    ).toThrowError("MEDICATION_REMINDER_LOCAL_TIME_INVALID");
  });

  it("preserves weekly wall time across a DST transition", () => {
    const occurrences = resolveMedicationOccurrences({
      localStart: "2026-10-25T08:00",
      sourceTimeZone: "America/New_York",
      sourceUtcOffset: "-04:00",
      ambiguousTimePolicy: null,
      recurrence: { frequency: "weekly", intervalWeeks: 1, occurrenceCount: 3 },
    });
    expect(occurrences.map((item) => item.offset)).toEqual(["-04:00", "-05:00", "-05:00"]);
    expect(occurrences.map((item) => item.localStart)).toEqual([
      "2026-10-25T08:00",
      "2026-11-01T08:00",
      "2026-11-08T08:00",
    ]);
  });
});
