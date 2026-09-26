import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../contracts/community/p5-s3-v1",
);
const lines = (await readFile(resolve(root, "SHA256SUMS"), "utf8")).trim().split(/\r?\n/u);
for (const line of lines) {
  const [expected, path] = line.split(/\s+\*?/u);
  if (!expected || !path) throw new Error("P5_S3_CHECKSUM_LINE_INVALID");
  const actual = createHash("sha256")
    .update(await readFile(resolve(root, path)))
    .digest("hex");
  if (actual !== expected) throw new Error(`P5_S3_CHECKSUM_MISMATCH:${path}`);
}
const openapi = JSON.parse(await readFile(resolve(root, "openapi.json"), "utf8")) as {
  info?: { version?: string };
  paths?: unknown;
};
if (openapi.info?.version !== "P5-S3-v1" || !openapi.paths)
  throw new Error("P5_S3_OPENAPI_INVALID");
