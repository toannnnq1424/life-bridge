import { describe, expect, it } from "vitest";

import {
  ConsentGrantProjectionSchema,
  CoordinationAuthorizationRequestSchema,
  DocumentProjectionSchema,
  DocumentVaultEventSchema,
  UploadDocumentRequestSchema,
} from "./index.js";

const id = "opaque_reference_123456";

describe("P4-S3 document-vault contracts", () => {
  it("accepts the explicit consent scope without broadening old grants", () => {
    const projection = ConsentGrantProjectionSchema.parse({
      grantId: id,
      subjectId: "subject_reference_123456",
      recipientRef: "recipient_reference_123456",
      recipientDisplayKey: "consent.recipient.household_member",
      purpose: "household_coordination",
      scopes: ["recipient_context.basic_label", "document_vault.access"],
      state: "active",
      effectiveAt: "2026-07-28T00:00:00.000Z",
      revokedEffectiveAt: null,
      displayTimeZone: "Asia/Ho_Chi_Minh",
      version: 2,
    });
    expect(projection.scopes).toContain("document_vault.access");
  });

  it("binds only document-scoped reads and mutations to a document id", () => {
    const common = {
      householdId: "household_reference_123456",
      requestDigest: "a".repeat(64),
    };
    expect(
      CoordinationAuthorizationRequestSchema.parse({
        ...common,
        permission: "coordination.document_vault.list",
      }).documentId,
    ).toBeUndefined();
    expect(
      CoordinationAuthorizationRequestSchema.parse({
        ...common,
        permission: "coordination.document_vault.content.download",
        documentId: id,
      }).documentId,
    ).toBe(id);
    expect(() =>
      CoordinationAuthorizationRequestSchema.parse({
        ...common,
        permission: "coordination.document_vault.delete",
      }),
    ).toThrow(/document_scope_required/);
  });

  it("enforces canonical base64 and a bounded upload transport envelope", () => {
    expect(
      UploadDocumentRequestSchema.parse({
        uploadReference: id,
        fileName: "care-note.txt",
        declaredType: "text/plain",
        decodedSizeBytes: 5,
        contentBase64: "aGVsbG8=",
      }),
    ).toMatchObject({ decodedSizeBytes: 5 });
    expect(() =>
      UploadDocumentRequestSchema.parse({
        uploadReference: id,
        fileName: "care-note.txt",
        declaredType: "text/plain",
        decodedSizeBytes: 300_001,
        contentBase64: "aGVsbG8=",
      }),
    ).toThrow();
  });

  it("freezes unscanned truth and content-free events", () => {
    const document = DocumentProjectionSchema.parse({
      documentId: id,
      uploadReference: "upload_reference_123456",
      displayName: "care-note.txt",
      verifiedType: "text/plain",
      sizeBytes: 5,
      processingState: "ready_unscanned",
      scannerStatus: "not_configured",
      malwareStatus: "not_scanned",
      processingEvidence: "strict_text_and_integrity_validation",
      accessPolicy: "care_recipient_and_current_document_collaborators",
      retentionPolicy: "retained_until_explicit_delete",
      version: 1,
      uploadedAt: "2026-07-28T00:00:00.000Z",
      processingConfirmedAt: "2026-07-28T00:00:00.000Z",
    });
    expect(document.processingState).toBe("ready_unscanned");

    const event = DocumentVaultEventSchema.parse({
      eventId: "event_reference_123456",
      eventType: "care.document.upload_accepted.v1",
      eventVersion: 1,
      producer: "care-coordination",
      aggregateId: "vault_reference_123456",
      aggregateVersion: 1,
      occurredAt: "2026-07-28T00:00:00.000Z",
      correlationId: "corr_p4s3_contract_123456",
    });
    expect(JSON.stringify(event)).not.toMatch(/file|content|digest|size|subject|grant/i);
  });
});
