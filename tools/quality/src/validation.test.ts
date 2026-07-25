import { describe, expect, it } from "vitest";
import {
  findCredentialLiterals,
  validateCodexStitchConfig,
  validatePackageManifest,
  validateVscodeMcpConfig,
} from "./validation.js";

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
  it("accepts the disabled, environment-backed Stitch contract", () => {
    const content = [
      "[mcp_servers.stitch]",
      'url = "https://stitch.googleapis.com/mcp"',
      'env_http_headers = { "X-Goog-Api-Key" = "STITCH_API_KEY" }',
      "enabled = false",
      "required = false",
      'default_tools_approval_mode = "prompt"',
    ].join("\n");

    expect(validateCodexStitchConfig(content)).toEqual([]);
  });

  it("rejects enabled or literal-backed Stitch configuration", () => {
    const content = [
      "[mcp_servers.stitch]",
      'url = "https://stitch.googleapis.com/mcp"',
      'env_http_headers = { "X-Goog-Api-Key" = "literal-value" }',
      "enabled = true",
      "required = false",
      'default_tools_approval_mode = "never"',
    ].join("\n");

    expect(validateCodexStitchConfig(content)).toEqual([
      "Stitch MCP must remain disabled until the live canary gate passes.",
      "Stitch MCP tools must use prompt approval.",
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
