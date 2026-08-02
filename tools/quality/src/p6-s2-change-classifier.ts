import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const boundedCloseoutDocs = new Set([
  "docs/CHANGE_CONTROL.md",
  "docs/IMPLEMENTATION_PLAN.md",
  "docs/INTEGRATION_LOG.md",
  "docs/KNOWN_ISSUES.md",
  "docs/SESSION_LOG.md",
  "docs/WORKSTREAM_BOARD.md",
]);

export function isDocsOnly(paths: string[]): boolean {
  if (paths.length === 0) return false;
  return paths.every((raw) => {
    const path = raw.replaceAll("\\", "/");
    if (!path || path.startsWith("/") || path.includes("../") || path.includes("//")) return false;
    return path === "README.md" || boundedCloseoutDocs.has(path);
  });
}

function main(): void {
  const input = process.argv[2];
  if (!input) throw new Error("A JSON file list is required.");
  const parsed = JSON.parse(readFileSync(input, "utf8")) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
    throw new Error("The changed-file list must be a JSON string array.");
  }
  process.stdout.write(isDocsOnly(parsed) ? "true" : "false");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
