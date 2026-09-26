import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  EMERGENCY_OFFLINE_DB,
  EMERGENCY_OFFLINE_ITERATIONS,
  EMERGENCY_OFFLINE_STORE,
  classifyEmergencyOfflineFreshness,
} from "./emergency-offline-store.js";

describe("P4-S2 offline emergency boundary", () => {
  it("freezes the versioned local store and PBKDF2 work factor", () => {
    expect(EMERGENCY_OFFLINE_DB).toBe("lifebridge-emergency-offline-v1");
    expect(EMERGENCY_OFFLINE_STORE).toBe("encrypted-snapshots");
    expect(EMERGENCY_OFFLINE_ITERATIONS).toBe(600_000);
  });

  it("keeps the service worker shell-only and excludes API/background retry paths", async () => {
    const worker = await publicAsset("emergency-offline-sw.js");
    expect(worker).toContain('request.method !== "GET"');
    expect(worker).toContain('request.mode !== "navigate"');
    expect(worker).toContain("EMERGENCY_PLAN_ROUTE");
    expect(worker).toContain("/emergency-offline.html");
    expect(worker).not.toMatch(
      /\/api\/|backgroundsync|request\.method\s*===\s*["'](?:POST|PUT|PATCH|DELETE)/i,
    );
  });

  it("uses a network-isolated shell and safe text rendering", async () => {
    const [html, script] = await Promise.all([
      publicAsset("emergency-offline.html"),
      publicAsset("emergency-offline.js"),
    ]);
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("referrer");
    expect(script).toContain("textContent");
    expect(script).not.toMatch(/innerHTML|insertAdjacentHTML|document\.write|\/api\//);
    expect(script).toContain("pagehide");
    expect(script).toContain("visibilitychange");
  });

  it("classifies recent, stale, backward-clock, expiry, and invalid freshness facts", () => {
    const facts = {
      savedAtUtc: "2026-07-28T04:00:00.000Z",
      lastConfirmedAtUtc: "2026-07-28T04:00:00.000Z",
      freshUntilUtc: "2026-07-29T04:00:00.000Z",
      expiresAtUtc: "2026-07-31T04:00:00.000Z",
    };
    expect(
      classifyEmergencyOfflineFreshness({
        ...facts,
        now: new Date("2026-07-29T03:59:59.999Z"),
      }),
    ).toBe("offline_recent");
    expect(
      classifyEmergencyOfflineFreshness({
        ...facts,
        now: new Date("2026-07-29T04:00:00.001Z"),
      }),
    ).toBe("offline_stale");
    expect(
      classifyEmergencyOfflineFreshness({
        ...facts,
        now: new Date("2026-07-28T03:54:59.999Z"),
      }),
    ).toBe("freshness_unknown");
    expect(
      classifyEmergencyOfflineFreshness({
        ...facts,
        now: new Date("2026-07-31T04:00:00.000Z"),
      }),
    ).toBe("freshness_expired");
    expect(
      classifyEmergencyOfflineFreshness({
        ...facts,
        expiresAtUtc: "invalid",
        now: new Date("2026-07-28T04:00:00.000Z"),
      }),
    ).toBe("integrity_failed");
  });
});

function publicAsset(name: string) {
  return readFile(resolve(process.cwd(), "apps", "web", "public", name), "utf8");
}
