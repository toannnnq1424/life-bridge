import { z } from "zod";

const opaqueId = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const instant = z.iso.datetime({ offset: true });

export const CommunityModerationPermissionSchema = z.enum([
  "community_moderation.queue.read",
  "community_moderation.case.read",
  "community_moderation.case.resolve",
  "community_moderation.case.reconcile",
]);
export const CommunityModerationAuthorizationRequestSchema = z
  .object({
    permission: CommunityModerationPermissionSchema,
    householdId: opaqueId,
    requestDigest: digest,
  })
  .strict();
export const CommunityModerationAuthorizationContextSchema = z
  .object({
    decisionId: opaqueId,
    purpose: z.literal("community_moderation_resolution"),
    permission: CommunityModerationPermissionSchema,
    actorRef: opaqueId,
    recipientContextId: opaqueId,
    subjectVersion: z.number().int().positive(),
    grantId: opaqueId,
    grantVersion: z.number().int().positive(),
    privacyVersion: z.number().int().positive(),
    decidedAt: instant,
    expiresAt: instant,
    correlationId: opaqueId,
    requestDigest: digest,
  })
  .strict()
  .refine((value) => value.decidedAt < value.expiresAt, {
    path: ["expiresAt"],
    message: "moderation_authority_expiry_invalid",
  });

export const CommunityModerationOutcomeSchema = z.enum([
  "no_change",
  "content_visibility_restricted",
  "community_participation_restricted",
]);
export const CommunityModerationReasonSchema = z.enum([
  "insufficient_authoritative_evidence",
  "duplicate_report",
  "outside_moderation_scope",
  "policy_content_boundary",
  "policy_privacy_boundary",
  "policy_contact_boundary",
]);
const policyVersion = z.string().regex(/^P5-S3-[a-z]+-v[1-9][0-9]*$/);
const authorization = {
  authorization: CommunityModerationAuthorizationContextSchema,
  moderatorEnrollmentId: opaqueId,
};

export const CommunityModerationCommandSchema = z
  .discriminatedUnion("operation", [
    z
      .object({
        operation: z.literal("queue"),
        ...authorization,
        state: z.enum(["open", "in_review"]).optional(),
        cursor: z.string().min(20).max(1024).optional(),
      })
      .strict(),
    z.object({ operation: z.literal("detail"), ...authorization, caseId: opaqueId }).strict(),
    z
      .object({
        operation: z.literal("resolve"),
        ...authorization,
        caseId: opaqueId,
        submissionReference: opaqueId,
        expectedVersion: z.number().int().positive(),
        outcome: CommunityModerationOutcomeSchema,
        reason: CommunityModerationReasonSchema,
        moderationPolicyVersion: policyVersion,
        redactionPolicyVersion: policyVersion,
        retentionPolicyVersion: policyVersion,
        affectedAggregateRef: digest,
        confirmed: z.literal(true),
      })
      .strict(),
    z
      .object({
        operation: z.literal("reconcile"),
        ...authorization,
        submissionReference: opaqueId,
        command: z.literal("resolve"),
      })
      .strict(),
  ])
  .superRefine((value, context) => {
    const expected =
      value.operation === "queue"
        ? "community_moderation.queue.read"
        : value.operation === "detail"
          ? "community_moderation.case.read"
          : value.operation === "resolve"
            ? "community_moderation.case.resolve"
            : "community_moderation.case.reconcile";
    if (value.authorization.permission !== expected)
      context.addIssue({
        code: "custom",
        path: ["authorization", "permission"],
        message: "moderation_permission_operation_mismatch",
      });
    if (value.operation === "resolve") {
      const nonRestrictive = [
        "insufficient_authoritative_evidence",
        "duplicate_report",
        "outside_moderation_scope",
      ].includes(value.reason);
      if ((value.outcome === "no_change") !== nonRestrictive)
        context.addIssue({
          code: "custom",
          path: ["reason"],
          message: "moderation_outcome_reason_mismatch",
        });
    }
  });

export const CommunityModerationEvidenceSchema = z
  .object({
    evidenceId: opaqueId,
    kind: z.enum([
      "reported_aggregate_snapshot",
      "community_state_transition",
      "prior_report_link",
    ]),
    provenanceDigest: digest,
    observedAt: instant,
    redactedAt: instant,
  })
  .strict();
export const CommunityModerationCaseSchema = z
  .object({
    caseId: opaqueId,
    category: z.enum(["content_boundary", "privacy_boundary", "contact_boundary", "other_bounded"]),
    state: z.enum(["open", "in_review", "resolved", "withdrawn", "expired"]),
    version: z.number().int().positive(),
    submittedAt: instant,
    retentionDeadline: instant,
    evidence: z.array(CommunityModerationEvidenceSchema).max(25).optional(),
    outcome: CommunityModerationOutcomeSchema.optional(),
    reason: CommunityModerationReasonSchema.optional(),
    moderationPolicyVersion: policyVersion,
    redactionPolicyVersion: policyVersion,
    retentionPolicyVersion: policyVersion,
    confirmedAt: instant,
  })
  .strict();
export const CommunityModerationResultSchema = z
  .object({
    cases: z.array(CommunityModerationCaseSchema).max(25),
    nextCursor: z.string().min(20).max(1024).nullable().optional(),
    serverTime: instant,
    minimumDisclosure: z.literal("P5-S3-v1"),
  })
  .strict();
export const CommunityModerationFailureCodeSchema = z.enum([
  "COMMUNITY_MODERATION_VALIDATION_FAILED",
  "COMMUNITY_MODERATION_NOT_FOUND",
  "COMMUNITY_MODERATION_AUTHORITY_REQUIRED",
  "COMMUNITY_MODERATION_REPORT_WITHDRAWN",
  "COMMUNITY_MODERATION_REPORT_EXPIRED",
  "COMMUNITY_MODERATION_ALREADY_RESOLVED",
  "COMMUNITY_MODERATION_VERSION_CONFLICT",
  "COMMUNITY_MODERATION_POLICY_CONFLICT",
  "COMMUNITY_MODERATION_REDACTION_CONFLICT",
  "COMMUNITY_MODERATION_RETENTION_CONFLICT",
  "COMMUNITY_MODERATION_RESULT_UNKNOWN",
  "IDENTITY_SERVICE_UNAVAILABLE",
  "COMMUNITY_SERVICE_UNAVAILABLE",
  "COMMUNITY_MODERATION_AUDIT_FAILED",
  "COMMUNITY_MODERATION_OUTBOX_FAILED",
  "IDEMPOTENCY_KEY_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "INTERNAL_CONTRACT_INVALID",
]);

export type CommunityModerationPermission = z.infer<typeof CommunityModerationPermissionSchema>;
export type CommunityModerationAuthorizationRequest = z.infer<
  typeof CommunityModerationAuthorizationRequestSchema
>;
export type CommunityModerationAuthorizationContext = z.infer<
  typeof CommunityModerationAuthorizationContextSchema
>;
