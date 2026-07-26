import { describe, expect, it } from "vitest";

import { requiredKey, requireFixtureSafeMode } from "./index.js";

describe("fixture runtime boundary", () => {
  it("allows fixture identity only in local and test modes", () => {
    expect(requireFixtureSafeMode("local", "true")).toEqual({
      mode: "local",
      fixtureEnabled: true,
    });
    expect(() => requireFixtureSafeMode("production", "true")).toThrow(
      "FIXTURE_IDENTITY_FORBIDDEN",
    );
    expect(() =>
      requireFixtureSafeMode("local", "true", "0.0.0.0", "http://127.0.0.1:3000"),
    ).toThrow("FIXTURE_IDENTITY_FORBIDDEN");
    expect(() =>
      requireFixtureSafeMode("test", "true", "127.0.0.1", "https://public.example"),
    ).toThrow("FIXTURE_IDENTITY_FORBIDDEN");
    expect(requireFixtureSafeMode("production", "false", "0.0.0.0", "https://app.example")).toEqual(
      { mode: "production", fixtureEnabled: false },
    );
  });

  it("accepts only an exact 256-bit base64url key", () => {
    const encoded = Buffer.alloc(32, 7).toString("base64url");
    expect(requiredKey(encoded, "IDENTITY_DATA_KEY")).toEqual(Buffer.alloc(32, 7));
    expect(() => requiredKey("too-short", "IDENTITY_DATA_KEY")).toThrow(
      "IDENTITY_DATA_KEY_MISSING_OR_INVALID",
    );
  });
});
