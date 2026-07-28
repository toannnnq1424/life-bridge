import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, unknown>;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const contractRoot = resolve(repositoryRoot, "contracts/community/p5-s1-v1");
const checksumText = await readFile(resolve(contractRoot, "SHA256SUMS"), "utf8");
const checksumLines = checksumText
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter(Boolean);

if (checksumLines.length === 0) {
  throw new Error("P5_S1_CONTRACT_CHECKSUMS_EMPTY");
}

const recordedPaths = new Set<string>();
for (const line of checksumLines) {
  const match = /^([a-f0-9]{64}) {2}(.+)$/u.exec(line);
  if (!match) {
    throw new Error(`P5_S1_CONTRACT_CHECKSUM_LINE_INVALID:${line}`);
  }

  const [, expectedDigest, portablePath] = match;
  if (!portablePath || portablePath.includes("\\") || portablePath.startsWith("/")) {
    throw new Error(`P5_S1_CONTRACT_PATH_INVALID:${portablePath ?? ""}`);
  }

  const absolutePath = resolve(contractRoot, ...portablePath.split("/"));
  if (!absolutePath.startsWith(`${contractRoot}${sep}`) || recordedPaths.has(portablePath)) {
    throw new Error(`P5_S1_CONTRACT_PATH_UNSAFE_OR_DUPLICATE:${portablePath}`);
  }

  const bytes = await readFile(absolutePath);
  const actualDigest = createHash("sha256").update(bytes).digest("hex");
  if (actualDigest !== expectedDigest) {
    throw new Error(`P5_S1_CONTRACT_CHECKSUM_MISMATCH:${portablePath}`);
  }
  JSON.parse(bytes.toString("utf8")) as unknown;
  recordedPaths.add(portablePath);
}

const requiredPaths = [
  "openapi.json",
  "schemas/authorization-context.schema.json",
  "schemas/community-outbox-event.schema.json",
  "schemas/common-failure.schema.json",
  "schemas/help-request-command.schema.json",
  "schemas/help-request-result.schema.json",
  "schemas/public-directory-query.schema.json",
  "schemas/public-directory-result.schema.json",
];
for (const requiredPath of requiredPaths) {
  if (!recordedPaths.has(requiredPath)) {
    throw new Error(`P5_S1_CONTRACT_CHECKSUM_MISSING:${requiredPath}`);
  }
}

const openApi = JSON.parse(
  await readFile(resolve(contractRoot, "openapi.json"), "utf8"),
) as JsonObject;
walkReferences(openApi);

console.log(`P5-S1 contract integrity passed for ${recordedPaths.size} frozen JSON artifacts.`);

function walkReferences(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(walkReferences);
    return;
  }
  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref") {
      if (typeof child !== "string") {
        throw new Error("P5_S1_CONTRACT_REFERENCE_NOT_STRING");
      }
      validateReference(child);
    } else {
      walkReferences(child);
    }
  }
}

function validateReference(reference: string): void {
  if (reference.startsWith("#/")) {
    resolveJsonPointer(openApi, reference.slice(2));
    return;
  }

  const [rawPortablePath, fragment] = reference.split("#", 2);
  const portablePath = rawPortablePath?.replace(/^\.\//u, "");
  if (!portablePath || !recordedPaths.has(portablePath)) {
    throw new Error(`P5_S1_CONTRACT_REFERENCE_UNRECORDED:${reference}`);
  }
  if (fragment && !fragment.startsWith("/")) {
    throw new Error(`P5_S1_CONTRACT_REFERENCE_FRAGMENT_INVALID:${reference}`);
  }
}

function resolveJsonPointer(root: unknown, pointer: string): void {
  let current: unknown = root;
  for (const encodedSegment of pointer.split("/")) {
    const segment = encodedSegment.replace(/~1/gu, "/").replace(/~0/gu, "~");
    if (!isObject(current) || !(segment in current)) {
      throw new Error(`P5_S1_CONTRACT_REFERENCE_UNRESOLVED:#/${pointer}`);
    }
    current = current[segment];
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const contractRootRelative = relative(repositoryRoot, contractRoot);
