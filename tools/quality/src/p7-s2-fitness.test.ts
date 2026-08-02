import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const careService = "services/care-coordination/src/service.ts";
const notificationService = "services/notification/src/service.ts";
const recoveryTool = "tools/quality/src/p7-s2-recovery.ts";

describe("P7-S2 event recovery architecture fitness", () => {
  it("keeps owner code free of foreign database tables and business imports", async () => {
    const [care, notification] = await Promise.all([
      readFile(careService, "utf8"),
      readFile(notificationService, "utf8"),
    ]);
    expect(care).not.toMatch(/notification_(?:inbox|event_heads)|FROM notifications/u);
    expect(notification).not.toMatch(/care_(?:outbox|tasks|delivery_attempts)/u);
    expect(care).not.toMatch(/services\/notification/u);
    expect(notification).not.toMatch(/services\/care-coordination/u);
  });

  it("requires fenced bounded delivery and immutable consumer identity", async () => {
    const [care, notification] = await Promise.all([
      readFile(careService, "utf8"),
      readFile(notificationService, "utf8"),
    ]);
    expect(care).toContain("attempt_count < max_attempts");
    expect(care).toContain("claim_token = $4");
    expect(care).toContain("status = 'retrying'");
    expect(notification).toContain("payload_hash !== hash");
    expect(notification).toContain("pg_advisory_xact_lock");
  });

  it("keeps recovery bounded, redacted and API-only", async () => {
    const tool = await readFile(recoveryTool, "utf8");
    expect(tool).toContain("AbortSignal.timeout(2_000)");
    expect(tool).toContain("EVIDENCE_RESPONSE_TOO_LARGE");
    expect(tool).not.toMatch(/\bpg\b|DATABASE_URL|SELECT |UPDATE |DELETE /u);
    expect(tool).not.toContain("payload:");
  });
});
