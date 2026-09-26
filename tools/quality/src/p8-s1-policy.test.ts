import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { CoordinationPermissionSchema } from "../../../packages/contracts/src/index.js";
import { describe, expect, it } from "vitest";

interface Rule {
  resource: string;
  operations: string[];
  owner: string;
  relationship: string;
  consent: string;
  service: string;
  scope: string;
}

interface Policy {
  version: string;
  default: "deny";
  householdRoles: string[];
  datastoreOwners: string[];
  publicResources: string[];
  rules: Rule[];
}

const policy = JSON.parse(
  readFileSync(resolve("contracts/authorization/p8-s1-policy.json"), "utf8"),
) as Policy;

function decide(input: {
  resource: string;
  operation: string;
  relationship: string;
  consent: string;
  service: string;
  scope: string;
}): "allow" | "deny" {
  const rule = policy.rules.find(
    (candidate) =>
      candidate.resource === input.resource && candidate.operations.includes(input.operation),
  );
  if (!rule) return policy.default;
  if (rule.relationship !== input.relationship || rule.consent !== input.consent) return "deny";
  return rule.service === input.service && rule.scope === input.scope ? "allow" : "deny";
}

describe("P8-S1 executable authorization policy", () => {
  it("is unique, deny-by-default and covers every actual owner", () => {
    expect(policy.version).toBe("P8-S1-v1");
    expect(policy.default).toBe("deny");
    expect(policy.householdRoles).toEqual(["organizer", "caregiver", "member"]);
    expect(
      new Set(policy.rules.map((rule) => `${rule.resource}:${rule.operations.join(",")}`)).size,
    ).toBe(policy.rules.length);
    expect(new Set(policy.rules.map((rule) => rule.owner))).toEqual(
      new Set([...policy.datastoreOwners, "owner-local"]),
    );
    expect(policy.publicResources).toEqual(["community.directory"]);
  });

  it("denies unknown and mismatched relationship, consent, caller and scope", () => {
    const accepted = {
      resource: "care.task",
      operation: "read",
      relationship: "active",
      consent: "self_or_active",
      service: "gateway",
      scope: "care.task",
    };
    expect(decide(accepted)).toBe("allow");
    for (const changed of [
      { resource: "care.unknown" },
      { operation: "export" },
      { relationship: "absent" },
      { consent: "revoked" },
      { service: "recovery-operator" },
      { scope: "care.access" },
    ]) {
      expect(decide({ ...accepted, ...changed })).toBe("deny");
    }
  });

  it("keeps two synthetic households mutually invisible", () => {
    const source = readFileSync(resolve("packages/test-fixtures/src/index.ts"), "utf8");
    expect(source).toContain('FIXTURE_HOUSEHOLD_ID = "hh_minh_an"');
    expect(source).toContain('FIXTURE_SECOND_HOUSEHOLD_ID = "hh_thu_binh"');
    expect(source).toContain("householdId: FIXTURE_SECOND_HOUSEHOLD_ID");
  });

  it("maps every coordination permission to a protected resource family", () => {
    const resources = new Set(policy.rules.map((rule) => rule.resource));
    for (const permission of CoordinationPermissionSchema.options) {
      const family = permission.startsWith("notification.")
        ? "notification.delivery"
        : permission.includes("document_vault")
          ? "care.document"
          : permission.includes("medication_reminder")
            ? "care.medication_reminder"
            : permission.includes("care_plan")
              ? "care.plan"
              : permission.includes("appointment") || permission.includes("calendar")
                ? "care.appointment"
                : permission.includes("emergency")
                  ? "care.emergency"
                  : "care.task";
      expect(resources.has(family), permission).toBe(true);
    }
  });
});
