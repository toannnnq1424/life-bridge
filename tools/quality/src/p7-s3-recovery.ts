import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export interface RecoveryManifest {
  manifestVersion: 1;
  artifactId: string;
  owner: string;
  sourceDatabase: string;
  postgresqlVersion: "17.5";
  schemaVersion: number;
  ledgerDigest: string;
  artifactSha256: string;
  artifactBytes: number;
  capturedAt: string;
  recoveryPointAt: string;
  encrypted: boolean;
  accessBoundary: "owner-scoped-task-artifact";
}

const OWNER = /^(identity-consent|care-coordination|notification|community)$/;
const SHA = /^[a-f0-9]{64}$/;
const TARGET = /^lifebridge_p7s3_restore_(identity|care|notification|community)_[a-z0-9]{6,20}$/;
const LIVE = new Set([
  "lifebridge_identity",
  "lifebridge_care",
  "lifebridge_notification",
  "lifebridge_community",
  "postgres",
]);

export async function verifyArtifact(path: string, manifest: RecoveryManifest): Promise<void> {
  validateManifest(manifest);
  const bytes = await readFile(path).catch(() => {
    throw new Error("BACKUP_ARTIFACT_MISSING");
  });
  if (
    bytes.length !== manifest.artifactBytes ||
    createHash("sha256").update(bytes).digest("hex") !== manifest.artifactSha256
  ) {
    throw new Error("BACKUP_INTEGRITY_FAILED");
  }
}

export function assertIsolatedRestore(source: string, target: string, targetExists: boolean): void {
  if (source === target || LIVE.has(target) || !TARGET.test(target))
    throw new Error("UNSAFE_RESTORE_TARGET");
  if (targetExists) throw new Error("RESTORE_TARGET_ALREADY_EXISTS");
}

export function validateManifest(value: RecoveryManifest): void {
  if (value.manifestVersion !== 1 || !OWNER.test(value.owner))
    throw new Error("BACKUP_MANIFEST_INVALID");
  if (value.postgresqlVersion !== "17.5") throw new Error("BACKUP_VERSION_INCOMPATIBLE");
  if (
    !SHA.test(value.ledgerDigest) ||
    !SHA.test(value.artifactSha256) ||
    value.artifactBytes < 1 ||
    value.schemaVersion < 1
  )
    throw new Error("BACKUP_MANIFEST_INVALID");
  if (!value.encrypted || value.accessBoundary !== "owner-scoped-task-artifact")
    throw new Error("BACKUP_ACCESS_POLICY_REQUIRED");
  if (value.owner === "identity-consent" && value.sourceDatabase !== "lifebridge_identity")
    throw new Error("BACKUP_WRONG_OWNER");
  if (value.owner === "care-coordination" && value.sourceDatabase !== "lifebridge_care")
    throw new Error("BACKUP_WRONG_OWNER");
  if (value.owner === "notification" && value.sourceDatabase !== "lifebridge_notification")
    throw new Error("BACKUP_WRONG_OWNER");
  if (value.owner === "community" && value.sourceDatabase !== "lifebridge_community")
    throw new Error("BACKUP_WRONG_OWNER");
}

export function measureRecovery(manifest: RecoveryManifest, restoreStartedAt: Date, readyAt: Date) {
  const rpoMs = Math.max(
    0,
    new Date(manifest.capturedAt).getTime() - new Date(manifest.recoveryPointAt).getTime(),
  );
  const rtoMs = readyAt.getTime() - restoreStartedAt.getTime();
  if (!Number.isFinite(rpoMs) || !Number.isFinite(rtoMs) || rtoMs < 0)
    throw new Error("RECOVERY_MEASUREMENT_INVALID");
  return { rpoMs, rtoMs, claim: "measured-engineering-evidence-not-pitr-or-dr" as const };
}
