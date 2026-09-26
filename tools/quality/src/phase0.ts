import path from "node:path";
import process from "node:process";
import {
  validateConfiguration,
  validateDocuments,
  validateSecretHygiene,
  type Finding,
} from "./validation.js";

type ValidationMode = "all" | "config" | "docs" | "secrets";

function parseMode(value: string | undefined): ValidationMode {
  if (value === undefined) {
    return "all";
  }
  if (value === "all" || value === "config" || value === "docs" || value === "secrets") {
    return value;
  }

  throw new Error(`Unknown validation mode '${value}'. Expected all, docs, config, or secrets.`);
}

function printFindings(findings: readonly Finding[]): void {
  for (const finding of findings) {
    process.stderr.write(`[${finding.code}] ${finding.file}: ${finding.message}\n`);
  }
}

function main(): void {
  const mode = parseMode(process.argv[2]);
  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  const findings: Finding[] = [];

  if (mode === "all" || mode === "docs") {
    findings.push(...validateDocuments(repoRoot));
  }
  if (mode === "all" || mode === "config") {
    findings.push(...validateConfiguration(repoRoot));
  }
  if (mode === "all" || mode === "secrets") {
    findings.push(...validateSecretHygiene(repoRoot));
  }

  if (findings.length > 0) {
    printFindings(findings);
    process.stderr.write(`Phase 0 ${mode} validation failed with ${findings.length} finding(s).\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Phase 0 ${mode} validation passed.\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`Phase 0 validation could not run: ${String(error)}\n`);
  process.exitCode = 1;
}
