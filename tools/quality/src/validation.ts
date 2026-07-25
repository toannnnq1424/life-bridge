import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";

export interface Finding {
  readonly code: string;
  readonly file: string;
  readonly message: string;
}

export interface PackageManifest {
  readonly private?: boolean;
  readonly packageManager?: string;
  readonly engines?: {
    readonly node?: string;
    readonly pnpm?: string;
  };
  readonly scripts?: Readonly<Record<string, string>>;
}

const requiredDocuments = [
  "README.md",
  "AGENTS.md",
  "CODEX.md",
  "CONTRIBUTING.md",
  "docs/PRODUCT_SPEC.md",
  "docs/ARCHITECTURE.md",
  "docs/REPOSITORY_MAP.md",
  "docs/IMPLEMENTATION_PLAN.md",
  "docs/TEST_STRATEGY.md",
  "docs/DATA_MODEL.md",
  "docs/API_CONTRACTS.md",
  "docs/AGENT_DESIGN.md",
  "docs/SECURITY.md",
  "docs/DEPLOYMENT.md",
  "docs/DECISIONS.md",
  "docs/KNOWN_ISSUES.md",
  "docs/SESSION_LOG.md",
  "docs/DEMO_SCRIPT.md",
  "docs/DEVPOST_SUBMISSION.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/WORKSTREAM_BOARD.md",
  "docs/INTEGRATION_LOG.md",
  "docs/RUNBOOK_ADOPTION.md",
  "docs/GITHUB_ISSUE_PLAN.md",
  "docs/research/RESEARCH_PROTOCOL.md",
  "docs/research/ASSUMPTION_REGISTER.md",
  "docs/orchestration/WINDOWS_ENVIRONMENT.md",
] as const;

const requiredScripts = [
  "bootstrap",
  "doctor",
  "format",
  "format:check",
  "lint",
  "typecheck",
  "test:unit",
  "test:integration",
  "validate:docs",
  "validate:config",
  "validate:secrets",
  "validate:phase0",
  "build",
  "security:deps",
] as const;

const textExtensions = new Set([
  ".cjs",
  ".example",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".toml",
  ".ts",
  ".txt",
  ".yaml",
  ".yml",
]);

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function readUtf8(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function isTextFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  const basename = path.posix.basename(normalized);

  return (
    textExtensions.has(path.posix.extname(normalized).toLowerCase()) ||
    basename.startsWith(".env") ||
    basename === ".editorconfig" ||
    basename === ".gitignore" ||
    basename === ".prettierignore"
  );
}

export function findCredentialLiterals(content: string): readonly string[] {
  const privateKeyMarker = ["BEGIN", "PRIVATE", "KEY"].join(" ");
  const patterns: readonly { readonly name: string; readonly pattern: RegExp }[] = [
    { name: "Google API key", pattern: /AIza[0-9A-Za-z_-]{20,}/u },
    { name: "GitHub token", pattern: /gh[pousr]_[0-9A-Za-z]{20,}/u },
    { name: "OpenAI-style key", pattern: /sk-[0-9A-Za-z_-]{20,}/u },
    { name: "Bearer token", pattern: /Bearer\s+[A-Za-z0-9._~-]{20,}/u },
    {
      name: "Private key",
      pattern: new RegExp(`-{5}${privateKeyMarker}-{5}`, "u"),
    },
  ];

  return patterns.filter(({ pattern }) => pattern.test(content)).map(({ name }) => name);
}

export function validatePackageManifest(manifest: PackageManifest): readonly string[] {
  const errors: string[] = [];

  if (manifest.private !== true) {
    errors.push("package.json must set private=true.");
  }
  if (manifest.packageManager !== "pnpm@11.9.0") {
    errors.push("package.json must pin packageManager to pnpm@11.9.0.");
  }
  if (manifest.engines?.node !== ">=22.0.0 <23") {
    errors.push("package.json must constrain Node.js to 22.x.");
  }
  if (manifest.engines?.pnpm !== "11.9.0") {
    errors.push("package.json must constrain pnpm to 11.9.0.");
  }

  for (const script of requiredScripts) {
    if (!manifest.scripts?.[script]) {
      errors.push(`package.json is missing script '${script}'.`);
    }
  }

  return errors;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateCodexStitchConfig(content: string): readonly string[] {
  let document: unknown;

  try {
    document = parse(content);
  } catch (error) {
    return [`Unable to parse .codex/config.toml: ${String(error)}`];
  }

  if (!isRecord(document)) {
    return [".codex/config.toml must contain a TOML document."];
  }

  const mcpServers = document.mcp_servers;
  const stitch = isRecord(mcpServers) ? mcpServers.stitch : undefined;
  if (!isRecord(stitch)) {
    return [".codex/config.toml must define [mcp_servers.stitch]."];
  }

  const errors: string[] = [];
  if (stitch.url !== "https://stitch.googleapis.com/mcp") {
    errors.push("Stitch MCP must use the approved Google endpoint.");
  }
  if (stitch.enabled !== false) {
    errors.push("Stitch MCP must remain disabled until the live canary gate passes.");
  }
  if (stitch.required !== false) {
    errors.push("Stitch MCP must remain optional during Phase 0.");
  }
  if (stitch.default_tools_approval_mode !== "prompt") {
    errors.push("Stitch MCP tools must use prompt approval.");
  }

  const headers = stitch.env_http_headers;
  if (!isRecord(headers) || headers["X-Goog-Api-Key"] !== "STITCH_API_KEY") {
    errors.push("Stitch MCP must resolve X-Goog-Api-Key from STITCH_API_KEY.");
  }

  return errors;
}

export function validateVscodeMcpConfig(content: string): readonly string[] {
  let document: unknown;

  try {
    document = JSON.parse(content);
  } catch (error) {
    return [`Unable to parse .vscode/mcp.json: ${String(error)}`];
  }

  if (!isRecord(document)) {
    return [".vscode/mcp.json must contain a JSON object."];
  }

  const errors: string[] = [];
  if (!isRecord(document.servers) || Object.keys(document.servers).length !== 0) {
    errors.push("VS Code MCP servers must remain empty; Codex App is the active path.");
  }
  if (!Array.isArray(document.inputs) || document.inputs.length !== 0) {
    errors.push("VS Code MCP credential inputs must remain empty.");
  }

  return errors;
}

export function validateDocuments(repoRoot: string): readonly Finding[] {
  const findings: Finding[] = [];

  for (const relativePath of requiredDocuments) {
    const absolutePath = path.join(repoRoot, relativePath);
    try {
      const stats = statSync(absolutePath);
      const content = readUtf8(absolutePath);

      if (!stats.isFile()) {
        findings.push({
          code: "DOC_NOT_FILE",
          file: relativePath,
          message: "Required document is not a regular file.",
        });
      } else if (content.trim().length < 80 || !content.includes("#")) {
        findings.push({
          code: "DOC_NOT_USEFUL",
          file: relativePath,
          message: "Required document is empty or lacks useful Markdown content.",
        });
      }
    } catch {
      findings.push({
        code: "DOC_MISSING",
        file: relativePath,
        message: "Required Phase 0 document is missing.",
      });
    }
  }

  const readmePath = path.join(repoRoot, "README.md");
  try {
    const readme = readUtf8(readmePath);
    const hasVietnamese = /Tiếng Việt|Vietnamese|vi-VN/iu.test(readme);
    const hasEnglish = /English|en-US|en-GB/iu.test(readme);

    if (!hasVietnamese || !hasEnglish) {
      findings.push({
        code: "README_BILINGUAL",
        file: "README.md",
        message: "README must clearly expose both Vietnamese and English sections.",
      });
    }
  } catch {
    // The missing-file finding above already reports this case.
  }

  return findings;
}

export function validateConfiguration(repoRoot: string): readonly Finding[] {
  const findings: Finding[] = [];
  const packagePath = path.join(repoRoot, "package.json");

  try {
    const manifest = JSON.parse(readUtf8(packagePath)) as PackageManifest;
    for (const message of validatePackageManifest(manifest)) {
      findings.push({ code: "PACKAGE_CONTRACT", file: "package.json", message });
    }
  } catch (error) {
    findings.push({
      code: "PACKAGE_PARSE",
      file: "package.json",
      message: `Unable to parse package.json: ${String(error)}`,
    });
  }

  for (const relativePath of [
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "tsconfig.build.json",
    "eslint.config.mjs",
    "prettier.config.mjs",
    ".editorconfig",
    ".env.example",
    ".codex/config.toml",
    "scripts/bootstrap.ps1",
    "scripts/doctor.ps1",
    "scripts/validate-phase0.ps1",
    ".github/workflows/ci.yml",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/vertical-slice.yml",
    ".github/ISSUE_TEMPLATE/config.yml",
  ]) {
    try {
      if (!statSync(path.join(repoRoot, relativePath)).isFile()) {
        throw new Error("not a file");
      }
    } catch {
      findings.push({
        code: "CONFIG_MISSING",
        file: relativePath,
        message: "Required Phase 0 configuration is missing.",
      });
    }
  }

  const configCandidates = [".vscode/mcp.json", ".codex/config.toml"];
  for (const relativePath of configCandidates) {
    try {
      const content = readUtf8(path.join(repoRoot, relativePath));
      for (const credentialType of findCredentialLiterals(content)) {
        findings.push({
          code: "MCP_LITERAL_SECRET",
          file: relativePath,
          message: `${credentialType} literal found in MCP configuration.`,
        });
      }

      if (relativePath.endsWith(".json")) {
        for (const message of validateVscodeMcpConfig(content)) {
          findings.push({
            code: "MCP_CONFIG_CONTRACT",
            file: relativePath,
            message,
          });
        }
      } else if (relativePath === ".codex/config.toml") {
        for (const message of validateCodexStitchConfig(content)) {
          findings.push({
            code: "MCP_CONFIG_CONTRACT",
            file: relativePath,
            message,
          });
        }
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        continue;
      }
      findings.push({
        code: "MCP_CONFIG_PARSE",
        file: relativePath,
        message: `MCP configuration could not be parsed safely: ${String(error)}`,
      });
    }
  }

  return findings;
}

function listRepositoryFiles(repoRoot: string): readonly string[] {
  const result = spawnSync(
    "git.exe",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true,
    },
  );

  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr.trim()}`);
  }

  return result.stdout
    .split("\0")
    .filter((entry) => entry.length > 0)
    .map(normalizePath);
}

export function validateSecretHygiene(repoRoot: string): readonly Finding[] {
  const findings: Finding[] = [];
  let files: readonly string[];

  try {
    files = listRepositoryFiles(repoRoot);
  } catch (error) {
    return [
      {
        code: "GIT_LIST_FAILED",
        file: ".",
        message: String(error),
      },
    ];
  }

  for (const relativePath of files) {
    const basename = path.posix.basename(relativePath);
    if (
      basename.startsWith(".env") &&
      basename !== ".env.example" &&
      basename !== ".env.stitch.example"
    ) {
      findings.push({
        code: "ENV_TRACKING",
        file: relativePath,
        message: "Local environment files must not be tracked or staged.",
      });
    }

    if (!isTextFile(relativePath)) {
      continue;
    }

    let content: string;
    try {
      content = readUtf8(path.join(repoRoot, relativePath));
    } catch {
      continue;
    }

    for (const credentialType of findCredentialLiterals(content)) {
      findings.push({
        code: "CREDENTIAL_LITERAL",
        file: relativePath,
        message: `${credentialType} literal detected; value intentionally not printed.`,
      });
    }
  }

  for (const exampleFile of [".env.example", ".env.stitch.example"]) {
    try {
      const content = readUtf8(path.join(repoRoot, exampleFile));
      const assignmentPattern =
        /^\s*([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*=\s*(.+)\s*$/gmu;

      for (const match of content.matchAll(assignmentPattern)) {
        const value = match[2]?.trim() ?? "";
        if (value && !value.startsWith("${") && !value.startsWith("<")) {
          findings.push({
            code: "EXAMPLE_SECRET_VALUE",
            file: exampleFile,
            message: `Sensitive placeholder '${match[1]}' must remain empty or symbolic.`,
          });
        }
      }
    } catch {
      // Required-file validation owns missing examples.
    }
  }

  return findings;
}
