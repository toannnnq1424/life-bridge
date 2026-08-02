import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertIsolatedRestore,
  measureRecovery,
  validateManifest,
  verifyArtifact,
  type RecoveryManifest,
} from "./p7-s3-recovery.js";

const bytes = Buffer.from("synthetic-p7-s3-backup");
const manifest: RecoveryManifest = {
  manifestVersion: 1,
  artifactId: "artifact_synthetic",
  owner: "care-coordination",
  sourceDatabase: "lifebridge_care",
  postgresqlVersion: "17.5",
  schemaVersion: 9,
  ledgerDigest: "a".repeat(64),
  artifactSha256: createHash("sha256").update(bytes).digest("hex"),
  artifactBytes: bytes.length,
  capturedAt: "2026-08-02T00:00:02.000Z",
  recoveryPointAt: "2026-08-02T00:00:00.000Z",
  encrypted: true,
  accessBoundary: "owner-scoped-task-artifact",
};

describe("P7-S3 backup verification and isolated restore guards", () => {
  it("verifies provenance-bound bytes before target creation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lifebridge-p7s3-"));
    const file = join(dir, "care.dump.enc");
    await writeFile(file, bytes);
    await expect(verifyArtifact(file, manifest)).resolves.toBeUndefined();
    await writeFile(file, Buffer.from("corrupt"));
    await expect(verifyArtifact(file, manifest)).rejects.toThrow("BACKUP_INTEGRITY_FAILED");
    await expect(verifyArtifact(join(dir, "missing"), manifest)).rejects.toThrow(
      "BACKUP_ARTIFACT_MISSING",
    );
  });
  it.each(["lifebridge_care", "postgres", "lifebridge_p7s3_restore_care_bad!", "source"])(
    "rejects unsafe target %s",
    (target) =>
      expect(() =>
        assertIsolatedRestore(target === "source" ? "source" : "lifebridge_care", target, false),
      ).toThrow("UNSAFE_RESTORE_TARGET"),
  );
  it("rejects existing targets for repeat/concurrent safety", () =>
    expect(() =>
      assertIsolatedRestore("lifebridge_care", "lifebridge_p7s3_restore_care_abcdef", true),
    ).toThrow("RESTORE_TARGET_ALREADY_EXISTS"));
  it("rejects wrong owner, stale PostgreSQL and access claims", () => {
    expect(() => validateManifest({ ...manifest, sourceDatabase: "lifebridge_identity" })).toThrow(
      "BACKUP_WRONG_OWNER",
    );
    expect(() => validateManifest({ ...manifest, postgresqlVersion: "17.4" as "17.5" })).toThrow(
      "BACKUP_VERSION_INCOMPATIBLE",
    );
    expect(() => validateManifest({ ...manifest, encrypted: false })).toThrow(
      "BACKUP_ACCESS_POLICY_REQUIRED",
    );
  });
  it("reports measured engineering RPO/RTO without PITR/DR claims", () =>
    expect(
      measureRecovery(manifest, new Date("2026-08-02T00:00:03Z"), new Date("2026-08-02T00:00:05Z")),
    ).toEqual({ rpoMs: 2000, rtoMs: 2000, claim: "measured-engineering-evidence-not-pitr-or-dr" }));
});
