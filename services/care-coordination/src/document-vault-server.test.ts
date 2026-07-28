import { describe, expect, it, vi } from "vitest";

import type { CoordinationPermission } from "@lifebridge/contracts";

import type { DocumentVaultService } from "./document-vault-service.js";
import { buildCareServer } from "./server.js";
import type { CareService } from "./service.js";

const token = "care-internal-token-for-p4s3";

describe("P4-S3 Care document attachment HTTP boundary", () => {
  it("conceals the route without the internal token", async () => {
    const download = vi.fn();
    const app = server({ download } as unknown as DocumentVaultService);
    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/coordination/households/household_synthetic/documents/document_synthetic/content/read",
      payload: {},
    });
    expect(response.statusCode).toBe(404);
    expect(download).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns bytes only as a no-store sandboxed attachment", async () => {
    const download = vi.fn(async () => ({
      metadata: {
        documentId: "document_synthetic",
        displayName: "synthetic note.txt",
        sizeBytes: 5,
        version: 1,
      },
      bytes: Buffer.from("hello"),
    }));
    const app = server({ download } as unknown as DocumentVaultService);
    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/coordination/households/household_synthetic/documents/document_synthetic/content/read",
      headers: {
        "x-internal-service-token": token,
        "x-correlation-id": "corr_p4s3_care",
      },
      payload: {
        authorization: decision(
          "coordination.document_vault.content.download",
          "document_synthetic",
        ),
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/octet-stream");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-disposition"]).toContain("synthetic%20note.txt");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["content-security-policy"]).toBe("sandbox");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toBe("hello");
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: "household_synthetic",
        documentId: "document_synthetic",
        correlationId: "corr_p4s3_care",
      }),
    );
    await app.close();
  });

  it("reports owner storage failure without inferring an empty vault", async () => {
    const list = vi.fn(async () => {
      throw new Error("synthetic database outage");
    });
    const app = server({ list } as unknown as DocumentVaultService);
    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/coordination/households/household_synthetic/documents/query",
      headers: {
        "x-internal-service-token": token,
        "x-correlation-id": "corr_p4s3_storage",
      },
      payload: {
        authorization: decision("coordination.document_vault.list"),
      },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("DOCUMENT_STORAGE_UNAVAILABLE");
    expect(response.body).not.toMatch(/documents|synthetic database outage/i);
    await app.close();
  });

  it("rejects an over-limit transport body before document processing", async () => {
    const upload = vi.fn();
    const app = server({ upload } as unknown as DocumentVaultService);
    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/coordination/households/household_synthetic/documents",
      headers: {
        "content-type": "application/json",
        "x-internal-service-token": token,
        "x-correlation-id": "corr_p4s3_body_limit",
        "idempotency-key": "p4s3-body-limit-key",
      },
      payload: {
        contentBase64: "A".repeat(530_000),
      },
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe("DOCUMENT_TOO_LARGE");
    expect(upload).not.toHaveBeenCalled();
    await app.close();
  });
});

function server(documentVault: DocumentVaultService) {
  return buildCareServer(
    {
      isReady: vi.fn(async () => true),
    } as unknown as CareService,
    token,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    documentVault,
  );
}

function decision(permission: CoordinationPermission, documentId?: string) {
  return {
    decisionId: "decision_p4s3_synthetic",
    permission,
    actor: {
      actorId: "account_synthetic",
      actorRef: "actor_ref_synthetic",
      displayKey: "coordination.actor.you",
      subject: true,
    },
    householdId: "household_synthetic",
    recipientContextId: "recipient_synthetic",
    ...(documentId ? { documentId } : {}),
    subjectId: "subject_synthetic",
    subjectVersion: 1,
    grantId: null,
    grantVersion: null,
    privacyVersion: 1,
    target: null,
    eligibleTargets: [],
    decidedAt: "2026-07-28T10:00:00.000Z",
    correlationId: "corr_p4s3_care",
    requestDigest: "a".repeat(64),
  };
}
