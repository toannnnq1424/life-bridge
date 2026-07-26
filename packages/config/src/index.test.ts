import { describe, expect, it } from "vitest";

import { requireFixtureSafeMode } from "./index.js";

describe("fixture runtime boundary", () => {
  it("allows fixture identity only in local and test modes", () => {
    expect(requireFixtureSafeMode("local", "true")).toEqual({
      mode: "local",
      fixtureEnabled: true,
    });
    expect(() => requireFixtureSafeMode("production", "true")).toThrow(
      "FIXTURE_IDENTITY_FORBIDDEN",
    );
  });
});
