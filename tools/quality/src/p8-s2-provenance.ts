import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export interface ProvenanceInput {
  artifact: string;
  sourceSha: string;
  artifactPath: string;
  sbomPath: string;
  buildInputPaths: string[];
  builderVersions: Record<string, string>;
}

export interface ProvenanceRecord {
  schemaVersion: 1;
  predicateType: "https://slsa.dev/provenance/v1";
  claimLevel: null;
  artifact: string;
  sourceSha: string;
  artifactSha256: string;
  sbomSha256: string;
  buildInputsSha256: string;
  builderVersions: Record<string, string>;
}

const sha256 = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

export async function createProvenance(input: ProvenanceInput): Promise<ProvenanceRecord> {
  if (!/^[a-f0-9]{40}$/u.test(input.sourceSha)) throw new Error("PROVENANCE_SOURCE_SHA_INVALID");
  const inputs = await Promise.all(
    [...input.buildInputPaths]
      .sort()
      .map(async (path) => `${path}:${sha256(await readFile(path))}`),
  );
  return {
    schemaVersion: 1,
    predicateType: "https://slsa.dev/provenance/v1",
    claimLevel: null,
    artifact: input.artifact,
    sourceSha: input.sourceSha,
    artifactSha256: sha256(await readFile(input.artifactPath)),
    sbomSha256: sha256(await readFile(input.sbomPath)),
    buildInputsSha256: sha256(inputs.join("\n")),
    builderVersions: Object.fromEntries(
      Object.entries(input.builderVersions).sort(([a], [b]) => a.localeCompare(b)),
    ),
  };
}

export async function verifyProvenance(
  record: ProvenanceRecord,
  input: ProvenanceInput,
): Promise<void> {
  const expected = await createProvenance(input);
  if (JSON.stringify(record) !== JSON.stringify(expected))
    throw new Error("PROVENANCE_BINDING_INVALID");
}
