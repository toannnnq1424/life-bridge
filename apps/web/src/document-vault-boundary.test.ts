import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "apps", "web", "src", "DocumentVaultApp.tsx"),
  "utf8",
);

describe("LB-023 document-vault browser boundary", () => {
  it("uses the native file picker and real XHR upload progress", () => {
    expect(source).toContain('type="file"');
    expect(source).toContain('xhr.upload.addEventListener("progress"');
    expect(source).toContain("<progress");
    expect(source).not.toMatch(/setInterval|setTimeout\(\(\) => setProgress/);
  });

  it("does not persist, preview, or render document content", () => {
    expect(source).not.toMatch(
      /localStorage|sessionStorage|indexedDB|caches\.|serviceWorker|<iframe|<object|<embed|dangerouslySetInnerHTML/,
    );
    expect(source).not.toContain("FileReader.readAsText");
  });

  it("blocks offline mutations and exposes no offline projection", () => {
    expect(source).toContain("setDocuments([])");
    expect(source).toContain('setPhase("offline")');
    expect(source).not.toMatch(/backgroundSync|sync\.register|queuedRequests|uploadQueue/i);
  });

  it("keeps ambiguous upload identity volatile and reusable for reconciliation", () => {
    expect(source).toContain("pendingUpload");
    expect(source).toContain("pendingDelete");
    expect(source).toContain("attempt.idempotencyKey");
    expect(source).toContain("attempt.request");
    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });

  it("keeps clean and safe out of authoritative success wording", () => {
    expect(source).toContain("ready_unscanned");
    expect(source).toContain("not claimed clean, safe");
    expect(source).not.toMatch(/processingState:\s*["'](?:clean|safe)["']/);
  });
});
