import { describe, expect, it } from "vitest";
import {
  decodeProcessOutput,
  findCredentialLiterals,
  gitExecutable,
  validateCodexStitchConfig,
  validatePackageManifest,
  validateVscodeMcpConfig,
} from "./validation.js";

describe("portable git process handling", () => {
  it("selects the platform executable and safely decodes nullable output", () => {
    expect(gitExecutable("win32")).toBe("git.exe");
    expect(gitExecutable("linux")).toBe("git");
    expect(decodeProcessOutput(Buffer.from("tracked\0", "utf8"))).toBe("tracked\0");
    expect(decodeProcessOutput(undefined)).toBe("");
  });
});

describe("findCredentialLiterals", () => {
  it("accepts symbolic and empty secret references", () => {
    const content = [
      "STITCH_API_KEY=",
      'X-Goog-Api-Key = "${input:stitch-api-key}"',
      'Authorization = "${env:SERVICE_TOKEN}"',
    ].join("\n");

    expect(findCredentialLiterals(content)).toEqual([]);
  });

  it("detects credential-shaped values without returning the value", () => {
    const credential = `ghp_${"A".repeat(24)}`;

    expect(findCredentialLiterals(`TOKEN=${credential}`)).toEqual(["GitHub token"]);
  });
});

describe("validatePackageManifest", () => {
  it("accepts the pinned Phase 0 runtime contract", () => {
    const scripts = Object.fromEntries(
      [
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
      ].map((name) => [name, "placeholder"]),
    );

    expect(
      validatePackageManifest({
        private: true,
        packageManager: "pnpm@11.9.0",
        engines: {
          node: ">=22.0.0 <23",
          pnpm: "11.9.0",
        },
        scripts,
      }),
    ).toEqual([]);
  });

  it("reports unpinned runtime and missing scripts", () => {
    const errors = validatePackageManifest({
      private: false,
      packageManager: "pnpm@latest",
      engines: { node: ">=20" },
      scripts: {},
    });

    expect(errors).toContain("package.json must set private=true.");
    expect(errors).toContain("package.json must pin packageManager to pnpm@11.9.0.");
    expect(errors).toContain("package.json is missing script 'validate:phase0'.");
  });
});

describe("validateCodexStitchConfig", () => {
  it("accepts the enabled, environment-backed Stitch contract", () => {
    const content = [
      "[mcp_servers.stitch]",
      'url = "https://stitch.googleapis.com/mcp"',
      'env_http_headers = { "X-Goog-Api-Key" = "STITCH_API_KEY" }',
      "enabled = true",
      "required = false",
      'default_tools_approval_mode = "approve"',
      "tool_timeout_sec = 600",
    ].join("\n");

    expect(validateCodexStitchConfig(content)).toEqual([]);
  });

  it("rejects disabled or literal-backed Stitch configuration", () => {
    const content = [
      "[mcp_servers.stitch]",
      'url = "https://stitch.googleapis.com/mcp"',
      'env_http_headers = { "X-Goog-Api-Key" = "literal-value" }',
      "enabled = false",
      "required = false",
      'default_tools_approval_mode = "never"',
      "tool_timeout_sec = 60",
    ].join("\n");

    expect(validateCodexStitchConfig(content)).toEqual([
      "Stitch MCP must remain enabled after the approved live canary.",
      "Stitch MCP tools must use the user-authorized approve policy.",
      "Stitch MCP tool timeout must be the bounded 600-second generation window.",
      "Stitch MCP must resolve X-Goog-Api-Key from STITCH_API_KEY.",
    ]);
  });

  it("rejects malformed TOML", () => {
    expect(validateCodexStitchConfig("[mcp_servers.stitch")).toHaveLength(1);
  });
});

describe("validateVscodeMcpConfig", () => {
  it("accepts only an inert VS Code MCP marker", () => {
    expect(validateVscodeMcpConfig('{"servers":{},"inputs":[]}')).toEqual([]);
  });

  it("rejects active servers and credential inputs", () => {
    const content = JSON.stringify({
      servers: { stitch: { url: "https://stitch.googleapis.com/mcp" } },
      inputs: [{ id: "stitch-api-key" }],
    });

    expect(validateVscodeMcpConfig(content)).toEqual([
      "VS Code MCP servers must remain empty; Codex App is the active path.",
      "VS Code MCP credential inputs must remain empty.",
    ]);
  });
});
