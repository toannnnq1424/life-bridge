import { createHash, randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";

import {
  CoordinationAuthorizationDecisionSchema,
  DeleteDocumentRequestSchema,
  DocumentContentMetadataSchema,
  DocumentMutationResultSchema,
  DocumentProjectionSchema,
  DocumentVaultProjectionSchema,
  UploadDocumentRequestSchema,
  type CoordinationAuthorizationDecision,
  type CoordinationPermission,
  type DeleteDocumentRequest,
  type DocumentContentMetadata,
  type DocumentMutationResult,
  type DocumentProjection,
  type DocumentVaultProjection,
  type UploadDocumentRequest,
} from "@lifebridge/contracts";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { CareError } from "./errors.js";

const DECISION_MAX_AGE_MS = 10_000;
const DECISION_FUTURE_TOLERANCE_MS = 2_000;
const MAX_DOCUMENTS = 25;

interface Options {
  now?: () => Date;
  id?: (prefix: string) => string;
  beforeCommit?: (operation: "upload" | "delete" | "integrity_failure") => void | Promise<void>;
}

interface VaultRow extends QueryResultRow {
  vault_id: string;
  household_id: string;
  recipient_context_id: string;
  vault_version: number;
}

interface DocumentRow extends QueryResultRow {
  document_id: string;
  vault_id: string;
  upload_reference: string;
  display_name: string;
  verified_type: "text/plain";
  size_bytes: number;
  processing_state: "processing" | "ready_unscanned" | "rejected" | "failed" | "integrity_failed";
  scanner_status: "not_configured";
  malware_status: "not_scanned";
  processing_evidence: "strict_text_and_integrity_validation";
  access_policy: "care_recipient_and_current_document_collaborators";
  retention_policy: "retained_until_explicit_delete";
  version: number;
  uploaded_at: Date;
  processing_confirmed_at: Date | null;
}

interface BlobRow extends QueryResultRow {
  object_id: string;
  document_id: string;
  vault_id: string;
  household_id: string;
  recipient_context_id: string;
  document_version: number;
  size_bytes: number;
  sha256_digest: string;
  binding_digest: string;
  object_bytes: Buffer;
}

interface ReplayRow extends QueryResultRow {
  request_hash: string;
  response_status: number;
  response_body: unknown;
  expires_at: Date;
}

export class DocumentVaultService {
  private readonly now: () => Date;
  private readonly id: (prefix: string) => string;

  public constructor(
    private readonly pool: Pool,
    private readonly options: Options = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? ((prefix) => `${prefix}_${randomUUID().replaceAll("-", "")}`);
  }

  public static requestDigest(value: unknown): string {
    return digestJson(value);
  }

  public async list(input: {
    householdId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<DocumentVaultProjection> {
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.document_vault.list",
      input.householdId,
      input.correlationId,
      digestJson({ operation: "document_vault.list", householdId: input.householdId }),
    );
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      open = true;
      const vault = await this.findVault(
        client,
        input.householdId,
        authorization.recipientContextId,
      );
      const documents = vault ? await this.documents(client, vault.vault_id) : [];
      const projection = DocumentVaultProjectionSchema.parse({
        vaultVersion: vault?.vault_version ?? 1,
        documents: documents.map(projectDocument),
        serverTime: this.now().toISOString(),
      });
      await client.query("COMMIT");
      open = false;
      return projection;
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async get(input: {
    householdId: string;
    documentId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<DocumentProjection> {
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.document_vault.metadata.read",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "document_vault.metadata.read",
        householdId: input.householdId,
        documentId: input.documentId,
      }),
      input.documentId,
    );
    const row = await this.authorizedDocument(
      this.pool,
      input.householdId,
      authorization.recipientContextId,
      input.documentId,
    );
    if (!row) throw inaccessible();
    return projectDocument(row);
  }

  public async upload(input: {
    householdId: string;
    request: UploadDocumentRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<DocumentMutationResult> {
    const request = UploadDocumentRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.document_vault.upload",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "document_vault.upload",
        householdId: input.householdId,
        request,
      }),
    );
    if (request.declaredType !== "text/plain") throw typeUnsupported();
    const bytes = validateContent(request);
    const displayName = validateFileName(request.fileName);
    const keyDigest = digestText(input.idempotencyKey);
    const requestHash = digestJson({
      householdId: input.householdId,
      recipientContextId: authorization.recipientContextId,
      uploadReference: request.uploadReference,
      fileName: displayName,
      declaredType: request.declaredType,
      decodedSizeBytes: request.decodedSizeBytes,
      contentDigest: digestBytes(bytes),
    });

    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      await this.lock(client, authorization.recipientContextId, "upload", keyDigest);
      const replay = await this.replay(
        client,
        "document.vault.upload",
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        if (replay.response_status !== 200) throw uploadReplayInvalidated();
        await client.query("COMMIT");
        open = false;
        return DocumentMutationResultSchema.parse(replay.response_body);
      }

      const now = this.now();
      let vault = await this.findVault(
        client,
        input.householdId,
        authorization.recipientContextId,
        true,
      );
      if (!vault) {
        const vaultId = this.id("document_vault");
        await client.query(
          `INSERT INTO care_document_vaults(
             vault_id,household_id,recipient_context_id,vault_version,created_at,updated_at
           ) VALUES ($1,$2,$3,1,$4,$4)`,
          [vaultId, input.householdId, authorization.recipientContextId, now],
        );
        vault = {
          vault_id: vaultId,
          household_id: input.householdId,
          recipient_context_id: authorization.recipientContextId,
          vault_version: 1,
        };
      } else {
        const duplicateReference = await client.query(
          `SELECT 1 FROM care_documents
           WHERE vault_id=$1 AND upload_reference=$2`,
          [vault.vault_id, request.uploadReference],
        );
        if (duplicateReference.rows[0]) throw uploadReferenceConflict();
        const count = await client.query<{ count: string }>(
          "SELECT COUNT(*)::text AS count FROM care_documents WHERE vault_id=$1",
          [vault.vault_id],
        );
        if (Number(count.rows[0]!.count) >= MAX_DOCUMENTS) throw capacityReached();
        vault.vault_version += 1;
        await client.query(
          `UPDATE care_document_vaults
           SET vault_version=$2,updated_at=$3 WHERE vault_id=$1`,
          [vault.vault_id, vault.vault_version, now],
        );
      }

      const documentId = this.id("document");
      const objectId = this.id("object");
      const sha256 = digestBytes(bytes);
      const binding = bindingDigest({
        documentId,
        vaultId: vault.vault_id,
        householdId: input.householdId,
        recipientContextId: authorization.recipientContextId,
        objectId,
        sizeBytes: bytes.length,
        version: 1,
        sha256,
      });
      await client.query(
        `INSERT INTO care_documents(
           document_id,vault_id,upload_reference,display_name,verified_type,size_bytes,
           processing_state,scanner_status,malware_status,processing_evidence,
           access_policy,retention_policy,version,uploaded_at,processing_confirmed_at
         ) VALUES (
           $1,$2,$3,$4,'text/plain',$5,'ready_unscanned','not_configured',
           'not_scanned','strict_text_and_integrity_validation',
           'care_recipient_and_current_document_collaborators',
           'retained_until_explicit_delete',1,$6,$6
         )`,
        [documentId, vault.vault_id, request.uploadReference, displayName, bytes.length, now],
      );
      await client.query(
        `INSERT INTO care_document_blobs(
           object_id,document_id,vault_id,household_id,recipient_context_id,
           document_version,size_bytes,sha256_digest,binding_digest,object_bytes,created_at
         ) VALUES ($1,$2,$3,$4,$5,1,$6,$7,$8,$9,$10)`,
        [
          objectId,
          documentId,
          vault.vault_id,
          input.householdId,
          authorization.recipientContextId,
          bytes.length,
          sha256,
          binding,
          bytes,
          now,
        ],
      );
      await this.transition(
        client,
        vault.vault_id,
        documentId,
        vault.vault_version,
        1,
        "upload_accepted",
        input.correlationId,
        now,
      );
      await this.transition(
        client,
        vault.vault_id,
        documentId,
        vault.vault_version,
        1,
        "ready_unscanned",
        input.correlationId,
        now,
      );
      await this.audit(
        client,
        authorization,
        input.householdId,
        "document.upload",
        documentId,
        input.correlationId,
        now,
      );
      await this.outbox(
        client,
        "care.document.upload_accepted.v1",
        vault.vault_id,
        vault.vault_version,
        input.correlationId,
        now,
      );
      await this.outbox(
        client,
        "care.document.processing_state_changed.v1",
        vault.vault_id,
        vault.vault_version,
        input.correlationId,
        now,
      );
      const document = DocumentProjectionSchema.parse({
        documentId,
        uploadReference: request.uploadReference,
        displayName,
        verifiedType: "text/plain",
        sizeBytes: bytes.length,
        processingState: "ready_unscanned",
        scannerStatus: "not_configured",
        malwareStatus: "not_scanned",
        processingEvidence: "strict_text_and_integrity_validation",
        accessPolicy: "care_recipient_and_current_document_collaborators",
        retentionPolicy: "retained_until_explicit_delete",
        version: 1,
        uploadedAt: now.toISOString(),
        processingConfirmedAt: now.toISOString(),
      });
      const result = DocumentMutationResultSchema.parse({
        vaultVersion: vault.vault_version,
        document,
        deletedDocumentId: null,
        confirmedAt: now.toISOString(),
      });
      await this.writeReplay(
        client,
        "document.vault.upload",
        authorization.actor.actorId,
        keyDigest,
        requestHash,
        result,
        now,
      );
      await this.options.beforeCommit?.("upload");
      await client.query("COMMIT");
      open = false;
      return result;
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async download(input: {
    householdId: string;
    documentId: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<{ metadata: DocumentContentMetadata; bytes: Buffer }> {
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.document_vault.content.download",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "document_vault.content.download",
        householdId: input.householdId,
        documentId: input.documentId,
      }),
      input.documentId,
    );
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      const document = await this.authorizedDocument(
        client,
        input.householdId,
        authorization.recipientContextId,
        input.documentId,
        true,
      );
      if (!document) throw inaccessible();
      if (document.processing_state === "processing") throw processingPending();
      if (document.processing_state !== "ready_unscanned") throw processingFailed();
      const blobResult = await client.query<BlobRow>(
        `SELECT object_id,document_id,vault_id,household_id,recipient_context_id,
                document_version,size_bytes,sha256_digest,binding_digest,object_bytes
         FROM care_document_blobs WHERE document_id=$1 FOR UPDATE`,
        [input.documentId],
      );
      const blob = blobResult.rows[0];
      const actualDigest = blob ? digestBytes(blob.object_bytes) : "";
      const actualBinding = blob
        ? bindingDigest({
            documentId: blob.document_id,
            vaultId: blob.vault_id,
            householdId: blob.household_id,
            recipientContextId: blob.recipient_context_id,
            objectId: blob.object_id,
            sizeBytes: blob.size_bytes,
            version: blob.document_version,
            sha256: blob.sha256_digest,
          })
        : "";
      if (
        !blob ||
        blob.vault_id !== document.vault_id ||
        blob.household_id !== input.householdId ||
        blob.recipient_context_id !== authorization.recipientContextId ||
        blob.document_version !== document.version ||
        blob.size_bytes !== document.size_bytes ||
        blob.object_bytes.length !== document.size_bytes ||
        actualDigest !== blob.sha256_digest ||
        actualBinding !== blob.binding_digest
      ) {
        const failedAt = this.now();
        await client.query(
          `UPDATE care_documents
           SET processing_state='integrity_failed',version=version+1,
               processing_confirmed_at=$2 WHERE document_id=$1`,
          [input.documentId, failedAt],
        );
        await client.query("DELETE FROM care_document_blobs WHERE document_id=$1", [
          input.documentId,
        ]);
        const vaultVersion = await client.query<{ vault_version: number }>(
          `UPDATE care_document_vaults
           SET vault_version=vault_version+1,updated_at=$2 WHERE vault_id=$1
           RETURNING vault_version`,
          [document.vault_id, failedAt],
        );
        await this.transition(
          client,
          document.vault_id,
          document.document_id,
          vaultVersion.rows[0]!.vault_version,
          document.version + 1,
          "integrity_failed",
          input.correlationId,
          failedAt,
        );
        await this.audit(
          client,
          authorization,
          input.householdId,
          "document.integrity_failed",
          digestText(document.document_id),
          input.correlationId,
          failedAt,
        );
        await this.outbox(
          client,
          "care.document.processing_state_changed.v1",
          document.vault_id,
          vaultVersion.rows[0]!.vault_version,
          input.correlationId,
          failedAt,
        );
        await this.options.beforeCommit?.("integrity_failure");
        await client.query("COMMIT");
        open = false;
        throw integrityFailed();
      }
      await client.query("COMMIT");
      open = false;
      return {
        metadata: DocumentContentMetadataSchema.parse({
          documentId: document.document_id,
          displayName: document.display_name,
          sizeBytes: document.size_bytes,
          version: document.version,
        }),
        bytes: Buffer.from(blob.object_bytes),
      };
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  public async delete(input: {
    householdId: string;
    documentId: string;
    request: DeleteDocumentRequest;
    idempotencyKey: string;
    authorization: CoordinationAuthorizationDecision;
    correlationId: string;
  }): Promise<DocumentMutationResult> {
    const request = DeleteDocumentRequestSchema.parse(input.request);
    const authorization = this.requireDecision(
      input.authorization,
      "coordination.document_vault.delete",
      input.householdId,
      input.correlationId,
      digestJson({
        operation: "document_vault.delete",
        householdId: input.householdId,
        documentId: input.documentId,
        request,
      }),
      input.documentId,
    );
    const keyDigest = digestText(input.idempotencyKey);
    const requestHash = digestJson({
      householdId: input.householdId,
      recipientContextId: authorization.recipientContextId,
      documentId: input.documentId,
      request,
    });
    const client = await this.pool.connect();
    let open = false;
    try {
      await client.query("BEGIN");
      open = true;
      await this.lock(client, authorization.recipientContextId, "delete", keyDigest);
      const replay = await this.replay(
        client,
        "document.vault.delete",
        authorization.actor.actorId,
        keyDigest,
      );
      if (replay) {
        if (replay.request_hash !== requestHash) throw idempotencyConflict();
        await client.query("COMMIT");
        open = false;
        return DocumentMutationResultSchema.parse(replay.response_body);
      }
      const vault = await this.findVault(
        client,
        input.householdId,
        authorization.recipientContextId,
        true,
      );
      const document = vault
        ? await this.authorizedDocument(
            client,
            input.householdId,
            authorization.recipientContextId,
            input.documentId,
            true,
          )
        : undefined;
      if (!vault || !document) throw inaccessible();
      if (vault.vault_version !== request.expectedVaultVersion) throw vaultConflict();
      if (document.version !== request.expectedDocumentVersion) throw documentConflict();
      const now = this.now();
      const nextVaultVersion = vault.vault_version + 1;
      await client.query(
        "UPDATE care_document_vaults SET vault_version=$2,updated_at=$3 WHERE vault_id=$1",
        [vault.vault_id, nextVaultVersion, now],
      );
      await this.transition(
        client,
        vault.vault_id,
        document.document_id,
        nextVaultVersion,
        document.version,
        "removed",
        input.correlationId,
        now,
      );
      await client.query(
        `INSERT INTO care_document_tombstones(
           tombstone_id,vault_id,document_id_digest,vault_version,deleted_at,correlation_id
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          this.id("tombstone"),
          vault.vault_id,
          digestText(document.document_id),
          nextVaultVersion,
          now,
          input.correlationId,
        ],
      );
      await client.query(
        `UPDATE care_idempotency
         SET response_status=409,response_body='{"deleted":true}'::jsonb
         WHERE operation='document.vault.upload'
           AND response_body #>> '{document,documentId}'=$1`,
        [document.document_id],
      );
      await client.query("DELETE FROM care_documents WHERE document_id=$1", [document.document_id]);
      await this.audit(
        client,
        authorization,
        input.householdId,
        "document.delete",
        digestText(document.document_id),
        input.correlationId,
        now,
      );
      await this.outbox(
        client,
        "care.document.removed.v1",
        vault.vault_id,
        nextVaultVersion,
        input.correlationId,
        now,
      );
      const result = DocumentMutationResultSchema.parse({
        vaultVersion: nextVaultVersion,
        document: null,
        deletedDocumentId: document.document_id,
        confirmedAt: now.toISOString(),
      });
      await this.writeReplay(
        client,
        "document.vault.delete",
        authorization.actor.actorId,
        keyDigest,
        requestHash,
        result,
        now,
      );
      await this.options.beforeCommit?.("delete");
      await client.query("COMMIT");
      open = false;
      return result;
    } catch (error) {
      if (open) await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private requireDecision(
    input: CoordinationAuthorizationDecision,
    permission: CoordinationPermission,
    householdId: string,
    correlationId: string,
    requestDigest: string,
    documentId?: string,
  ) {
    const decision = CoordinationAuthorizationDecisionSchema.parse(input);
    const age = this.now().getTime() - new Date(decision.decidedAt).getTime();
    if (
      decision.permission !== permission ||
      decision.householdId !== householdId ||
      decision.documentId !== documentId ||
      decision.correlationId !== correlationId ||
      decision.requestDigest !== requestDigest ||
      age > DECISION_MAX_AGE_MS ||
      age < -DECISION_FUTURE_TOLERANCE_MS
    ) {
      throw inaccessible();
    }
    return decision;
  }

  private async findVault(
    db: Pool | PoolClient,
    householdId: string,
    recipientContextId: string,
    forUpdate = false,
  ) {
    const result = await db.query<VaultRow>(
      `SELECT vault_id,household_id,recipient_context_id,vault_version
       FROM care_document_vaults
       WHERE household_id=$1 AND recipient_context_id=$2${forUpdate ? " FOR UPDATE" : ""}`,
      [householdId, recipientContextId],
    );
    return result.rows[0];
  }

  private async documents(db: Pool | PoolClient, vaultId: string) {
    const result = await db.query<DocumentRow>(
      `SELECT document_id,vault_id,upload_reference,display_name,verified_type,size_bytes,
              processing_state,scanner_status,malware_status,processing_evidence,
              access_policy,retention_policy,version,uploaded_at,processing_confirmed_at
       FROM care_documents WHERE vault_id=$1
       ORDER BY uploaded_at DESC,document_id`,
      [vaultId],
    );
    return result.rows;
  }

  private async authorizedDocument(
    db: Pool | PoolClient,
    householdId: string,
    recipientContextId: string,
    documentId: string,
    forUpdate = false,
  ) {
    const result = await db.query<DocumentRow>(
      `SELECT d.document_id,d.vault_id,d.upload_reference,d.display_name,d.verified_type,
              d.size_bytes,d.processing_state,d.scanner_status,d.malware_status,
              d.processing_evidence,d.access_policy,d.retention_policy,d.version,
              d.uploaded_at,d.processing_confirmed_at
       FROM care_documents d
       JOIN care_document_vaults v ON v.vault_id=d.vault_id
       WHERE d.document_id=$1 AND v.household_id=$2 AND v.recipient_context_id=$3
       ${forUpdate ? "FOR UPDATE OF d" : ""}`,
      [documentId, householdId, recipientContextId],
    );
    return result.rows[0];
  }

  private async lock(
    client: PoolClient,
    recipientContextId: string,
    operation: string,
    keyDigest: string,
  ) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `document-vault:${recipientContextId}`,
    ]);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `document-vault:${operation}:${keyDigest}`,
    ]);
  }

  private async replay(client: PoolClient, operation: string, actorId: string, key: string) {
    const result = await client.query<ReplayRow>(
      `SELECT request_hash,response_status,response_body,expires_at FROM care_idempotency
       WHERE operation=$1 AND actor_id=$2 AND idempotency_key=$3`,
      [operation, actorId, key],
    );
    const replay = result.rows[0];
    if (replay && replay.expires_at.getTime() <= this.now().getTime()) {
      await client.query(
        `DELETE FROM care_idempotency
         WHERE operation=$1 AND actor_id=$2 AND idempotency_key=$3`,
        [operation, actorId, key],
      );
      return undefined;
    }
    return replay;
  }

  private async writeReplay(
    client: PoolClient,
    operation: string,
    actorId: string,
    key: string,
    requestHash: string,
    response: unknown,
    now: Date,
  ) {
    await client.query(
      `INSERT INTO care_idempotency(
         operation,actor_id,idempotency_key,request_hash,response_status,response_body,
         created_at,expires_at
       ) VALUES ($1,$2,$3,$4,200,$5,$6,$6::timestamptz + INTERVAL '24 hours')`,
      [operation, actorId, key, requestHash, JSON.stringify(response), now],
    );
  }

  private async transition(
    client: PoolClient,
    vaultId: string,
    documentId: string,
    vaultVersion: number,
    documentVersion: number,
    action: "upload_accepted" | "ready_unscanned" | "integrity_failed" | "removed",
    correlationId: string,
    now: Date,
  ) {
    await client.query(
      `INSERT INTO care_document_transitions(
         transition_id,vault_id,document_id,vault_version,document_version,
         action,occurred_at,correlation_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        this.id("document_transition"),
        vaultId,
        documentId,
        vaultVersion,
        documentVersion,
        action,
        now,
        correlationId,
      ],
    );
  }

  private async audit(
    client: PoolClient,
    authorization: CoordinationAuthorizationDecision,
    householdId: string,
    action: string,
    resourceId: string,
    correlationId: string,
    now: Date,
  ) {
    await client.query(
      `INSERT INTO care_audit(
         audit_id,actor_id,household_id,action,resource_type,resource_id,
         result,occurred_at,correlation_id,metadata
       ) VALUES ($1,$2,$3,$4,'document_vault',$5,'success',$6,$7,'{}'::jsonb)`,
      [
        this.id("audit"),
        authorization.actor.actorId,
        householdId,
        action,
        resourceId,
        now,
        correlationId,
      ],
    );
  }

  private async outbox(
    client: PoolClient,
    eventType:
      | "care.document.upload_accepted.v1"
      | "care.document.processing_state_changed.v1"
      | "care.document.removed.v1",
    vaultId: string,
    vaultVersion: number,
    correlationId: string,
    now: Date,
  ) {
    const eventId = this.id("event");
    await client.query(
      `INSERT INTO care_outbox(
         event_id,event_type,event_version,aggregate_id,aggregate_version,
         correlation_id,causation_id,payload,occurred_at,status,attempt_count,
         next_attempt_at,delivered_at
       ) VALUES ($1,$2,1,$3,$4,$5,$1,$6,$7,'suppressed',0,$7,$7)`,
      [
        eventId,
        eventType,
        vaultId,
        vaultVersion,
        correlationId,
        JSON.stringify({
          eventId,
          eventType,
          eventVersion: 1,
          producer: "care-coordination",
          aggregateId: vaultId,
          aggregateVersion: vaultVersion,
          occurredAt: now.toISOString(),
          correlationId,
        }),
        now,
      ],
    );
  }
}

function projectDocument(row: DocumentRow): DocumentProjection {
  return DocumentProjectionSchema.parse({
    documentId: row.document_id,
    uploadReference: row.upload_reference,
    displayName: row.display_name,
    verifiedType: row.verified_type,
    sizeBytes: row.size_bytes,
    processingState: row.processing_state,
    scannerStatus: row.scanner_status,
    malwareStatus: row.malware_status,
    processingEvidence: row.processing_evidence,
    accessPolicy: row.access_policy,
    retentionPolicy: row.retention_policy,
    version: row.version,
    uploadedAt: row.uploaded_at.toISOString(),
    processingConfirmedAt: row.processing_confirmed_at?.toISOString() ?? null,
  });
}

function validateFileName(value: string): string {
  const normalized = value.normalize("NFC").trim();
  if (
    !normalized ||
    normalized.length > 120 ||
    !normalized.toLowerCase().endsWith(".txt") ||
    hasForbiddenFileNameCharacter(normalized) ||
    normalized.startsWith(".") ||
    normalized.includes("..")
  ) {
    throw validationFailed("fileName", "document.fileName.invalid");
  }
  return normalized;
}

function validateContent(request: UploadDocumentRequest): Buffer {
  const bytes = Buffer.from(request.contentBase64, "base64");
  if (bytes.toString("base64") !== request.contentBase64) {
    throw validationFailed("contentBase64", "document.content.invalid");
  }
  if (bytes.length !== request.decodedSizeBytes) {
    throw validationFailed("decodedSizeBytes", "document.size.mismatch");
  }
  if (bytes.length < 1) throw validationFailed("decodedSizeBytes", "document.size.empty");
  if (bytes.length > 262_144) {
    throw new CareError(413, "DOCUMENT_TOO_LARGE", "errors.document.tooLarge", false);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CareError(422, "DOCUMENT_CONTENT_REJECTED", "errors.document.contentRejected", false);
  }
  if (hasForbiddenContentControl(text)) {
    throw new CareError(422, "DOCUMENT_CONTENT_REJECTED", "errors.document.contentRejected", false);
  }
  return bytes;
}

function hasForbiddenFileNameCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0)!;
    return (
      character === "/" ||
      character === "\\" ||
      character === ":" ||
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    );
  });
}

function hasForbiddenContentControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0)!;
    return (
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      (code >= 0x7f && code <= 0x9f)
    );
  });
}

function bindingDigest(input: {
  documentId: string;
  vaultId: string;
  householdId: string;
  recipientContextId: string;
  objectId: string;
  sizeBytes: number;
  version: number;
  sha256: string;
}) {
  return digestJson(input);
}

function digestBytes(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function digestText(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function digestJson(value: unknown) {
  return digestText(JSON.stringify(value));
}

function inaccessible() {
  return new CareError(
    404,
    "COORDINATION_RESOURCE_NOT_FOUND",
    "errors.coordination.inaccessible",
    false,
  );
}

function validationFailed(field: string, key: string) {
  return new CareError(422, "DOCUMENT_VALIDATION_FAILED", "errors.document.validation", false, {
    [field]: key,
  });
}

function capacityReached() {
  return new CareError(409, "DOCUMENT_CAPACITY_REACHED", "errors.document.capacityReached", false);
}

function typeUnsupported() {
  return new CareError(415, "DOCUMENT_TYPE_UNSUPPORTED", "errors.document.typeUnsupported", false);
}

function documentConflict() {
  return new CareError(409, "DOCUMENT_VERSION_CONFLICT", "errors.document.versionConflict", false);
}

function vaultConflict() {
  return new CareError(409, "DOCUMENT_VAULT_CONFLICT", "errors.document.vaultConflict", false);
}

function uploadReferenceConflict() {
  return new CareError(
    409,
    "DOCUMENT_VAULT_CONFLICT",
    "errors.document.uploadReferenceConflict",
    false,
  );
}

function uploadReplayInvalidated() {
  return new CareError(
    409,
    "DOCUMENT_VAULT_CONFLICT",
    "errors.document.uploadReplayInvalidated",
    false,
  );
}

function idempotencyConflict() {
  return new CareError(409, "IDEMPOTENCY_CONFLICT", "errors.idempotency.conflict", false);
}

function processingPending() {
  return new CareError(
    409,
    "DOCUMENT_PROCESSING_PENDING",
    "errors.document.processingPending",
    true,
  );
}

function processingFailed() {
  return new CareError(
    409,
    "DOCUMENT_PROCESSING_FAILED",
    "errors.document.processingFailed",
    false,
  );
}

function integrityFailed() {
  return new CareError(409, "DOCUMENT_INTEGRITY_FAILED", "errors.document.integrityFailed", false);
}
