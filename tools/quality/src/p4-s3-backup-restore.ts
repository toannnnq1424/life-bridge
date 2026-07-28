import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

import type {
  CoordinationAuthorizationDecision,
  CoordinationPermission,
} from "../../../packages/contracts/src/index.js";
import { Pool } from "pg";

import { DocumentVaultService } from "../../../services/care-coordination/src/document-vault-service.js";
import { migrateCareDatabase } from "../../../services/care-coordination/src/migration.js";

const adminUrl = required("P1_ADMIN_DATABASE_URL");
const carePassword = required("P1_CARE_DATABASE_PASSWORD");
const container = required("P4_S3_POSTGRES_CONTAINER");
const householdId = "household_backup_p4s3";
const correlationId = "corr_backup_p4s3";
if (!/^[A-Za-z0-9_.-]{6,128}$/.test(container)) {
  throw new Error("P4_S3_POSTGRES_CONTAINER_INVALID");
}
const suffix = process.pid;
const names = {
  source: `lifebridge_p4s3_backup_source_${suffix}`,
  before: `lifebridge_p4s3_restore_before_${suffix}`,
  after: `lifebridge_p4s3_restore_after_${suffix}`,
};
const dumps = {
  before: `/tmp/lifebridge-p4s3-before-${suffix}.dump`,
  after: `/tmp/lifebridge-p4s3-after-${suffix}.dump`,
};
for (const name of Object.values(names)) {
  if (!/^[a-z0-9_]{1,63}$/.test(name)) throw new Error("P4_S3_BACKUP_DATABASE_NAME_INVALID");
}

const admin = new Pool({ connectionString: adminUrl, max: 1 });
let source: Pool | undefined;
let before: Pool | undefined;
let after: Pool | undefined;
try {
  for (const name of Object.values(names)) {
    await admin.query(`CREATE DATABASE ${name} OWNER lifebridge_care`);
  }
  const sourceUrl = ownerDatabaseUrl(adminUrl, names.source, carePassword);
  await migrateCareDatabase(sourceUrl);
  source = new Pool({ connectionString: sourceUrl, max: 3 });
  const clock = new Date("2026-07-28T11:00:00.000Z");
  let sequence = 0;
  const service = new DocumentVaultService(source, {
    now: () => new Date(clock),
    id: (prefix) => `${prefix}_backup_${++sequence}`,
  });
  const content = Buffer.from("Synthetic P4-S3 backup document\n", "utf8");
  const request = {
    uploadReference: "upload_backup_p4s3",
    fileName: "synthetic-backup.txt",
    declaredType: "text/plain" as const,
    decodedSizeBytes: content.length,
    contentBase64: content.toString("base64"),
  };
  const uploaded = await service.upload({
    householdId,
    request,
    idempotencyKey: "backup-upload-p4s3",
    authorization: authorize(
      "coordination.document_vault.upload",
      DocumentVaultService.requestDigest({
        operation: "document_vault.upload",
        householdId,
        request,
      }),
      clock,
    ),
    correlationId,
  });
  const document = uploaded.document!;

  dump(container, names.source, dumps.before);
  restore(container, names.before, dumps.before);
  before = new Pool({
    connectionString: ownerDatabaseUrl(adminUrl, names.before, carePassword),
    max: 1,
  });
  const restoredBefore = await before.query<{
    object_bytes: Buffer;
    sha256_digest: string;
    binding_digest: string;
    documents: string;
  }>(
    `SELECT b.object_bytes,b.sha256_digest,b.binding_digest,
            (SELECT COUNT(*)::text FROM care_documents) AS documents
     FROM care_document_blobs b WHERE b.document_id=$1`,
    [document.documentId],
  );
  const beforeRow = restoredBefore.rows[0];
  if (
    !beforeRow ||
    beforeRow.documents !== "1" ||
    !beforeRow.object_bytes.equals(content) ||
    beforeRow.sha256_digest !== createHash("sha256").update(content).digest("hex") ||
    !/^[a-f0-9]{64}$/.test(beforeRow.binding_digest)
  ) {
    throw new Error("P4_S3_PRE_DELETE_BACKUP_RESTORE_FAILED");
  }

  await service.delete({
    householdId,
    documentId: document.documentId,
    request: {
      expectedVaultVersion: uploaded.vaultVersion,
      expectedDocumentVersion: document.version,
    },
    idempotencyKey: "backup-delete-p4s3",
    authorization: authorize(
      "coordination.document_vault.delete",
      DocumentVaultService.requestDigest({
        operation: "document_vault.delete",
        householdId,
        documentId: document.documentId,
        request: {
          expectedVaultVersion: uploaded.vaultVersion,
          expectedDocumentVersion: document.version,
        },
      }),
      clock,
      document.documentId,
    ),
    correlationId,
  });
  const activeAfterDelete = await source.query<{
    documents: string;
    blobs: string;
    tombstones: string;
  }>(`
    SELECT
      (SELECT COUNT(*)::text FROM care_documents) AS documents,
      (SELECT COUNT(*)::text FROM care_document_blobs) AS blobs,
      (SELECT COUNT(*)::text FROM care_document_tombstones) AS tombstones
  `);
  if (
    activeAfterDelete.rows[0]?.documents !== "0" ||
    activeAfterDelete.rows[0]?.blobs !== "0" ||
    activeAfterDelete.rows[0]?.tombstones !== "1"
  ) {
    throw new Error("P4_S3_ACTIVE_DELETE_BEFORE_BACKUP_FAILED");
  }

  dump(container, names.source, dumps.after);
  restore(container, names.after, dumps.after);
  after = new Pool({
    connectionString: ownerDatabaseUrl(adminUrl, names.after, carePassword),
    max: 1,
  });
  const restoredAfter = await after.query<{
    documents: string;
    blobs: string;
    tombstones: string;
    sensitiveReplay: string;
  }>(`
    SELECT
      (SELECT COUNT(*)::text FROM care_documents) AS documents,
      (SELECT COUNT(*)::text FROM care_document_blobs) AS blobs,
      (SELECT COUNT(*)::text FROM care_document_tombstones) AS tombstones,
      (
        SELECT COUNT(*)::text FROM care_idempotency
        WHERE response_body::text ILIKE '%synthetic-backup%'
           OR response_body::text ILIKE '%text/plain%'
           OR response_body::text ILIKE '%sizeBytes%'
      ) AS "sensitiveReplay"
  `);
  if (
    restoredAfter.rows[0]?.documents !== "0" ||
    restoredAfter.rows[0]?.blobs !== "0" ||
    restoredAfter.rows[0]?.tombstones !== "1" ||
    restoredAfter.rows[0]?.sensitiveReplay !== "0"
  ) {
    throw new Error("P4_S3_POST_DELETE_NON_RESURRECTION_FAILED");
  }
  console.log(
    "P4-S3 owner-local pre-delete restore and post-delete non-resurrection rehearsal passed.",
  );
} finally {
  await source?.end();
  await before?.end();
  await after?.end();
  for (const dumpPath of Object.values(dumps)) {
    try {
      execFileSync("docker", ["exec", container, "rm", "-f", dumpPath], {
        stdio: "ignore",
      });
    } catch {
      // Preserve the primary validation error; Level C also destroys its task-owned volume.
    }
  }
  for (const database of Object.values(names)) {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [database],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  }
  await admin.end();
}

function dump(containerName: string, database: string, path: string) {
  execFileSync(
    "docker",
    ["exec", containerName, "pg_dump", "-U", "postgres", "-Fc", "-f", path, database],
    { stdio: "ignore" },
  );
}

function restore(containerName: string, database: string, path: string) {
  execFileSync(
    "docker",
    [
      "exec",
      containerName,
      "pg_restore",
      "-U",
      "postgres",
      "--no-owner",
      "--role=lifebridge_care",
      "-d",
      database,
      path,
    ],
    { stdio: "ignore" },
  );
}

function authorize(
  permission: CoordinationPermission,
  requestDigest: string,
  clock: Date,
  documentId?: string,
): CoordinationAuthorizationDecision {
  return {
    decisionId: `decision_backup_${permission.replaceAll(".", "_")}`,
    permission,
    actor: {
      actorId: "account_backup_p4s3",
      actorRef: "actor_backup_p4s3",
      displayKey: "coordination.actor.you",
      subject: true,
    },
    householdId,
    recipientContextId: "recipient_backup_p4s3",
    ...(documentId ? { documentId } : {}),
    subjectId: "subject_backup_p4s3",
    subjectVersion: 1,
    grantId: null,
    grantVersion: null,
    privacyVersion: 1,
    target: null,
    eligibleTargets: [],
    decidedAt: clock.toISOString(),
    correlationId,
    requestDigest,
  };
}

function ownerDatabaseUrl(adminUrlValue: string, databaseName: string, password: string) {
  const value = new URL(adminUrlValue);
  value.username = "lifebridge_care";
  value.password = password;
  value.pathname = `/${databaseName}`;
  return value.toString();
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
