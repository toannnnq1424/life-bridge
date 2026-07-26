import { describe, expect, it } from "vitest";

import { messages } from "./i18n";

describe("P1 localization inventory", () => {
  it("has exact Vietnamese and English key parity", () => {
    expect(Object.keys(messages["vi-VN"]).sort()).toEqual(Object.keys(messages.en).sort());
  });

  it("contains no empty visible or assistive strings", () => {
    for (const locale of Object.values(messages)) {
      expect(Object.values(locale).every((value) => value.trim().length > 0)).toBe(true);
    }
  });
});
