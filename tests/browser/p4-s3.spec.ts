import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const csrf = "C".repeat(43);
const confirmedAt = "2026-07-28T10:00:00.000Z";

interface SyntheticState {
  mode: "ready" | "denied" | "unavailable" | "rejected" | "conflict" | "uncertain" | "slow";
  vaultVersion: number;
  documents: ReturnType<typeof documentProjection>[];
  mutations: Array<{
    method: string;
    body: Record<string, unknown>;
    headers: Record<string, string>;
  }>;
}

async function syntheticApi(page: Page): Promise<SyntheticState> {
  const state: SyntheticState = {
    mode: "ready",
    vaultVersion: 1,
    documents: [],
    mutations: [],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/account/session") return json(route, 200, session());
    if (state.mode === "denied") return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
    if (state.mode === "unavailable") {
      return failure(route, 503, "DOCUMENT_STORAGE_UNAVAILABLE");
    }
    if (path.endsWith("/documents") && request.method() === "GET") {
      return json(route, 200, {
        vaultVersion: state.vaultVersion,
        documents: state.documents,
        serverTime: confirmedAt,
      });
    }
    if (path.endsWith("/documents") && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.mutations.push({ method: request.method(), body, headers: request.headers() });
      if (state.mode === "rejected") return failure(route, 422, "DOCUMENT_CONTENT_REJECTED");
      if (state.mode === "conflict") return failure(route, 409, "DOCUMENT_VAULT_CONFLICT");
      if (state.mode === "uncertain") return failure(route, 503, "DOCUMENT_RESULT_UNKNOWN");
      if (state.mode === "slow") {
        await new Promise((resolve) => setTimeout(resolve, 750));
        return failure(route, 503, "DOCUMENT_RESULT_UNKNOWN");
      }
      state.vaultVersion += state.documents.length ? 1 : 0;
      const document = documentProjection({
        documentId: "document_uploaded",
        uploadReference: String(body.uploadReference),
        displayName: String(body.fileName),
        sizeBytes: Number(body.decodedSizeBytes),
      });
      state.documents = [document, ...state.documents];
      return json(route, 201, {
        vaultVersion: state.vaultVersion,
        document,
        deletedDocumentId: null,
        confirmedAt,
      });
    }
    if (path.endsWith("/content") && request.method() === "GET") {
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": 'attachment; filename="synthetic-note.txt"',
          "x-content-type-options": "nosniff",
          "content-security-policy": "sandbox",
        },
        body: "Synthetic document",
      });
    }
    if (path.includes("/documents/") && request.method() === "DELETE") {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.mutations.push({ method: request.method(), body, headers: request.headers() });
      if (state.mode === "conflict") return failure(route, 409, "DOCUMENT_VERSION_CONFLICT");
      if (state.mode === "uncertain") return failure(route, 503, "DOCUMENT_RESULT_UNKNOWN");
      const documentId = path.split("/").at(-1)!;
      state.documents = state.documents.filter((document) => document.documentId !== documentId);
      state.vaultVersion += 1;
      return json(route, 200, {
        vaultVersion: state.vaultVersion,
        document: null,
        deletedDocumentId: documentId,
        confirmedAt,
      });
    }
    return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
  });
  return state;
}

test("LB-023 validates, uploads with native picker, downloads as attachment, and deletes with explicit effect", async ({
  page,
}) => {
  const api = await syntheticApi(page);
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/households/household_synthetic/documents");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(page.getByText(/Malware scanner: not configured/).first()).toBeVisible();
  await expect(page.getByText(/No documents are currently available/)).toBeVisible();

  await page.getByLabel("Text document").setInputFiles({
    name: "unsafe.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("synthetic"),
  });
  await expect(page.locator(".error-summary")).toContainText("final .txt filename");
  expect(api.mutations).toHaveLength(0);

  await page.getByLabel("Text document").setInputFiles({
    name: "synthetic-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Synthetic document"),
  });
  await page.getByRole("button", { name: "Upload for validation" }).click();
  await expect(page.getByRole("heading", { name: /Upload confirmed/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "synthetic-note.txt" })).toBeVisible();
  expect(api.mutations).toHaveLength(1);
  expect(api.mutations[0]?.headers["x-csrf-token"]).toBe(csrf);
  expect(api.mutations[0]?.headers["idempotency-key"]).toBeTruthy();
  expect(api.mutations[0]?.body).toMatchObject({
    fileName: "synthetic-note.txt",
    declaredType: "text/plain",
    decodedSizeBytes: 18,
  });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download attachment" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("synthetic-note.txt");
  await expect(page.getByRole("heading", { name: /attachment response was issued/ })).toBeVisible();
  expect(await page.locator("iframe,object,embed").count()).toBe(0);

  await page.getByRole("button", { name: "Review deletion" }).click();
  await expect(page.getByRole("dialog")).toContainText("no LifeBridge undo or server restore");
  await page.getByRole("button", { name: "Delete active copy" }).click();
  await expect(page.getByRole("heading", { name: /Deletion confirmed/ })).toBeFocused();
  await expect(page.getByText(/No documents are currently available/)).toBeVisible();
  expect(api.mutations.at(-1)?.method).toBe("DELETE");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-023 distinguishes processing, failure, denied, storage outage, conflict, uncertainty and offline no-queue", async ({
  context,
  page,
}) => {
  const api = await syntheticApi(page);
  api.documents = [
    documentProjection({ documentId: "document_processing", processingState: "processing" }),
    documentProjection({ documentId: "document_rejected", processingState: "rejected" }),
    documentProjection({ documentId: "document_failed", processingState: "failed" }),
    documentProjection({
      documentId: "document_integrity",
      processingState: "integrity_failed",
    }),
  ];
  await page.goto("/households/household_synthetic/documents");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(page.getByText(/Processing — download is not available/)).toBeVisible();
  await expect(page.getByText(/Rejected — temporary bytes were removed/)).toBeVisible();
  await expect(page.getByText(/Integrity check failed/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Download attachment" }).first()).toBeDisabled();

  api.mode = "denied";
  await page.reload();
  await page.locator(".document-vault-header select").selectOption("en");
  await expect(
    page.getByRole("heading", { name: /lacks document-specific authority/ }),
  ).toBeFocused();
  await expect(page.getByRole("heading", { name: "synthetic-note.txt" })).toHaveCount(0);
  api.mode = "unavailable";
  await page.reload();
  await page.locator(".document-vault-header select").selectOption("en");
  await expect(
    page.getByRole("heading", { name: /storage or a required service is unavailable/ }),
  ).toBeFocused();
  await expect(page.getByText(/No documents are currently available/)).toHaveCount(0);
  await expect(page.getByLabel("Text document")).toHaveCount(0);

  api.mode = "ready";
  api.documents = [];
  await page.reload();
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await page.getByLabel("Text document").setInputFiles({
    name: "server-rejected.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("server rejection"),
  });
  api.mode = "rejected";
  await page.getByRole("button", { name: "Upload for validation" }).click();
  await expect(page.getByRole("heading", { name: /Rejected/ })).toBeFocused();
  await expect(page.locator(".failure-code")).toHaveText("DOCUMENT_CONTENT_REJECTED");
  expect(
    await page
      .getByLabel("Text document")
      .evaluate((input: HTMLInputElement) => input.files?.length),
  ).toBe(0);

  await page.getByLabel("Text document").setInputFiles({
    name: "conflict.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("conflict"),
  });
  api.mode = "conflict";
  await page.getByRole("button", { name: "Upload for validation" }).click();
  await expect(page.getByRole("heading", { name: /vault changed/ })).toBeFocused();
  api.mode = "ready";
  await page.getByRole("button", { name: "Check current state" }).click();
  api.mode = "uncertain";
  await page.getByRole("button", { name: "Upload for validation" }).click();
  await expect(page.getByRole("heading", { name: /request result is uncertain/ })).toBeFocused();
  const uncertainAttempt = api.mutations.at(-1)!;
  api.mode = "ready";
  await page.getByRole("button", { name: "Check current state" }).click();
  await page.getByRole("button", { name: "Upload for validation" }).click();
  await expect(page.getByRole("heading", { name: /Upload confirmed/ })).toBeVisible();
  expect(api.mutations.at(-1)?.body.uploadReference).toBe(uncertainAttempt.body.uploadReference);
  expect(api.mutations.at(-1)?.headers["idempotency-key"]).toBe(
    uncertainAttempt.headers["idempotency-key"],
  );

  api.mode = "uncertain";
  await page.getByRole("button", { name: "Review deletion" }).click();
  await page.getByRole("button", { name: "Delete active copy" }).click();
  await expect(page.getByRole("heading", { name: /request result is uncertain/ })).toBeFocused();
  const uncertainDelete = api.mutations.at(-1)!;
  api.mode = "ready";
  await page.getByRole("button", { name: "Check current state" }).click();
  await page.getByRole("button", { name: "Review deletion" }).click();
  await page.getByRole("button", { name: "Delete active copy" }).click();
  await expect(page.getByRole("heading", { name: /Deletion confirmed/ })).toBeFocused();
  expect(api.mutations.at(-1)?.headers["idempotency-key"]).toBe(
    uncertainDelete.headers["idempotency-key"],
  );

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("heading", { name: "◇ Offline / Ngoại tuyến" })).toBeVisible();
  await expect(page.getByText("No offline queue")).toBeVisible();
  await expect(page.getByRole("heading", { name: "synthetic-note.txt" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "conflict.txt" })).toHaveCount(0);
  await expect(page.getByLabel("Text document")).toHaveCount(0);
  await context.setOffline(false);
});

test("LB-023 cancellation is keyboard-operable and reconciles with the same volatile upload identity", async ({
  page,
}) => {
  const api = await syntheticApi(page);
  await page.goto("/households/household_synthetic/documents");
  await page.locator(".document-vault-header select").selectOption("en");
  await page.getByLabel("Text document").setInputFiles({
    name: "cancelled.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("cancelled synthetic upload"),
  });
  api.mode = "slow";
  await page.getByRole("button", { name: "Upload for validation" }).click();
  await expect(page.getByRole("progressbar", { name: "Actual upload progress" })).toBeVisible();
  const cancel = page.getByRole("button", { name: "Cancel upload" });
  await cancel.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /request result is uncertain/ })).toBeFocused();
  const cancelledAttempt = api.mutations.at(-1)!;

  api.mode = "ready";
  await page.getByRole("button", { name: "Check current state" }).click();
  await page.getByRole("button", { name: "Upload for validation" }).click();
  await expect(page.getByRole("heading", { name: /Upload confirmed/ })).toBeVisible();
  expect(api.mutations.at(-1)?.body.uploadReference).toBe(cancelledAttempt.body.uploadReference);
  expect(api.mutations.at(-1)?.headers["idempotency-key"]).toBe(
    cancelledAttempt.headers["idempotency-key"],
  );
});

function documentProjection(
  overrides: Partial<{
    documentId: string;
    uploadReference: string;
    displayName: string;
    sizeBytes: number;
    processingState: "processing" | "ready_unscanned" | "rejected" | "failed" | "integrity_failed";
  }> = {},
) {
  return {
    documentId: overrides.documentId ?? "document_synthetic",
    uploadReference: overrides.uploadReference ?? "upload_reference_synthetic",
    displayName: overrides.displayName ?? "synthetic-note.txt",
    verifiedType: "text/plain" as const,
    sizeBytes: overrides.sizeBytes ?? 18,
    processingState: overrides.processingState ?? ("ready_unscanned" as const),
    scannerStatus: "not_configured" as const,
    malwareStatus: "not_scanned" as const,
    processingEvidence: "strict_text_and_integrity_validation" as const,
    accessPolicy: "care_recipient_and_current_document_collaborators" as const,
    retentionPolicy: "retained_until_explicit_delete" as const,
    version: 1,
    uploadedAt: confirmedAt,
    processingConfirmedAt: overrides.processingState === "processing" ? null : confirmedAt,
  };
}

function session() {
  return {
    accountId: "account_synthetic",
    onboardingState: "complete",
    authorizationScope: "account",
    csrfToken: csrf,
    preferences: {
      locale: "vi-VN",
      textScale: "default",
      contrast: "system",
      motion: "system",
      version: 1,
    },
    session: {
      idleExpiresAt: "2026-07-28T22:00:00.000Z",
      absoluteExpiresAt: "2026-07-29T10:00:00.000Z",
    },
  };
}

async function json(route: Route, status: number, data: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ data, meta: { correlationId: "corr_p4s3_browser" } }),
  });
}

async function failure(route: Route, status: number, code: string) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({
      error: {
        code,
        messageKey: "document.synthetic",
        retryable: status >= 500,
        correlationId: "corr_p4s3_browser",
      },
    }),
  });
}
