import type {
  CoordinationAuthorizationDecision,
  CoordinationPermission,
  DeleteDocumentRequest,
  UploadDocumentRequest,
} from "@lifebridge/contracts";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DocumentVaultService } from "./document-vault-service.js";
import { migrateCareDatabase } from "./migration.js";

const databaseUrl = process.env.CARE_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("P4-S3 Care-owned document vault", () => {
  let pool: Pool;
  let service: DocumentVaultService;
  const clock = new Date("2026-07-28T10:00:00.000Z");
  let sequence = 0;

  beforeAll(async () => {
    await migrateCareDatabase(databaseUrl!);
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE care_document_tombstones,
               care_document_transitions,
               care_document_blobs,
               care_documents,
               care_document_vaults,
               care_outbox,care_audit,care_idempotency
      RESTART IDENTITY CASCADE
    `);
    sequence = 0;
    service = makeService();
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("uploads, lists, reads, downloads, and actively deletes a strict synthetic document", async () => {
    const uploaded = await upload(textRequest("Synthetic coordination note\n"));
    expect(uploaded).toMatchObject({
      vaultVersion: 1,
      document: {
        displayName: "synthetic-note.txt",
        verifiedType: "text/plain",
        processingState: "ready_unscanned",
        scannerStatus: "not_configured",
        malwareStatus: "not_scanned",
        retentionPolicy: "retained_until_explicit_delete",
      },
    });
    const document = uploaded.document!;

    const listed = await service.list({
      householdId: householdId,
      authorization: authorize(
        "coordination.document_vault.list",
        digest({ operation: "document_vault.list", householdId }),
      ),
      correlationId,
    });
    expect(listed.documents).toEqual([document]);

    const metadata = await service.get({
      householdId,
      documentId: document.documentId,
      authorization: authorize(
        "coordination.document_vault.metadata.read",
        digest({
          operation: "document_vault.metadata.read",
          householdId,
          documentId: document.documentId,
        }),
        document.documentId,
      ),
      correlationId,
    });
    expect(metadata).toEqual(document);

    const downloaded = await download(document.documentId);
    expect(downloaded.metadata.displayName).toBe("synthetic-note.txt");
    expect(downloaded.bytes.toString("utf8")).toBe("Synthetic coordination note\n");

    const deleted = await remove(document.documentId, {
      expectedVaultVersion: 1,
      expectedDocumentVersion: 1,
    });
    expect(deleted).toMatchObject({
      vaultVersion: 2,
      document: null,
      deletedDocumentId: document.documentId,
    });
    await expectCount("care_documents", 0);
    await expectCount("care_document_blobs", 0);
    await expectCount("care_document_tombstones", 1);
    await expect(download(document.documentId)).rejects.toMatchObject({
      code: "COORDINATION_RESOURCE_NOT_FOUND",
    });

    const evidence = await pool.query<{ evidence: string }>(`
      SELECT payload::text AS evidence FROM care_outbox
      UNION ALL
      SELECT metadata::text AS evidence FROM care_audit
      UNION ALL
      SELECT to_jsonb(t)::text AS evidence FROM care_document_transitions t
      UNION ALL
      SELECT to_jsonb(t)::text AS evidence FROM care_document_tombstones t
    `);
    expect(JSON.stringify(evidence.rows)).not.toMatch(
      /Synthetic coordination|synthetic-note|text\/plain|sha256|object_/i,
    );
    const replay = await pool.query<{ response_body: unknown }>(
      `SELECT response_body FROM care_idempotency
       WHERE operation LIKE 'document.vault.%'`,
    );
    expect(JSON.stringify(replay.rows)).not.toMatch(
      /Synthetic coordination|synthetic-note|text\/plain|sizeBytes|contentBase64|sha256|binding|object_/i,
    );
    await expect(upload(textRequest("Synthetic coordination note\n"))).rejects.toMatchObject({
      code: "DOCUMENT_VAULT_CONFLICT",
    });
    await expectCount("care_outbox", 3);
    await expectCount("care_audit", 2);
  });

  it("rejects spoofed, oversized, malformed UTF-8, control content and unsafe names", async () => {
    await expect(
      upload({
        ...textRequest("hello"),
        declaredType: "application/pdf",
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_TYPE_UNSUPPORTED" });
    const oversized = Buffer.alloc(262_145, 0x61);
    await expect(
      upload({
        ...textRequest("hello"),
        uploadReference: "upload_oversized_synthetic",
        decodedSizeBytes: oversized.length,
        contentBase64: oversized.toString("base64"),
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_TOO_LARGE" });
    await expect(
      upload({
        ...textRequest("hello"),
        fileName: "../synthetic.txt",
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_VALIDATION_FAILED" });
    await expect(
      upload({
        ...textRequest("hello"),
        decodedSizeBytes: 6,
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_VALIDATION_FAILED" });
    await expect(
      upload({
        ...textRequest("hello"),
        contentBase64: Buffer.from([0xc3, 0x28]).toString("base64"),
        decodedSizeBytes: 2,
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_CONTENT_REJECTED" });
    await expect(upload(textRequest("hello\u0000"))).rejects.toMatchObject({
      code: "DOCUMENT_CONTENT_REJECTED",
    });
    await expectCount("care_documents", 0);
    await expectCount("care_document_blobs", 0);
  });

  it("replays the same intent, rejects changed intent, and rolls back injected failure", async () => {
    const request = textRequest("same intent");
    const first = await upload(request, "same-idempotency-key");
    const replay = await upload(request, "same-idempotency-key");
    expect(replay).toEqual(first);
    await expect(upload(request, "different-idempotency-key")).rejects.toMatchObject({
      code: "DOCUMENT_VAULT_CONFLICT",
    });
    await expect(
      upload(textRequest("changed intent"), "same-idempotency-key"),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    await expectCount("care_documents", 1);

    service = makeService((operation) => {
      if (operation === "upload") throw new Error("injected_storage_failure");
    });
    await expect(upload(textRequest("rolled back"), "rollback-key")).rejects.toThrow(
      "injected_storage_failure",
    );
    await expectCount("care_documents", 1);
    await expectCount("care_document_blobs", 1);

    service = makeService((operation) => {
      if (operation === "delete") throw new Error("injected_delete_failure");
    });
    await expect(
      remove(first.document!.documentId, {
        expectedVaultVersion: first.vaultVersion,
        expectedDocumentVersion: first.document!.version,
      }),
    ).rejects.toThrow("injected_delete_failure");
    await expectCount("care_documents", 1);
    await expectCount("care_document_blobs", 1);
    await expectCount("care_document_tombstones", 0);
  });

  it("serializes concurrent replay and enforces the active-vault capacity", async () => {
    const concurrentRequest = textRequest("concurrent intent");
    const concurrent = await Promise.all([
      upload(concurrentRequest, "concurrent-idempotency-key"),
      upload(concurrentRequest, "concurrent-idempotency-key"),
    ]);
    expect(concurrent[1]).toEqual(concurrent[0]);
    await expectCount("care_documents", 1);

    for (let index = 2; index <= 25; index += 1) {
      await upload(
        {
          ...textRequest(`capacity object ${index}`),
          uploadReference: `capacity_ref_${index}`,
        },
        `capacity-key-${index}`,
      );
    }
    await expectCount("care_documents", 25);
    await expect(
      upload(
        {
          ...textRequest("capacity object 26"),
          uploadReference: "capacity_ref_26",
        },
        "capacity-key-26",
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_CAPACITY_REACHED" });
    await expectCount("care_documents", 25);
  });

  it("fails closed on swapped bytes and records only content-free integrity evidence", async () => {
    const first = (await upload(textRequest("first object"), "first-key")).document!;
    const second = (await upload(textRequest("other object"), "second-key")).document!;
    await pool.query(
      `UPDATE care_document_blobs a
       SET object_bytes=b.object_bytes
       FROM care_document_blobs b
       WHERE a.document_id=$1 AND b.document_id=$2`,
      [first.documentId, second.documentId],
    );
    await expect(download(first.documentId)).rejects.toMatchObject({
      code: "DOCUMENT_INTEGRITY_FAILED",
    });
    const state = await pool.query<{ processing_state: string; blobs: string }>(
      `SELECT d.processing_state,
              (SELECT COUNT(*)::text FROM care_document_blobs b
               WHERE b.document_id=d.document_id) AS blobs
       FROM care_documents d WHERE d.document_id=$1`,
      [first.documentId],
    );
    expect(state.rows[0]).toEqual({ processing_state: "integrity_failed", blobs: "0" });
    await expect(download(first.documentId)).rejects.toMatchObject({
      code: "DOCUMENT_PROCESSING_FAILED",
    });
  });

  it("blocks retrieval for authoritative processing and failed states", async () => {
    const document = (await upload(textRequest("processing object"))).document!;
    await pool.query(
      "UPDATE care_documents SET processing_state='processing' WHERE document_id=$1",
      [document.documentId],
    );
    await expect(download(document.documentId)).rejects.toMatchObject({
      code: "DOCUMENT_PROCESSING_PENDING",
    });
    await pool.query("UPDATE care_documents SET processing_state='failed' WHERE document_id=$1", [
      document.documentId,
    ]);
    await expect(download(document.documentId)).rejects.toMatchObject({
      code: "DOCUMENT_PROCESSING_FAILED",
    });
  });

  it("rejects stale/unbound/expired authority and stale delete without data loss", async () => {
    const document = (await upload(textRequest("protected object"))).document!;
    await expect(
      service.get({
        householdId,
        documentId: document.documentId,
        authorization: authorize(
          "coordination.document_vault.metadata.read",
          digest({
            operation: "document_vault.metadata.read",
            householdId,
            documentId: "document_wrong_scope",
          }),
          "document_wrong_scope",
        ),
        correlationId,
      }),
    ).rejects.toMatchObject({ code: "COORDINATION_RESOURCE_NOT_FOUND" });
    const expired = authorize(
      "coordination.document_vault.list",
      digest({ operation: "document_vault.list", householdId }),
    );
    expired.decidedAt = "2026-07-28T09:59:40.000Z";
    await expect(
      service.list({ householdId, authorization: expired, correlationId }),
    ).rejects.toMatchObject({ code: "COORDINATION_RESOURCE_NOT_FOUND" });
    await expect(
      remove(document.documentId, {
        expectedVaultVersion: 99,
        expectedDocumentVersion: document.version,
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_VAULT_CONFLICT" });
    await expect(
      remove(document.documentId, {
        expectedVaultVersion: 1,
        expectedDocumentVersion: 99,
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_VERSION_CONFLICT" });
    await expectCount("care_documents", 1);
    await expectCount("care_document_blobs", 1);
  });

  function makeService(
    beforeCommit?: (operation: "upload" | "delete" | "integrity_failure") => void | Promise<void>,
  ) {
    return new DocumentVaultService(pool, {
      now: () => new Date(clock),
      id: (prefix) => `${prefix}_p4s3_${++sequence}`,
      ...(beforeCommit ? { beforeCommit } : {}),
    });
  }

  function authorize(
    permission: CoordinationPermission,
    requestDigest: string,
    documentId?: string,
  ): CoordinationAuthorizationDecision {
    return {
      decisionId: `decision_p4s3_${++sequence}`,
      permission,
      actor: {
        actorId: "account_p4s3",
        actorRef: "actor_ref_p4s3",
        displayKey: "coordination.actor.you",
        subject: true,
      },
      householdId,
      recipientContextId: "recipient_context_p4s3",
      ...(documentId ? { documentId } : {}),
      subjectId: "subject_p4s3",
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

  function upload(request: UploadDocumentRequest, idempotencyKey = "upload-key-p4s3") {
    return service.upload({
      householdId,
      request,
      idempotencyKey,
      authorization: authorize(
        "coordination.document_vault.upload",
        digest({ operation: "document_vault.upload", householdId, request }),
      ),
      correlationId,
    });
  }

  function download(documentId: string) {
    return service.download({
      householdId,
      documentId,
      authorization: authorize(
        "coordination.document_vault.content.download",
        digest({ operation: "document_vault.content.download", householdId, documentId }),
        documentId,
      ),
      correlationId,
    });
  }

  function remove(documentId: string, request: DeleteDocumentRequest) {
    return service.delete({
      householdId,
      documentId,
      request,
      idempotencyKey: `delete-${documentId}`,
      authorization: authorize(
        "coordination.document_vault.delete",
        digest({ operation: "document_vault.delete", householdId, documentId, request }),
        documentId,
      ),
      correlationId,
    });
  }

  function digest(value: unknown) {
    return DocumentVaultService.requestDigest(value);
  }

  async function expectCount(table: string, count: number) {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${table}`,
    );
    expect(Number(result.rows[0]!.count)).toBe(count);
  }
});

const householdId = "household_p4s3";
const correlationId = "corr_p4s3";

function textRequest(content: string): UploadDocumentRequest {
  const bytes = Buffer.from(content, "utf8");
  return {
    uploadReference: `upload_ref_${Buffer.from(content).toString("hex").slice(0, 24)}`,
    fileName: "synthetic-note.txt",
    declaredType: "text/plain",
    decodedSizeBytes: bytes.length,
    contentBase64: bytes.toString("base64"),
  };
}
