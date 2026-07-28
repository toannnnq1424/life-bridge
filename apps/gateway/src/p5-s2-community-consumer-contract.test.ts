import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function requestDigest(method: string, path: string, body: unknown): string {
  return createHash("sha256")
    .update(`${method.toUpperCase()}\n${path}\n${canonicalJson(body)}`)
    .digest("hex");
}

describe("P5-S2 Gateway to Community digest contract", () => {
  it.each([
    [
      "POST",
      "/internal/v1/community/matches/volunteer/query",
      { audience: "volunteer", organizationId: "organization_synthetic_0001" },
      "e8b1185fc3851e5184645e147b39fae2816e839d5fec3efd5e1851ee6876db58",
    ],
    [
      "POST",
      "/internal/v1/community/matches/match_synthetic_0001/progress",
      {
        checkpoint: "support_started",
        expectedVersion: 5,
        organizationId: "organization_synthetic_0001",
        submissionReference: "submission_synthetic_0003",
      },
      "827a55899cb4948d3e0c8eeef3654f998671fe92e8a82ebfc9d4c55a57978762",
    ],
    [
      "POST",
      "/internal/v1/community/matches/reconcile",
      {
        command: "progress",
        organizationId: "organization_synthetic_0001",
        submissionReference: "submission_synthetic_0003",
      },
      "7d9b883ffe50fba75a1d883e47e8725f3d1dd22f7a1be3ed0ab0469335ad7625",
    ],
  ])("freezes %s %s", (method, path, body, digest) => {
    expect(requestDigest(method, path, body)).toBe(digest);
  });

  it("sorts nested capacity keys identically across runtimes", () => {
    expect(
      requestDigest("POST", "/internal/v1/community/matches/match_synthetic_0001/offers", {
        capacitySlot: { dayPart: "morning", serviceDate: "2026-08-01" },
        expectedVersion: 2,
        expiresAt: "2026-08-01T00:00:00.000Z",
        organizationId: "organization_synthetic_0001",
        submissionReference: "submission_synthetic_0001",
        volunteerEnrollmentId: "enrollment_synthetic_0001",
      }),
    ).toBe("3e23cefda14d3b58f8d6f2067de70159b96096f451a9eed1933c662c91ce6f48");
  });
});
