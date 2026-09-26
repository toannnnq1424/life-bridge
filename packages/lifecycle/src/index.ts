import { createHash } from "node:crypto";

export type LifecycleAction =
  "delete" | "pseudonymize" | "retain" | "tombstone" | "export_include" | "export_exclude";
export type LifecycleDisposition = {
  action: LifecycleAction;
  policyVersion: number;
  approvedBy: string;
};

export class LifecyclePolicyError extends Error {
  constructor(
    public readonly code:
      "POLICY_DECISION_REQUIRED" | "IDEMPOTENCY_CONFLICT" | "LIFECYCLE_VERSION_CONFLICT",
  ) {
    super(code);
  }
}

export interface LifecycleCommand {
  requestId: string;
  owner: string;
  dataClass: string;
  operation: "delete" | "export";
  expectedVersion: number;
  idempotencyKey: string;
  correlationId: string;
}

export interface LifecycleResult {
  requestId: string;
  owner: string;
  dataClass: string;
  state:
    | "requested"
    | "in_progress"
    | "blocked"
    | "policy_decision_required"
    | "completed"
    | "failed"
    | "excluded"
    | "retained";
  action: LifecycleAction;
  version: number;
  intentDigest: string;
}

export class PolicyRegistry {
  private readonly values = new Map<string, LifecycleDisposition>();
  approve(
    owner: string,
    dataClass: string,
    operation: LifecycleCommand["operation"],
    value: LifecycleDisposition,
  ): void {
    if (!value.approvedBy || value.policyVersion < 1)
      throw new LifecyclePolicyError("POLICY_DECISION_REQUIRED");
    this.values.set(`${owner}:${dataClass}:${operation}`, value);
  }
  resolve(command: LifecycleCommand): LifecycleDisposition {
    const value = this.values.get(`${command.owner}:${command.dataClass}:${command.operation}`);
    if (!value) throw new LifecyclePolicyError("POLICY_DECISION_REQUIRED");
    if (command.operation === "delete" && value.action.startsWith("export_"))
      throw new LifecyclePolicyError("POLICY_DECISION_REQUIRED");
    if (command.operation === "export" && !value.action.startsWith("export_"))
      throw new LifecyclePolicyError("POLICY_DECISION_REQUIRED");
    return value;
  }
}

export interface ProductPolicy {
  policyVersion: number;
  approvedBy: string;
  classification: "product-engineering-default-not-legal-advice";
  legalHold: string;
  dispositions: Array<{
    owner: string;
    dataClass: string;
    delete: Extract<LifecycleAction, "delete" | "pseudonymize" | "retain" | "tombstone">;
    export: Extract<LifecycleAction, "export_include" | "export_exclude">;
    evidenceRetentionDays: number;
  }>;
}

export function registryFromProductPolicy(policy: ProductPolicy): PolicyRegistry {
  if (
    policy.classification !== "product-engineering-default-not-legal-advice" ||
    !policy.legalHold.includes("fail-closed") ||
    policy.policyVersion < 1 ||
    !policy.approvedBy
  ) {
    throw new LifecyclePolicyError("POLICY_DECISION_REQUIRED");
  }
  const registry = new PolicyRegistry();
  for (const item of policy.dispositions) {
    if (!Number.isInteger(item.evidenceRetentionDays) || item.evidenceRetentionDays < 0) {
      throw new LifecyclePolicyError("POLICY_DECISION_REQUIRED");
    }
    registry.approve(item.owner, item.dataClass, "delete", {
      action: item.delete,
      policyVersion: policy.policyVersion,
      approvedBy: policy.approvedBy,
    });
    registry.approve(item.owner, item.dataClass, "export", {
      action: item.export,
      policyVersion: policy.policyVersion,
      approvedBy: policy.approvedBy,
    });
  }
  return registry;
}

export class LifecycleCoordinator {
  private readonly results = new Map<string, LifecycleResult>();
  constructor(private readonly policies: PolicyRegistry) {}
  execute(command: LifecycleCommand): LifecycleResult {
    const digest = intentDigest(command);
    const prior = this.results.get(command.idempotencyKey);
    if (prior) {
      if (prior.intentDigest !== digest) throw new LifecyclePolicyError("IDEMPOTENCY_CONFLICT");
      return prior;
    }
    const disposition = this.policies.resolve(command);
    if (command.expectedVersion !== 1) throw new LifecyclePolicyError("LIFECYCLE_VERSION_CONFLICT");
    const result: LifecycleResult = {
      requestId: command.requestId,
      owner: command.owner,
      dataClass: command.dataClass,
      state:
        disposition.action === "export_exclude"
          ? "excluded"
          : disposition.action === "retain"
            ? "retained"
            : "completed",
      action: disposition.action,
      version: 1,
      intentDigest: digest,
    };
    this.results.set(command.idempotencyKey, result);
    return result;
  }
}

export interface OwnerLifecycleEvidence {
  requestId: string;
  owner: string;
  version: number;
  intentDigest: string;
  state: LifecycleResult["state"];
  verifiedAt?: string;
  policyVersion?: number;
}

export function reconcileLifecycle(
  requestId: string,
  intentDigestValue: string,
  requiredOwners: readonly string[],
  evidence: readonly OwnerLifecycleEvidence[],
): {
  state: "complete" | "in_progress" | "blocked" | "failed";
  owners: Record<string, OwnerLifecycleEvidence["state"]>;
} {
  const owners: Record<string, OwnerLifecycleEvidence["state"]> = {};
  for (const item of evidence) {
    if (
      item.requestId !== requestId ||
      item.intentDigest !== intentDigestValue ||
      !requiredOwners.includes(item.owner)
    ) {
      throw new LifecyclePolicyError("LIFECYCLE_VERSION_CONFLICT");
    }
    const existing = evidence.filter((candidate) => candidate.owner === item.owner);
    const highest = Math.max(...existing.map((candidate) => candidate.version));
    if (existing.filter((candidate) => candidate.version === highest).length !== 1)
      throw new LifecyclePolicyError("LIFECYCLE_VERSION_CONFLICT");
    if (item.version === highest) owners[item.owner] = item.state;
  }
  const terminal = new Set<LifecycleResult["state"]>(["completed", "excluded", "retained"]);
  const complete = requiredOwners.every((owner) => owners[owner] && terminal.has(owners[owner]));
  if (complete) return { state: "complete", owners };
  if (Object.values(owners).includes("failed")) return { state: "failed", owners };
  if (
    Object.values(owners).some(
      (state) => state === "blocked" || state === "policy_decision_required",
    )
  )
    return { state: "blocked", owners };
  return { state: "in_progress", owners };
}

export function aggregateIntentDigest(input: {
  requestId: string;
  operation: "delete" | "export" | "access" | "correction";
  policyVersion: number;
  targetManifestVersion: number;
}): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function intentDigest(command: LifecycleCommand): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        requestId: command.requestId,
        owner: command.owner,
        dataClass: command.dataClass,
        operation: command.operation,
        expectedVersion: command.expectedVersion,
      }),
    )
    .digest("hex");
}

export function lifecycleTelemetry(result: LifecycleResult, durationMs: number): string {
  return JSON.stringify({
    eventName: "lifecycle.result",
    owner: result.owner,
    state: result.state,
    action: result.action,
    version: result.version,
    durationMs,
  });
}
