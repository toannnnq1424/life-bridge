import { z } from "zod";

const opaqueId = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
const instant = z.iso.datetime({ offset: true });

export const CommunityMatchPermissionSchema = z.enum([
  "community_match.volunteer.read",
  "community_match.volunteer.respond",
  "community_match.coordinator.read",
  "community_match.coordinator.manage",
  "community_match.progress.record",
]);

export const CommunityMatchAuthorizationRequestSchema = z
  .object({
    permission: CommunityMatchPermissionSchema,
    householdId: opaqueId,
    requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const CommunityMatchAuthorizationContextSchema = z
  .object({
    decisionId: opaqueId,
    purpose: z.literal("community_match_coordination"),
    permission: CommunityMatchPermissionSchema,
    actorRef: opaqueId,
    recipientContextId: opaqueId,
    subjectVersion: z.number().int().positive(),
    grantId: opaqueId,
    grantVersion: z.number().int().positive(),
    privacyVersion: z.number().int().positive(),
    decidedAt: instant,
    expiresAt: instant,
    correlationId: opaqueId,
    requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .refine((value) => value.decidedAt < value.expiresAt, {
    message: "match_authority_expiry_invalid",
    path: ["expiresAt"],
  });

export const CommunityMatchStateSchema = z.enum([
  "pending_approval",
  "approved",
  "rejected",
  "offered",
  "accepted",
  "declined",
  "assigned",
  "in_progress",
  "closed",
  "revoked",
  "expired",
]);

export const CommunityMatchCheckpointSchema = z.enum([
  "arrangements_confirmed",
  "support_started",
  "support_completed",
  "unable_to_proceed",
]);

export const CommunityMatchCapacitySlotSchema = z
  .object({
    serviceDate: z.iso.date(),
    dayPart: z.enum(["morning", "afternoon", "evening"]),
  })
  .strict();

const common = {
  authorization: CommunityMatchAuthorizationContextSchema,
  organizationId: opaqueId,
};
const mutation = {
  ...common,
  submissionReference: opaqueId,
  expectedVersion: z.number().int().positive(),
};

const CommunityMatchCommandUnionSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("query"),
      ...common,
      audience: z.enum(["volunteer", "coordinator"]),
      matchId: opaqueId.optional(),
      state: CommunityMatchStateSchema.optional(),
      cursor: z.string().min(20).max(1024).optional(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("approval"),
      ...mutation,
      decision: z.enum(["approved", "rejected"]),
      expiresAt: instant,
    })
    .strict(),
  z
    .object({
      operation: z.literal("offer"),
      ...mutation,
      volunteerEnrollmentId: opaqueId,
      capacitySlot: CommunityMatchCapacitySlotSchema,
      expiresAt: instant,
    })
    .strict(),
  z
    .object({
      operation: z.literal("offer_response"),
      ...mutation,
      offerId: opaqueId,
      expectedOfferVersion: z.number().int().positive(),
      response: z.enum(["accepted", "declined"]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("assignment"),
      ...mutation,
      offerId: opaqueId,
      mode: z.enum(["assign", "reassign"]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("progress"),
      ...mutation,
      checkpoint: CommunityMatchCheckpointSchema,
    })
    .strict(),
  z
    .object({
      operation: z.literal("close"),
      ...mutation,
      reason: z.enum([
        "support_completed",
        "recipient_cancelled",
        "organization_cancelled",
        "unable_to_proceed",
      ]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("revoke"),
      ...mutation,
      reason: z.enum(["consent_revoked", "approval_revoked", "organization_revoked"]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("reconcile"),
      ...common,
      submissionReference: opaqueId,
      command: z.enum([
        "approval",
        "offer",
        "offer_response",
        "assignment",
        "progress",
        "close",
        "revoke",
      ]),
    })
    .strict(),
]);

export const CommunityMatchCommandSchema = CommunityMatchCommandUnionSchema.superRefine(
  (value, context) => {
    const permission = value.authorization.permission;
    const expected =
      value.operation === "query"
        ? value.audience === "volunteer"
          ? "community_match.volunteer.read"
          : "community_match.coordinator.read"
        : value.operation === "offer_response"
          ? "community_match.volunteer.respond"
          : value.operation === "progress"
            ? "community_match.progress.record"
            : value.operation === "reconcile"
              ? null
              : "community_match.coordinator.manage";
    if (expected !== null && permission !== expected) {
      context.addIssue({
        code: "custom",
        message: "match_permission_operation_mismatch",
        path: ["authorization", "permission"],
      });
    }
  },
);

export const CommunityMatchProjectionSchema = z
  .object({
    matchId: opaqueId,
    organizationId: opaqueId,
    category: z.enum([
      "daily_living_support",
      "transport_coordination",
      "household_errand",
      "social_connection",
      "digital_access",
      "accessibility_support",
    ]),
    provinceCityCode: z.string().regex(/^[A-Z0-9-]{3,32}$/),
    dayPart: z.enum(["flexible", "morning", "afternoon", "evening"]).nullable(),
    serviceDate: z.iso.date().nullable().optional(),
    offerId: opaqueId.optional(),
    accommodation: z
      .enum(["none_disclosed", "mobility_access_requested", "communication_access_requested"])
      .optional(),
    state: CommunityMatchStateSchema,
    capacityState: z.enum(["available", "reserved", "full", "unknown"]).optional(),
    progressCheckpoint: CommunityMatchCheckpointSchema.nullable().optional(),
    version: z.number().int().positive(),
    nextActions: z
      .array(
        z.enum([
          "approve",
          "reject",
          "offer",
          "accept",
          "decline",
          "assign",
          "reassign",
          "record_progress",
          "close",
          "revoke",
        ]),
      )
      .max(5),
    evidenceExpiresAt: instant,
    confirmedAt: instant,
  })
  .strict();

export const CommunityMatchResultSchema = z
  .object({
    matches: z.array(CommunityMatchProjectionSchema).max(25),
    nextCursor: z.string().min(20).max(1024).nullable().optional(),
    serverTime: instant,
    minimumDisclosure: z.literal("P5-S2-v1"),
  })
  .strict();

export const CommunityMatchFailureCodeSchema = z.enum([
  "COMMUNITY_MATCH_VALIDATION_FAILED",
  "COMMUNITY_MATCH_NOT_FOUND",
  "COMMUNITY_MATCH_AUTHORITY_REQUIRED",
  "COMMUNITY_MATCH_CONSENT_REVOKED",
  "COMMUNITY_MATCH_APPROVAL_REQUIRED",
  "COMMUNITY_MATCH_APPROVAL_REVOKED",
  "COMMUNITY_MATCH_OFFER_EXPIRED",
  "COMMUNITY_MATCH_OFFER_STATE_CONFLICT",
  "COMMUNITY_MATCH_NO_CAPACITY",
  "COMMUNITY_MATCH_VERSION_CONFLICT",
  "COMMUNITY_MATCH_ASSIGNMENT_CONFLICT",
  "COMMUNITY_MATCH_PROGRESS_CONFLICT",
  "COMMUNITY_MATCH_CLOSED",
  "COMMUNITY_MATCH_REVOKED",
  "COMMUNITY_MATCH_RESULT_UNKNOWN",
  "COMMUNITY_ORGANIZATION_UNAVAILABLE",
  "IDENTITY_SERVICE_UNAVAILABLE",
  "COMMUNITY_SERVICE_UNAVAILABLE",
  "IDEMPOTENCY_KEY_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "INTERNAL_CONTRACT_INVALID",
]);

export type CommunityMatchCommand = z.infer<typeof CommunityMatchCommandSchema>;
export type CommunityMatchProjection = z.infer<typeof CommunityMatchProjectionSchema>;
export type CommunityMatchAuthorizationRequest = z.infer<
  typeof CommunityMatchAuthorizationRequestSchema
>;
export type CommunityMatchAuthorizationContext = z.infer<
  typeof CommunityMatchAuthorizationContextSchema
>;
export type CommunityMatchPermission = z.infer<typeof CommunityMatchPermissionSchema>;
