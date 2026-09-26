import { describe, expect, it } from "vitest";

import { householdCopy } from "./household-i18n";

describe("P2-S2 household locale contract", () => {
  it("keeps Vietnamese and English keys in parity", () => {
    expect(Object.keys(householdCopy["vi-VN"]).sort()).toEqual(
      Object.keys(householdCopy.en).sort(),
    );
  });

  it("keeps protected-resource and offline responses meaning-aligned", () => {
    for (const locale of ["vi-VN", "en"] as const) {
      expect(householdCopy[locale].genericError.length).toBeGreaterThan(40);
      expect(householdCopy[locale].offline).toMatch(
        locale === "en"
          ? /not sent.*not queued.*not submit/i
          : /không được gửi.*không được xếp hàng.*không tự gửi/i,
      );
    }
  });
});
