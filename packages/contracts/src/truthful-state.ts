import { z } from "zod";

export const TRUTHFUL_STATE_CONTRACT_VERSION = "P9-S2-truthful-state-v1" as const;

export const TruthfulMutationStateSchema = z.enum([
  "stale",
  "queued",
  "blocked",
  "conflicted",
  "rejected",
  "dependency_failed",
  "uncertain",
  "reconciling",
  "confirmed",
]);

export const DispatchEvidenceSchema = z.enum([
  "not_dispatched",
  "may_have_dispatched",
  "accepted",
  "authoritatively_confirmed",
]);

export const TruthfulFailureClassSchema = z.enum([
  "validation",
  "authentication",
  "authorization",
  "abuse",
  "consent_revoked",
  "authority_expired",
  "dependency",
  "database",
  "event",
  "storage_document",
  "notification",
  "privacy_policy",
  "timeout",
  "unknown",
]);

const EvidenceSchema = z
  .object({
    authoritativeVersion: z.union([z.string().min(1).max(128), z.number().int().nonnegative()]),
    observedAt: z.string().datetime({ offset: true }),
    provenance: z.enum(["identity", "care", "notification", "community", "gateway"]),
    receipt: z.string().min(1).max(128),
  })
  .strict();

export const TruthfulMutationStatusSchema = z
  .object({
    contractVersion: z.literal(TRUTHFUL_STATE_CONTRACT_VERSION),
    operationId: z.string().min(1).max(96),
    state: TruthfulMutationStateSchema,
    dispatchEvidence: DispatchEvidenceSchema,
    expectedVersion: z.union([z.string().max(128), z.number().int().nonnegative()]).optional(),
    failureClass: TruthfulFailureClassSchema.optional(),
    retry: z.enum(["never", "explicit_after_refresh", "explicit_after_reconcile"]),
    reconcileVia: z.string().min(1).max(160).optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    evidence: EvidenceSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.state === "confirmed") {
      if (value.dispatchEvidence !== "authoritatively_confirmed" || !value.evidence) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "confirmed requires authoritative evidence",
        });
      }
    } else if (value.evidence) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "only confirmed state carries confirmation evidence",
      });
    }
    if (
      value.state === "queued" &&
      (!value.expiresAt || value.dispatchEvidence !== "not_dispatched")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "queued intent must be undispatched and bounded",
      });
    }
    if (["uncertain", "reconciling"].includes(value.state) && !value.reconcileVia) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "uncertain state requires deterministic reconciliation",
      });
    }
    if (["rejected", "dependency_failed"].includes(value.state) && !value.failureClass) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "terminal failure requires a safe failure class",
      });
    }
  });

export type TruthfulMutationStatus = z.infer<typeof TruthfulMutationStatusSchema>;

const allowedTransitions: Readonly<
  Record<z.infer<typeof TruthfulMutationStateSchema>, readonly string[]>
> = {
  stale: ["blocked", "conflicted", "rejected", "reconciling"],
  queued: ["blocked", "rejected", "reconciling"],
  blocked: ["queued", "rejected"],
  conflicted: ["rejected", "reconciling"],
  rejected: [],
  dependency_failed: ["reconciling"],
  uncertain: ["reconciling"],
  reconciling: ["conflicted", "rejected", "dependency_failed", "uncertain", "confirmed"],
  confirmed: [],
};

export function isTruthfulTransition(
  from: TruthfulMutationStatus["state"],
  to: TruthfulMutationStatus["state"],
): boolean {
  return allowedTransitions[from].includes(to);
}
