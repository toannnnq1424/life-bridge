import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, unknown>;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const contractRoot = resolve(repositoryRoot, "contracts/community/p5-s2-v1");
const checksumLines = (await readFile(resolve(contractRoot, "SHA256SUMS"), "utf8"))
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter(Boolean);
const recordedPaths = new Set<string>();

for (const line of checksumLines) {
  const match = /^([a-f0-9]{64}) {2}(.+)$/u.exec(line);
  if (!match) throw new Error(`P5_S2_CONTRACT_CHECKSUM_LINE_INVALID:${line}`);
  const [, expected, portablePath] = match;
  if (!portablePath || portablePath.includes("\\") || portablePath.startsWith("/")) {
    throw new Error(`P5_S2_CONTRACT_PATH_INVALID:${portablePath ?? ""}`);
  }
  const absolutePath = resolve(contractRoot, ...portablePath.split("/"));
  if (!absolutePath.startsWith(`${contractRoot}${sep}`) || recordedPaths.has(portablePath)) {
    throw new Error(`P5_S2_CONTRACT_PATH_UNSAFE_OR_DUPLICATE:${portablePath}`);
  }
  const bytes = await readFile(absolutePath);
  if (createHash("sha256").update(bytes).digest("hex") !== expected) {
    throw new Error(`P5_S2_CONTRACT_CHECKSUM_MISMATCH:${portablePath}`);
  }
  JSON.parse(bytes.toString("utf8")) as unknown;
  recordedPaths.add(portablePath);
}

const required = [
  "openapi.json",
  "request-digest-vectors.json",
  "schemas/authorization-context.schema.json",
  "schemas/common-failure.schema.json",
  "schemas/community-outbox-event.schema.json",
  "schemas/match-command.schema.json",
  "schemas/match-result.schema.json",
];
for (const path of required) {
  if (!recordedPaths.has(path)) throw new Error(`P5_S2_CONTRACT_CHECKSUM_MISSING:${path}`);
}

const openApi = JSON.parse(
  await readFile(resolve(contractRoot, "openapi.json"), "utf8"),
) as JsonObject;
walk(openApi);
console.log(`P5-S2 contract integrity passed for ${recordedPaths.size} frozen JSON artifacts.`);

function walk(value: unknown): void {
  if (Array.isArray(value)) return void value.forEach(walk);
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref") validateReference(child);
    else walk(child);
  }
}

function validateReference(reference: unknown): void {
  if (typeof reference !== "string") {
    throw new Error("P5_S2_CONTRACT_REFERENCE_NOT_STRING");
  }
  if (reference.startsWith("#/")) {
    let current: unknown = openApi;
    for (const encoded of reference.slice(2).split("/")) {
      const segment = encoded.replace(/~1/gu, "/").replace(/~0/gu, "~");
      if (!isObject(current) || !(segment in current)) {
        throw new Error(`P5_S2_CONTRACT_REFERENCE_UNRESOLVED:${reference}`);
      }
      current = current[segment];
    }
    return;
  }
  const portablePath = reference.split("#", 1)[0]?.replace(/^\.\//u, "");
  if (!portablePath || !recordedPaths.has(portablePath)) {
    throw new Error(`P5_S2_CONTRACT_REFERENCE_UNRECORDED:${reference}`);
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
