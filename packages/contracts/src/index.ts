import { z } from "zod";

export * from "./p5-s3-community-contract.js";

export * from "./p5-s2-community-contract.js";

const opaqueIdPattern = /^[a-z][a-z0-9_-]{2,79}$/;
const correlationIdPattern = /^[A-Za-z0-9_-]{8,80}$/;
const idempotencyPattern = /^[\x21-\x7E]{8,128}$/;

export const OpaqueIdSchema = z.string().regex(opaqueIdPattern);
export const CorrelationIdSchema = z.string().regex(correlationIdPattern);
export const IdempotencyKeySchema = z.string().regex(idempotencyPattern);
export const LocaleSchema = z.enum(["vi-VN", "en"]);
export const CanonicalUtcInstantSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine((value) => !Number.isNaN(Date.parse(value)), "invalid_utc_instant");
export const LocalDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
export const UtcOffsetSchema = z.string().regex(/^[+-](?:0\d|1[0-4]):[0-5]\d$/);
export const IanaTimeZoneSchema = z.string().min(1).max(80).refine(isIanaTimeZone, {
  message: "invalid_time_zone",
});
export const LocalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month! - 1 &&
      date.getUTCDate() === day
    );
  }, "invalid_local_date");
export const LoginNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,63}$/);

const blockedPasswords = new Set([
  "password",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "letmein123",
  "lifebridge",
]);

export const PasswordSchema = z
  .string()
  .transform((value) => value.normalize("NFC"))
  .refine((value) => [...value].length >= 8 && [...value].length <= 128, {
    message: "password_length",
  })
  .refine((value) => !blockedPasswords.has(value.toLocaleLowerCase("en-US")), {
    message: "password_blocked",
  });

export const TotpCodeSchema = z.string().regex(/^\d{6}$/);
export const RecoveryCodeSchema = z.string().regex(/^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/);
export const IdentityChallengeTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const IdentitySessionTokenSchema = IdentityChallengeTokenSchema;
export const CsrfTokenSchema = IdentityChallengeTokenSchema;
export const OnboardingStateSchema = z.enum(["required", "complete"]);
export const TextScaleSchema = z.enum(["default", "large"]);
export const ContrastPreferenceSchema = z.enum(["system", "more"]);
export const MotionPreferenceSchema = z.enum(["system", "reduce"]);

export const RegistrationRequestSchema = z
  .object({ loginName: LoginNameSchema, password: PasswordSchema })
  .strict();

export const RegistrationFactorRequestSchema = z
  .object({ challengeToken: IdentityChallengeTokenSchema, code: TotpCodeSchema })
  .strict();

export const RegistrationRecoveryConfirmationSchema = z
  .object({ challengeToken: IdentityChallengeTokenSchema, acknowledged: z.literal(true) })
  .strict();

export const SignInRequestSchema = RegistrationRequestSchema;
export const SignInFactorRequestSchema = RegistrationFactorRequestSchema;

export const PasswordRecoveryRequestSchema = z
  .object({
    loginName: LoginNameSchema,
    totpCode: TotpCodeSchema,
    recoveryCode: RecoveryCodeSchema,
    newPassword: PasswordSchema,
  })
  .strict();

export const FactorRecoveryRequestSchema = z
  .object({
    loginName: LoginNameSchema,
    password: PasswordSchema,
    recoveryCode: RecoveryCodeSchema,
  })
  .strict();

export const FactorRecoveryConfirmationSchema = RegistrationFactorRequestSchema;

export const IdentityPreferencesSchema = z
  .object({
    locale: LocaleSchema,
    textScale: TextScaleSchema,
    contrast: ContrastPreferenceSchema,
    motion: MotionPreferenceSchema,
    version: z.number().int().positive(),
  })
  .strict();

export const UpdateIdentityPreferencesSchema = z
  .object({
    locale: LocaleSchema,
    textScale: TextScaleSchema,
    contrast: ContrastPreferenceSchema,
    motion: MotionPreferenceSchema,
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const CompleteAccountOnboardingSchema = z
  .object({
    roleIntent: z.enum(["coordinate", "participate"]).optional(),
  })
  .strict();

export const IdentitySessionProjectionSchema = z
  .object({
    accountId: OpaqueIdSchema,
    onboardingState: OnboardingStateSchema,
    authorizationScope: z.literal("account"),
    preferences: IdentityPreferencesSchema,
    session: z
      .object({
        idleExpiresAt: z.iso.datetime({ offset: true }),
        absoluteExpiresAt: z.iso.datetime({ offset: true }),
      })
      .strict(),
    csrfToken: CsrfTokenSchema,
  })
  .strict();

export const HouseholdRoleSchema = z.enum(["organizer", "caregiver", "member"]);
export const InvitationStateSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "expired",
  "revoked",
]);
export const HouseholdCapabilitySchema = z.enum([
  "household.view",
  "household.manage",
  "invitation.manage",
  "recipient_context.view",
  "recipient_context.manage",
]);

export const CreateHouseholdRequestSchema = z
  .object({
    displayLabel: z.string().trim().min(1).max(80),
  })
  .strict();

export const CreateHouseholdInvitationRequestSchema = z
  .object({
    inviteeLoginName: LoginNameSchema,
    role: z.enum(["caregiver", "member"]),
  })
  .strict();

export const InvitationTokenRequestSchema = z
  .object({ invitationToken: IdentityChallengeTokenSchema })
  .strict();

export const ResendHouseholdInvitationRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();

export const RevokeHouseholdInvitationRequestSchema = ResendHouseholdInvitationRequestSchema;

export const UpsertCareRecipientContextRequestSchema = z
  .object({
    displayLabel: z.string().trim().min(1).max(80),
    relationshipLabel: z.string().trim().min(1).max(80),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

export const HouseholdProjectionSchema = z
  .object({
    householdId: OpaqueIdSchema,
    displayLabel: z.string().min(1).max(80),
    role: HouseholdRoleSchema,
    capabilities: z.array(HouseholdCapabilitySchema),
    version: z.number().int().positive(),
  })
  .strict();

export const HouseholdInvitationProjectionSchema = z
  .object({
    invitationId: OpaqueIdSchema,
    householdId: OpaqueIdSchema,
    role: z.enum(["caregiver", "member"]),
    state: InvitationStateSchema,
    expiresAt: z.iso.datetime({ offset: true }),
    version: z.number().int().positive(),
  })
  .strict();

export const CareRecipientContextProjectionSchema = z
  .object({
    recipientContextId: OpaqueIdSchema,
    householdId: OpaqueIdSchema,
    displayLabel: z.string().min(1).max(80),
    relationshipLabel: z.string().min(1).max(80),
    version: z.number().int().positive(),
  })
  .strict();

export type CreateHouseholdRequest = z.infer<typeof CreateHouseholdRequestSchema>;
export type CreateHouseholdInvitationRequest = z.infer<
  typeof CreateHouseholdInvitationRequestSchema
>;
export type InvitationTokenRequest = z.infer<typeof InvitationTokenRequestSchema>;
export type ResendHouseholdInvitationRequest = z.infer<
  typeof ResendHouseholdInvitationRequestSchema
>;
export type UpsertCareRecipientContextRequest = z.infer<
  typeof UpsertCareRecipientContextRequestSchema
>;
export type HouseholdProjection = z.infer<typeof HouseholdProjectionSchema>;
export type HouseholdInvitationProjection = z.infer<typeof HouseholdInvitationProjectionSchema>;
export type CareRecipientContextProjection = z.infer<typeof CareRecipientContextProjectionSchema>;

export const RecipientContextDisclosureScopeSchema = z.enum([
  "recipient_context.basic_label",
  "recipient_context.relationship_label",
]);
export const ConsentScopeSchema = z.enum([
  ...RecipientContextDisclosureScopeSchema.options,
  "document_vault.access",
  "community_help_request.access",
  "community_match.volunteer.read",
  "community_match.volunteer.respond",
  "community_match.coordinator.read",
  "community_match.coordinator.manage",
  "community_match.progress.record",
]);
export const ConsentPurposeSchema = z.enum([
  "household_coordination",
  "community_support",
  "community_match_coordination",
]);
export const ConsentActionSchema = z.enum(["grant", "narrow", "revoke"]);
export const ConsentStateSchema = z.enum(["active", "revoked"]);

export const ImmediateEffectiveTimeSchema = z
  .object({
    mode: z.literal("immediate"),
    displayTimeZone: IanaTimeZoneSchema,
  })
  .strict();

export const EstablishConsentSubjectRequestSchema = z
  .object({
    recipientContextId: OpaqueIdSchema,
    displayTimeZone: IanaTimeZoneSchema,
  })
  .strict();

export const ConsentSubjectProjectionSchema = z
  .object({
    subjectId: OpaqueIdSchema,
    householdId: OpaqueIdSchema,
    recipientContextId: OpaqueIdSchema,
    authority: z.literal("self"),
    version: z.number().int().positive(),
    establishedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ConsentRecipientProjectionSchema = z
  .object({
    recipientRef: OpaqueIdSchema,
    role: z.enum(["organizer", "caregiver", "member"]),
    displayKey: z.literal("consent.recipient.household_member"),
  })
  .strict();

const ConsentScopeSetSchema = z
  .array(ConsentScopeSchema)
  .min(1)
  .max(3)
  .superRefine((value, context) => {
    if (new Set(value).size !== value.length) {
      context.addIssue({ code: "custom", message: "duplicate_consent_scope" });
    }
  });

function purposeAllowsScopes(
  purpose: z.infer<typeof ConsentPurposeSchema>,
  scopes: readonly z.infer<typeof ConsentScopeSchema>[],
): boolean {
  if (purpose === "community_support") {
    return scopes.length === 1 && scopes[0] === "community_help_request.access";
  }
  if (purpose === "community_match_coordination") {
    return (
      scopes.length === 1 &&
      scopes[0] !== "community_help_request.access" &&
      scopes[0]!.startsWith("community_match.")
    );
  }
  return scopes.every(
    (scope) => scope !== "community_help_request.access" && !scope.startsWith("community_match."),
  );
}

export const GrantConsentRequestSchema = z
  .object({
    action: z.literal("grant"),
    recipientRef: OpaqueIdSchema,
    purpose: ConsentPurposeSchema,
    scopes: ConsentScopeSetSchema,
    effectiveTime: ImmediateEffectiveTimeSchema,
    expectedSubjectVersion: z.number().int().positive(),
  })
  .strict()
  .refine((value) => purposeAllowsScopes(value.purpose, value.scopes), {
    message: "consent_scope_purpose_mismatch",
    path: ["scopes"],
  });

export const NarrowConsentRequestSchema = z
  .object({
    action: z.literal("narrow"),
    scopes: ConsentScopeSetSchema,
    effectiveTime: ImmediateEffectiveTimeSchema,
    expectedSubjectVersion: z.number().int().positive(),
    expectedGrantVersion: z.number().int().positive(),
  })
  .strict();

export const RevokeConsentRequestSchema = z
  .object({
    action: z.literal("revoke"),
    effectiveTime: ImmediateEffectiveTimeSchema,
    expectedSubjectVersion: z.number().int().positive(),
    expectedGrantVersion: z.number().int().positive(),
  })
  .strict();

export const ConsentGrantProjectionSchema = z
  .object({
    grantId: OpaqueIdSchema,
    subjectId: OpaqueIdSchema,
    recipientRef: OpaqueIdSchema,
    recipientDisplayKey: z.literal("consent.recipient.household_member"),
    purpose: ConsentPurposeSchema,
    scopes: ConsentScopeSetSchema,
    state: ConsentStateSchema,
    effectiveAt: z.iso.datetime({ offset: true }),
    revokedEffectiveAt: z.iso.datetime({ offset: true }).nullable(),
    displayTimeZone: IanaTimeZoneSchema,
    version: z.number().int().positive(),
  })
  .strict()
  .refine((value) => purposeAllowsScopes(value.purpose, value.scopes), {
    message: "consent_scope_purpose_mismatch",
    path: ["scopes"],
  });

export const ConsentOverviewProjectionSchema = z
  .object({
    authority: z.enum(["unbound", "self"]),
    subject: ConsentSubjectProjectionSchema.nullable(),
    eligibleRecipients: z.array(ConsentRecipientProjectionSchema).max(25),
    grants: z.array(ConsentGrantProjectionSchema).max(25),
    serverTime: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ConsentTransitionEventSchema = z
  .object({
    eventId: OpaqueIdSchema,
    eventType: z.enum([
      "identity.consent.granted.v1",
      "identity.consent.narrowed.v1",
      "identity.consent.revoked.v1",
    ]),
    eventVersion: z.literal(1),
    producer: z.literal("identity-consent"),
    aggregateId: OpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    grantId: OpaqueIdSchema,
    grantVersion: z.number().int().positive(),
    action: ConsentActionSchema,
    purpose: ConsentPurposeSchema,
    scopes: z.array(ConsentScopeSchema).max(3),
    effectiveAt: z.iso.datetime({ offset: true }),
    occurredAt: z.iso.datetime({ offset: true }),
    correlationId: CorrelationIdSchema,
    causationId: OpaqueIdSchema,
  })
  .strict();

export const AuditCategorySchema = z.enum([
  "consent.subject_established",
  "consent.granted",
  "consent.narrowed",
  "consent.revoked",
  "recipient_context.access_allowed",
  "recipient_context.access_denied",
  "privacy.confirmed",
]);
export const AuditOutcomeSchema = z.enum(["confirmed", "allowed", "denied"]);
export const AuditActorAliasSchema = z.enum(["your_account", "household_member", "protected"]);
export const AuditRedactionSchema = z.literal("protected");

export const AuditHistoryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(25).default(20),
    cursor: z.string().min(20).max(1024).optional(),
    category: AuditCategorySchema.optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    displayTimeZone: IanaTimeZoneSchema,
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "invalid_audit_range",
    path: ["to"],
  });

export const AuditHistoryItemSchema = z
  .object({
    eventRef: OpaqueIdSchema,
    category: AuditCategorySchema,
    actorAlias: AuditActorAliasSchema,
    redaction: AuditRedactionSchema,
    occurredAt: z.iso.datetime({ offset: true }),
    displayTimeZone: IanaTimeZoneSchema,
    outcome: AuditOutcomeSchema,
  })
  .strict();

export const AuditHistoryProjectionSchema = z
  .object({
    items: z.array(AuditHistoryItemSchema).max(25),
    nextCursor: z.string().min(20).max(1024).nullable(),
  })
  .strict();

export const ProfileVisibilitySchema = z.enum(["private", "household_only"]);
export const CoordinationActivityVisibilitySchema = z.enum(["hidden", "household_only"]);

export const PrivacyPreferencesProjectionSchema = z
  .object({
    profileVisibility: ProfileVisibilitySchema,
    coordinationActivityVisibility: CoordinationActivityVisibilitySchema,
    accessAlerts: z.boolean(),
    version: z.number().int().positive(),
    confirmedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const UpdatePrivacyPreferencesSchema = z
  .object({
    profileVisibility: ProfileVisibilitySchema,
    coordinationActivityVisibility: CoordinationActivityVisibilitySchema,
    accessAlerts: z.boolean(),
    expectedVersion: z.number().int().positive(),
    displayTimeZone: IanaTimeZoneSchema,
  })
  .strict();

export const GovernedRecipientContextProjectionSchema = z
  .object({
    recipientContextId: OpaqueIdSchema,
    householdId: OpaqueIdSchema,
    scope: RecipientContextDisclosureScopeSchema,
    value: z.string().min(1).max(80),
    grantId: OpaqueIdSchema.nullable(),
    authorizedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ConsentScope = z.infer<typeof ConsentScopeSchema>;
export type RecipientContextDisclosureScope = z.infer<typeof RecipientContextDisclosureScopeSchema>;
export type EstablishConsentSubjectRequest = z.infer<typeof EstablishConsentSubjectRequestSchema>;
export type ConsentSubjectProjection = z.infer<typeof ConsentSubjectProjectionSchema>;
export type ConsentRecipientProjection = z.infer<typeof ConsentRecipientProjectionSchema>;
export type GrantConsentRequest = z.infer<typeof GrantConsentRequestSchema>;
export type NarrowConsentRequest = z.infer<typeof NarrowConsentRequestSchema>;
export type RevokeConsentRequest = z.infer<typeof RevokeConsentRequestSchema>;
export type ConsentGrantProjection = z.infer<typeof ConsentGrantProjectionSchema>;
export type ConsentOverviewProjection = z.infer<typeof ConsentOverviewProjectionSchema>;
export type ConsentTransitionEvent = z.infer<typeof ConsentTransitionEventSchema>;
export type AuditHistoryQuery = z.infer<typeof AuditHistoryQuerySchema>;
export type AuditHistoryProjection = z.infer<typeof AuditHistoryProjectionSchema>;
export type PrivacyPreferencesProjection = z.infer<typeof PrivacyPreferencesProjectionSchema>;
export type UpdatePrivacyPreferences = z.infer<typeof UpdatePrivacyPreferencesSchema>;
export type GovernedRecipientContextProjection = z.infer<
  typeof GovernedRecipientContextProjectionSchema
>;

export const CoordinationPermissionSchema = z.enum([
  "coordination.timeline.read",
  "coordination.task.handoff",
  "coordination.calendar.read",
  "coordination.appointment.create",
  "coordination.appointment.change",
  "coordination.appointment.cancel",
  "coordination.medication_reminder.read",
  "coordination.medication_reminder.create",
  "coordination.medication_reminder.change",
  "coordination.medication_reminder.disable",
  "notification.medication_reminder.read",
  "notification.medication_reminder.acknowledge",
  "coordination.care_plan.read",
  "coordination.care_plan.history.read",
  "coordination.care_plan.draft.save",
  "coordination.care_plan.version.confirm",
  "coordination.emergency_contacts.read",
  "coordination.emergency_contacts.replace",
  "coordination.emergency_contacts.history.read",
  "coordination.emergency_plan.read",
  "coordination.emergency_plan.draft.save",
  "coordination.emergency_plan.version.review",
  "coordination.emergency_plan.history.read",
  "coordination.emergency_plan.offline_snapshot.read",
  "coordination.document_vault.list",
  "coordination.document_vault.upload",
  "coordination.document_vault.metadata.read",
  "coordination.document_vault.content.download",
  "coordination.document_vault.delete",
]);
export const CoordinationActorDisplayKeySchema = z.enum([
  "coordination.actor.you",
  "coordination.actor.household_member",
]);
export const CoordinationActorSchema = z
  .object({
    actorId: OpaqueIdSchema,
    actorRef: OpaqueIdSchema,
    displayKey: CoordinationActorDisplayKeySchema,
    subject: z.boolean(),
  })
  .strict();

export const CoordinationAuthorizationDecisionSchema = z
  .object({
    decisionId: OpaqueIdSchema,
    permission: CoordinationPermissionSchema,
    actor: CoordinationActorSchema,
    householdId: OpaqueIdSchema,
    recipientContextId: OpaqueIdSchema,
    documentId: OpaqueIdSchema.optional(),
    subjectId: OpaqueIdSchema,
    subjectVersion: z.number().int().positive(),
    grantId: OpaqueIdSchema.nullable(),
    grantVersion: z.number().int().positive().nullable(),
    privacyVersion: z.number().int().positive().nullable(),
    target: CoordinationActorSchema.nullable(),
    eligibleTargets: z.array(CoordinationActorSchema).max(25),
    decidedAt: z.iso.datetime({ offset: true }),
    correlationId: CorrelationIdSchema,
    requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const CoordinationAuthorizationRequestSchema = z
  .object({
    permission: CoordinationPermissionSchema,
    householdId: OpaqueIdSchema,
    taskId: OpaqueIdSchema.optional(),
    appointmentId: OpaqueIdSchema.optional(),
    medicationReminderId: OpaqueIdSchema.optional(),
    medicationOccurrenceId: OpaqueIdSchema.optional(),
    documentId: OpaqueIdSchema.optional(),
    targetActorRef: OpaqueIdSchema.optional(),
    requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((value, context) => {
    const handoff = value.permission === "coordination.task.handoff";
    if (handoff !== Boolean(value.taskId)) {
      context.addIssue({ code: "custom", message: "task_scope_required", path: ["taskId"] });
    }
    const appointmentMutation =
      value.permission === "coordination.appointment.change" ||
      value.permission === "coordination.appointment.cancel";
    if (appointmentMutation !== Boolean(value.appointmentId)) {
      context.addIssue({
        code: "custom",
        message: "appointment_scope_required",
        path: ["appointmentId"],
      });
    }
    const medicationMutation =
      value.permission === "coordination.medication_reminder.change" ||
      value.permission === "coordination.medication_reminder.disable";
    const medicationRead = value.permission === "coordination.medication_reminder.read";
    if (
      (medicationMutation && !value.medicationReminderId) ||
      (!medicationMutation && !medicationRead && value.medicationReminderId)
    ) {
      context.addIssue({
        code: "custom",
        message: "medication_reminder_scope_required",
        path: ["medicationReminderId"],
      });
    }
    const medicationAcknowledgement =
      value.permission === "notification.medication_reminder.acknowledge";
    if (medicationAcknowledgement !== Boolean(value.medicationOccurrenceId)) {
      context.addIssue({
        code: "custom",
        message: "medication_occurrence_scope_required",
        path: ["medicationOccurrenceId"],
      });
    }
    const documentScoped =
      value.permission === "coordination.document_vault.metadata.read" ||
      value.permission === "coordination.document_vault.content.download" ||
      value.permission === "coordination.document_vault.delete";
    const documentUnscoped =
      value.permission === "coordination.document_vault.list" ||
      value.permission === "coordination.document_vault.upload";
    if (
      documentScoped !== Boolean(value.documentId) ||
      (!documentUnscoped && !documentScoped && value.documentId)
    ) {
      context.addIssue({
        code: "custom",
        message: "document_scope_required",
        path: ["documentId"],
      });
    }
    if (!handoff && value.targetActorRef) {
      context.addIssue({
        code: "custom",
        message: "target_scope_not_allowed",
        path: ["targetActorRef"],
      });
    }
  });

export type CoordinationPermission = z.infer<typeof CoordinationPermissionSchema>;
export type CoordinationActor = z.infer<typeof CoordinationActorSchema>;
export type CoordinationAuthorizationDecision = z.infer<
  typeof CoordinationAuthorizationDecisionSchema
>;
export type CoordinationAuthorizationRequest = z.infer<
  typeof CoordinationAuthorizationRequestSchema
>;

const CommunityOpaqueIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const CommunityCorrelationIdSchema = CommunityOpaqueIdSchema;
const CommunityInstantSchema = z.iso.datetime({ offset: true });

export const CommunityPurposeSchema = z.literal("community_support");
export const CommunityHelpRequestScopeSchema = z.literal("community_help_request.access");
export const CommunityPermissionSchema = z.enum([
  "community.help_request.list",
  "community.help_request.submit",
  "community.help_request.reconcile",
  "community.help_request.close",
  "community.help_request.delete",
]);
export const CommunityHelpCategorySchema = z.enum([
  "daily_living_support",
  "transport_coordination",
  "household_errand",
  "social_connection",
  "digital_access",
  "accessibility_support",
]);
export const CommunityProvinceCityCodeSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[A-Z0-9-]+$/);
export const CommunityDayPartSchema = z
  .enum(["flexible", "morning", "afternoon", "evening"])
  .nullable();
export const CommunitySubmissionReferenceSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const CommunityAuthorizationRequestSchema = z
  .object({
    permission: CommunityPermissionSchema,
    householdId: CommunityOpaqueIdSchema,
    requestId: CommunityOpaqueIdSchema.optional(),
    requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((value, context) => {
    const requestScoped =
      value.permission === "community.help_request.close" ||
      value.permission === "community.help_request.delete";
    if (requestScoped !== Boolean(value.requestId)) {
      context.addIssue({
        code: "custom",
        message: "community_request_scope_required",
        path: ["requestId"],
      });
    }
  });

export const CommunityAuthorizationContextSchema = z
  .object({
    decisionId: CommunityOpaqueIdSchema,
    purpose: CommunityPurposeSchema,
    permission: CommunityPermissionSchema,
    actorRef: CommunityOpaqueIdSchema,
    householdId: CommunityOpaqueIdSchema,
    recipientContextId: CommunityOpaqueIdSchema,
    subjectVersion: z.number().int().positive(),
    grantId: CommunityOpaqueIdSchema.nullable(),
    grantVersion: z.number().int().positive().nullable(),
    privacyVersion: z.number().int().positive().nullable(),
    requestId: CommunityOpaqueIdSchema.nullable(),
    decidedAt: CommunityInstantSchema,
    correlationId: CommunityCorrelationIdSchema,
    requestDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const CommunityHelpRequestSubmissionSchema = z
  .object({
    submissionReference: CommunitySubmissionReferenceSchema,
    category: CommunityHelpCategorySchema,
    location: z
      .object({
        granularity: z.literal("province_city"),
        provinceCityCode: CommunityProvinceCityCodeSchema,
      })
      .strict(),
    dayPart: CommunityDayPartSchema,
    disclosure: z
      .object({
        purpose: CommunityPurposeSchema,
        visibility: z.literal("current_request_collaborators"),
        policyVersion: z.literal("P5-S1-v1"),
        confirmed: z.literal(true),
      })
      .strict(),
  })
  .strict();

export const CommunityHelpRequestListCommandSchema = z
  .object({
    operation: z.literal("list"),
    authorization: CommunityAuthorizationContextSchema,
  })
  .strict();
export const CommunityHelpRequestSubmitCommandSchema = z
  .object({
    operation: z.literal("submit"),
    authorization: CommunityAuthorizationContextSchema,
    request: CommunityHelpRequestSubmissionSchema,
  })
  .strict();
export const CommunityHelpRequestReconcileCommandSchema = z
  .object({
    operation: z.literal("reconcile"),
    authorization: CommunityAuthorizationContextSchema,
    submissionReference: CommunitySubmissionReferenceSchema,
  })
  .strict();
export const CommunityHelpRequestVersionRequestSchema = z
  .object({ expectedVersion: z.number().int().positive() })
  .strict();
export const CommunityHelpRequestCloseCommandSchema = z
  .object({
    operation: z.literal("close"),
    authorization: CommunityAuthorizationContextSchema,
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const CommunityHelpRequestDeleteCommandSchema = z
  .object({
    operation: z.literal("delete"),
    authorization: CommunityAuthorizationContextSchema,
    expectedVersion: z.number().int().positive(),
  })
  .strict();
export const CommunityHelpRequestCommandSchema = z.discriminatedUnion("operation", [
  CommunityHelpRequestListCommandSchema,
  CommunityHelpRequestSubmitCommandSchema,
  CommunityHelpRequestReconcileCommandSchema,
  CommunityHelpRequestCloseCommandSchema,
  CommunityHelpRequestDeleteCommandSchema,
]);

export const CommunityHelpRequestProjectionSchema = z
  .object({
    requestId: CommunityOpaqueIdSchema,
    submissionReference: CommunitySubmissionReferenceSchema,
    category: CommunityHelpCategorySchema,
    locationGranularity: z.literal("province_city"),
    provinceCityCode: CommunityProvinceCityCodeSchema,
    dayPart: CommunityDayPartSchema,
    visibility: z.literal("current_request_collaborators"),
    status: z.enum(["pending", "closed"]),
    submissionOutcome: z.literal("confirmed"),
    matchingState: z.literal("unavailable_in_p5_s1"),
    retentionPolicy: z.literal("pending_30d_closed_30d_then_purge"),
    version: z.number().int().positive(),
    confirmedAt: CommunityInstantSchema,
    pendingAutoCloseAt: CommunityInstantSchema,
    closedAt: CommunityInstantSchema.nullable(),
    purgeAfter: CommunityInstantSchema.nullable(),
  })
  .strict();
export const CommunityHelpRequestListProjectionSchema = z
  .object({
    requests: z.array(CommunityHelpRequestProjectionSchema).max(25),
    serverTime: CommunityInstantSchema,
  })
  .strict();
export const CommunityHelpRequestMutationResultSchema = z
  .object({
    outcome: z.enum(["submitted", "closed"]),
    duplicate: z.boolean(),
    request: CommunityHelpRequestProjectionSchema,
    confirmedAt: CommunityInstantSchema,
  })
  .strict();
export const CommunityHelpRequestDeleteResultSchema = z
  .object({
    outcome: z.literal("deleted"),
    deletedRequestId: CommunityOpaqueIdSchema,
    confirmedAt: CommunityInstantSchema,
  })
  .strict();

export const CommunityPublicDirectoryQuerySchema = z
  .object({
    category: CommunityHelpCategorySchema.optional(),
    provinceCityCode: CommunityProvinceCityCodeSchema.optional(),
    organizationType: z.enum(["public_service", "nonprofit", "community_group"]).optional(),
  })
  .strict();
export const CommunityDirectoryListingSchema = z
  .object({
    listingId: CommunityOpaqueIdSchema,
    publicName: z.string().min(1).max(120),
    organizationType: z.enum(["public_service", "nonprofit", "community_group"]),
    provinceCityCode: CommunityProvinceCityCodeSchema,
    provinceCityLabel: z.string().min(1).max(120),
    categories: z.array(CommunityHelpCategorySchema).min(1).max(6),
    contactChannel: z
      .object({
        type: z.enum(["phone", "website", "in_person"]),
        label: z.string().min(1).max(80),
        value: z.string().min(1).max(200),
      })
      .strict(),
    accessibilityContactNote: z.literal("contact_for_accessibility_details").nullable(),
    provenance: z
      .object({
        sourceLabel: z.string().min(1).max(120),
        sourceUrl: z.url().max(500),
        lastReviewedAt: CommunityInstantSchema,
        nextReviewAt: CommunityInstantSchema,
        state: z.enum(["current", "stale"]),
      })
      .strict(),
    availabilityState: z.literal("not_verified"),
    eligibilityState: z.literal("not_determined"),
    endorsementState: z.literal("none"),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.categories).size !== value.categories.length) {
      context.addIssue({ code: "custom", message: "duplicate_directory_category" });
    }
  });
export const CommunityPublicDirectoryResultSchema = z
  .object({
    items: z.array(CommunityDirectoryListingSchema).max(25),
    generatedAt: CommunityInstantSchema,
    cachePolicy: z.literal("public_5m_session_24h"),
    matchingState: z.literal("unavailable_in_p5_s1"),
    resultMeaning: z.literal("informational_not_eligibility_availability_or_endorsement"),
  })
  .strict();

export const CommunityFailureCodeSchema = z.enum([
  "COMMUNITY_REQUEST_VALIDATION_FAILED",
  "COMMUNITY_REQUEST_DUPLICATE",
  "COMMUNITY_REQUEST_VERSION_CONFLICT",
  "COMMUNITY_REQUEST_STATE_CONFLICT",
  "COMMUNITY_REQUEST_RESULT_UNKNOWN",
  "COMMUNITY_RESOURCE_NOT_FOUND",
  "COMMUNITY_AUTHORITY_REQUIRED",
  "COMMUNITY_CONSENT_REVOKED",
  "IDEMPOTENCY_KEY_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "DIRECTORY_VALIDATION_FAILED",
  "DIRECTORY_SEARCH_UNAVAILABLE",
  "IDENTITY_SERVICE_UNAVAILABLE",
  "COMMUNITY_SERVICE_UNAVAILABLE",
  "INTERNAL_CONTRACT_INVALID",
]);
export const CommunityFailureSchema = z
  .object({
    error: z
      .object({
        code: CommunityFailureCodeSchema,
        messageKey: z
          .string()
          .min(1)
          .max(120)
          .regex(/^[a-z0-9._-]+$/),
        retryable: z.boolean(),
        correlationId: CommunityCorrelationIdSchema,
      })
      .strict(),
  })
  .strict();
const CommunityMetaSchema = z.object({ correlationId: CommunityCorrelationIdSchema }).strict();
export const CommunityDirectorySuccessSchema = z
  .object({
    data: CommunityPublicDirectoryResultSchema,
    meta: CommunityMetaSchema,
  })
  .strict();
export const CommunityHelpRequestListSuccessSchema = z
  .object({
    data: CommunityHelpRequestListProjectionSchema,
    meta: CommunityMetaSchema,
  })
  .strict();
export const CommunityHelpRequestMutationSuccessSchema = z
  .object({
    data: CommunityHelpRequestMutationResultSchema,
    meta: CommunityMetaSchema,
  })
  .strict();
export const CommunityHelpRequestDeleteSuccessSchema = z
  .object({
    data: CommunityHelpRequestDeleteResultSchema,
    meta: CommunityMetaSchema,
  })
  .strict();
export const CommunityOutboxEventSchema = z
  .object({
    eventId: CommunityOpaqueIdSchema,
    eventType: z.enum([
      "community.help_request.submitted.v1",
      "community.help_request.closed.v1",
      "community.help_request.deleted.v1",
    ]),
    eventVersion: z.literal(1),
    producer: z.literal("community"),
    aggregateId: CommunityOpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    lifecycleOutcome: z.enum(["pending", "closed", "deleted"]),
    deliveryState: z.literal("suppressed_not_configured"),
    occurredAt: CommunityInstantSchema,
    correlationId: CommunityCorrelationIdSchema,
    causationId: CommunityOpaqueIdSchema,
  })
  .strict();

export type CommunityPermission = z.infer<typeof CommunityPermissionSchema>;
export type CommunityAuthorizationRequest = z.infer<typeof CommunityAuthorizationRequestSchema>;
export type CommunityAuthorizationContext = z.infer<typeof CommunityAuthorizationContextSchema>;
export type CommunityHelpRequestSubmission = z.infer<typeof CommunityHelpRequestSubmissionSchema>;
export type CommunityHelpRequestProjection = z.infer<typeof CommunityHelpRequestProjectionSchema>;
export type CommunityPublicDirectoryQuery = z.infer<typeof CommunityPublicDirectoryQuerySchema>;
export type CommunityPublicDirectoryResult = z.infer<typeof CommunityPublicDirectoryResultSchema>;

const coordinationMutationPermissions = new Set<CoordinationPermission>([
  "coordination.task.handoff",
  "coordination.appointment.create",
  "coordination.appointment.change",
  "coordination.appointment.cancel",
  "coordination.medication_reminder.create",
  "coordination.medication_reminder.change",
  "coordination.medication_reminder.disable",
  "notification.medication_reminder.acknowledge",
  "coordination.care_plan.draft.save",
  "coordination.care_plan.version.confirm",
  "coordination.emergency_contacts.replace",
  "coordination.emergency_plan.draft.save",
  "coordination.emergency_plan.version.review",
  "coordination.document_vault.upload",
  "coordination.document_vault.delete",
]);

export function isCoordinationMutationPermission(permission: CoordinationPermission): boolean {
  return coordinationMutationPermissions.has(permission);
}

export const PrioritySchema = z.enum(["normal", "important", "urgent"]);
export const TaskStatusSchema = z.enum(["open", "completed"]);
export const NotificationDeliverySchema = z.enum([
  "not_started",
  "pending",
  "retrying",
  "failed",
  "delivered",
  "suppressed",
]);

export function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export const MemberSchema = z
  .object({
    memberId: OpaqueIdSchema,
    householdId: OpaqueIdSchema,
    displayNameKey: z.string().min(1).max(80),
    role: z.enum(["caregiver", "member"]),
    active: z.boolean(),
  })
  .strict();

export const CreateTaskRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional().default(""),
    assigneeId: OpaqueIdSchema,
    careRecipientId: OpaqueIdSchema,
    dueAt: z.iso.datetime({ offset: true }),
    dueTimeZone: IanaTimeZoneSchema,
    priority: PrioritySchema,
  })
  .strict();

export const CompleteTaskRequestSchema = z
  .object({
    operation: z.literal("complete"),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const TaskProjectionSchema = z
  .object({
    taskId: OpaqueIdSchema,
    householdId: OpaqueIdSchema,
    careRecipientId: OpaqueIdSchema,
    title: z.string().min(1).max(120),
    description: z.string().max(500),
    assigneeId: OpaqueIdSchema,
    createdBy: OpaqueIdSchema,
    dueAt: z.iso.datetime({ offset: true }),
    dueTimeZone: IanaTimeZoneSchema,
    priority: PrioritySchema,
    status: TaskStatusSchema,
    version: z.number().int().positive(),
    createdAt: z.iso.datetime({ offset: true }),
    completedBy: OpaqueIdSchema.nullable(),
    completedAt: z.iso.datetime({ offset: true }).nullable(),
    notificationDelivery: NotificationDeliverySchema,
  })
  .strict();

export const TimelineFilterSchema = z.enum([
  "all",
  "task_created",
  "task_completed",
  "task_handoff",
]);

export const DailyTimelineQuerySchema = z
  .object({
    localDate: LocalDateSchema,
    displayTimeZone: IanaTimeZoneSchema,
    filter: TimelineFilterSchema.default("all"),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    cursor: z.string().min(20).max(2048).optional(),
  })
  .strict();

export const TimelineActorSchema = CoordinationActorSchema.omit({ actorId: true }).strict();

export const DailyTimelineItemSchema = z
  .object({
    eventRef: OpaqueIdSchema,
    kind: z.enum(["task_created", "task_completed", "task_handoff"]),
    taskId: OpaqueIdSchema,
    taskTitle: z.string().min(1).max(120),
    actor: TimelineActorSchema.nullable(),
    fromActor: TimelineActorSchema.nullable(),
    toActor: TimelineActorSchema.nullable(),
    reasonCode: z
      .enum(["availability_changed", "schedule_conflict", "coverage_update", "other_coordination"])
      .nullable(),
    occurredAt: z.iso.datetime({ offset: true }),
    outcome: z.literal("confirmed"),
  })
  .strict()
  .superRefine((value, context) => {
    const isHandoff = value.kind === "task_handoff";
    if (
      isHandoff !== Boolean(value.fromActor && value.toActor && value.reasonCode && !value.actor)
    ) {
      context.addIssue({ code: "custom", message: "invalid_timeline_actor_shape" });
    }
    if (!isHandoff && (!value.actor || value.fromActor || value.toActor || value.reasonCode)) {
      context.addIssue({ code: "custom", message: "invalid_timeline_actor_shape" });
    }
  });

export const DailyTimelineProjectionSchema = z
  .object({
    localDate: LocalDateSchema,
    displayTimeZone: IanaTimeZoneSchema,
    dayStartUtc: z.iso.datetime({ offset: true }),
    dayEndUtc: z.iso.datetime({ offset: true }),
    filter: TimelineFilterSchema,
    snapshotAt: z.iso.datetime({ offset: true }),
    coverageStartedAt: z.iso.datetime({ offset: true }),
    coverage: z.enum(["complete", "history_unavailable"]),
    items: z.array(DailyTimelineItemSchema).max(50),
    nextCursor: z.string().min(20).max(2048).nullable(),
  })
  .strict();

export const HandoffReasonCodeSchema = z.enum([
  "availability_changed",
  "schedule_conflict",
  "coverage_update",
  "other_coordination",
]);

export const HandoffTaskRequestSchema = z
  .object({
    operation: z.literal("handoff"),
    expectedTaskVersion: z.number().int().positive(),
    expectedFromActorRef: OpaqueIdSchema,
    toActorRef: OpaqueIdSchema,
    reasonCode: HandoffReasonCodeSchema,
    effectiveTime: ImmediateEffectiveTimeSchema,
  })
  .strict()
  .refine((value) => value.expectedFromActorRef !== value.toActorRef, {
    message: "handoff_target_must_differ",
    path: ["toActorRef"],
  });

export const HandoffReviewProjectionSchema = z
  .object({
    taskId: OpaqueIdSchema,
    taskTitle: z.string().min(1).max(120),
    taskStatus: TaskStatusSchema,
    taskVersion: z.number().int().positive(),
    currentActor: TimelineActorSchema,
    eligibleTargets: z.array(TimelineActorSchema).max(25),
    effectiveMode: z.literal("immediate"),
    displayTimeZone: IanaTimeZoneSchema,
    serverTime: z.iso.datetime({ offset: true }),
  })
  .strict();

export const HandoffResultProjectionSchema = z
  .object({
    taskId: OpaqueIdSchema,
    taskVersion: z.number().int().positive(),
    currentActor: TimelineActorSchema,
    fromActor: TimelineActorSchema,
    reasonCode: HandoffReasonCodeSchema,
    occurredAt: z.iso.datetime({ offset: true }),
    effectiveAt: z.iso.datetime({ offset: true }),
    eventRef: OpaqueIdSchema,
    outcome: z.literal("accepted"),
    notificationDelivery: z.enum(["pending", "suppressed"]),
  })
  .strict();

export const AppointmentKindSchema = z.enum([
  "household_coordination",
  "transport",
  "community_support",
  "other_personal",
]);
export const AppointmentLogisticsSchema = z.enum(["unspecified", "in_person", "phone", "online"]);
export const AppointmentStatusSchema = z.enum(["scheduled", "cancelled"]);
export const AppointmentLastChangeSchema = z.enum(["created", "changed", "cancelled"]);
export const AppointmentReminderLeadMinutesSchema = z.union([
  z.literal(15),
  z.literal(60),
  z.literal(1440),
]);
export const AppointmentAmbiguousTimePolicySchema = z.enum(["earlier", "later"]);

export const AppointmentRecurrenceSchema = z.discriminatedUnion("frequency", [
  z.object({ frequency: z.literal("none") }).strict(),
  z
    .object({
      frequency: z.literal("weekly"),
      intervalWeeks: z.number().int().min(1).max(4),
      occurrenceCount: z.number().int().min(2).max(12),
    })
    .strict(),
]);

export const AppointmentScheduleSchema = z
  .object({
    localStart: LocalDateTimeSchema,
    sourceTimeZone: IanaTimeZoneSchema,
    sourceUtcOffset: UtcOffsetSchema,
    ambiguousTimePolicy: AppointmentAmbiguousTimePolicySchema,
    durationMinutes: z.number().int().min(15).max(480),
    recurrence: AppointmentRecurrenceSchema,
  })
  .strict();

export const CreateAppointmentRequestSchema = z
  .object({
    operation: z.literal("create_appointment"),
    appointmentKind: AppointmentKindSchema,
    logisticsMode: AppointmentLogisticsSchema,
    schedule: AppointmentScheduleSchema,
    reminder: z.object({ leadMinutes: AppointmentReminderLeadMinutesSchema.nullable() }).strict(),
  })
  .strict();

export const ChangeAppointmentRequestSchema = z
  .object({
    operation: z.literal("change_appointment"),
    scope: z.literal("occurrence_only"),
    expectedVersion: z.number().int().positive(),
    appointmentKind: AppointmentKindSchema,
    logisticsMode: AppointmentLogisticsSchema,
    schedule: AppointmentScheduleSchema.extend({
      recurrence: z.object({ frequency: z.literal("none") }).strict(),
    }).strict(),
    reminder: z.object({ leadMinutes: AppointmentReminderLeadMinutesSchema.nullable() }).strict(),
  })
  .strict();

export const CancelAppointmentRequestSchema = z
  .object({
    operation: z.literal("cancel_appointment"),
    scope: z.literal("occurrence_only"),
    expectedVersion: z.number().int().positive(),
    reasonCode: z.enum(["no_longer_needed", "schedule_changed", "duplicate", "other_coordination"]),
  })
  .strict();

export const AppointmentProjectionSchema = z
  .object({
    appointmentId: OpaqueIdSchema,
    seriesId: OpaqueIdSchema,
    householdId: OpaqueIdSchema,
    recipientContextId: OpaqueIdSchema,
    kind: AppointmentKindSchema,
    logistics: AppointmentLogisticsSchema,
    status: AppointmentStatusSchema,
    lastChange: AppointmentLastChangeSchema,
    startsAtUtc: CanonicalUtcInstantSchema,
    endsAtUtc: CanonicalUtcInstantSchema,
    sourceLocalStart: LocalDateTimeSchema,
    sourceUtcOffset: UtcOffsetSchema,
    sourceTimeZone: IanaTimeZoneSchema,
    durationMinutes: z.number().int().min(15).max(480),
    occurrenceNumber: z.number().int().positive(),
    occurrenceCount: z.number().int().positive().max(12),
    recurrenceFrequency: z.enum(["none", "weekly"]),
    recurrenceIntervalWeeks: z.number().int().min(1).max(4).nullable(),
    recurrenceFinalLocalDate: LocalDateSchema,
    mutationScope: z.literal("occurrence_only"),
    reminderIntent: z.enum(["not_requested", "recorded", "cancelled"]),
    reminderLeadMinutes: AppointmentReminderLeadMinutesSchema.nullable(),
    version: z.number().int().positive(),
    createdAt: CanonicalUtcInstantSchema,
    updatedAt: CanonicalUtcInstantSchema,
    cancelledAt: CanonicalUtcInstantSchema.nullable(),
    confirmedAt: CanonicalUtcInstantSchema,
  })
  .strict()
  .refine((value) => value.endsAtUtc > value.startsAtUtc, {
    message: "appointment_interval_invalid",
    path: ["endsAtUtc"],
  })
  .refine((value) => value.occurrenceNumber <= value.occurrenceCount, {
    message: "appointment_occurrence_invalid",
    path: ["occurrenceNumber"],
  });

export const AppointmentSeriesProjectionSchema = z
  .object({
    seriesId: OpaqueIdSchema,
    appointments: z.array(AppointmentProjectionSchema).min(1).max(12),
  })
  .strict();

export const CalendarFilterSchema = z.enum(["all", "scheduled", "cancelled"]);
export const CalendarQuerySchema = z
  .object({
    localDate: LocalDateSchema,
    displayTimeZone: IanaTimeZoneSchema,
    filter: CalendarFilterSchema.default("all"),
  })
  .strict();

export const CalendarProjectionSchema = z
  .object({
    localDate: LocalDateSchema,
    displayTimeZone: IanaTimeZoneSchema,
    dayStartUtc: CanonicalUtcInstantSchema,
    dayEndUtc: CanonicalUtcInstantSchema,
    filter: CalendarFilterSchema,
    coverageStartedAt: CanonicalUtcInstantSchema,
    coverage: z.enum(["complete", "history_unavailable"]),
    items: z.array(AppointmentProjectionSchema).max(100),
    snapshotAt: CanonicalUtcInstantSchema,
  })
  .strict();

export const AppointmentConflictProjectionSchema = z
  .object({
    startsAtUtc: CanonicalUtcInstantSchema,
    endsAtUtc: CanonicalUtcInstantSchema,
  })
  .strict();

export const AppointmentReminderIntentEventSchema = z
  .object({
    eventId: OpaqueIdSchema,
    eventType: z.literal("care.appointment.reminder_intent.v1"),
    eventVersion: z.literal(1),
    occurredAt: CanonicalUtcInstantSchema,
    producer: z.literal("care-coordination"),
    aggregateId: OpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    correlationId: CorrelationIdSchema,
    causationId: OpaqueIdSchema,
    payload: z.discriminatedUnion("intent", [
      z
        .object({
          intent: z.literal("schedule"),
          recipientId: OpaqueIdSchema,
          remindAtUtc: CanonicalUtcInstantSchema,
          startsAtUtc: CanonicalUtcInstantSchema,
          messageKey: z.literal("notifications.appointment.reminder"),
        })
        .strict(),
      z
        .object({
          intent: z.literal("cancel"),
          recipientId: OpaqueIdSchema,
          messageKey: z.literal("notifications.appointment.reminder"),
        })
        .strict(),
    ]),
  })
  .strict();

const SingleLineTextSchema = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) =>
        Array.from(value).every((character) => {
          const codePoint = character.codePointAt(0) ?? 0;
          return codePoint > 0x1f && codePoint !== 0x7f;
        }),
      "single_line_required",
    );

export const MedicationReminderLabelSchema = SingleLineTextSchema(80);
export const MedicationReminderAmountSchema = z
  .string()
  .regex(/^(?:0\.(?:00[1-9]|0[1-9]\d|[1-9]\d{0,2})|[1-9]\d{0,2}(?:\.\d{1,3})?)$/)
  .refine((value) => Number(value) >= 0.001 && Number(value) <= 999.999, "amount_range");
export const MedicationReminderUnitSchema = z.enum([
  "tablet",
  "capsule",
  "millilitre",
  "drop",
  "puff",
  "patch",
  "application",
  "unit",
  "other",
]);
export const MedicationReminderStatusSchema = z.enum(["active", "disabled"]);
export const MedicationOccurrenceStateSchema = z.enum(["current", "superseded", "disabled"]);

export const MedicationReminderRecurrenceSchema = z.discriminatedUnion("frequency", [
  z.object({ frequency: z.literal("none") }).strict(),
  z
    .object({
      frequency: z.literal("daily"),
      intervalDays: z.number().int().min(1).max(7),
      occurrenceCount: z.number().int().min(2).max(31),
    })
    .strict(),
  z
    .object({
      frequency: z.literal("weekly"),
      intervalWeeks: z.number().int().min(1).max(4),
      occurrenceCount: z.number().int().min(2).max(12),
    })
    .strict(),
]);

export const MedicationReminderScheduleSchema = z
  .object({
    localStart: LocalDateTimeSchema,
    sourceTimeZone: IanaTimeZoneSchema,
    sourceUtcOffset: UtcOffsetSchema,
    ambiguousTimePolicy: AppointmentAmbiguousTimePolicySchema.nullable(),
    recurrence: MedicationReminderRecurrenceSchema,
  })
  .strict();

const MedicationReminderFactsSchema = z
  .object({
    medicationLabel: MedicationReminderLabelSchema,
    amount: MedicationReminderAmountSchema,
    unit: MedicationReminderUnitSchema,
    otherUnitLabel: SingleLineTextSchema(24).nullable(),
    schedule: MedicationReminderScheduleSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const other = value.unit === "other";
    if (other !== Boolean(value.otherUnitLabel)) {
      context.addIssue({
        code: "custom",
        message: other ? "other_unit_required" : "other_unit_not_allowed",
        path: ["otherUnitLabel"],
      });
    }
  });

export const CreateMedicationReminderRequestSchema = MedicationReminderFactsSchema.extend({
  operation: z.literal("create_medication_reminder"),
}).strict();

export const ChangeMedicationReminderRequestSchema = MedicationReminderFactsSchema.extend({
  operation: z.literal("change_medication_reminder"),
  expectedVersion: z.number().int().positive(),
}).strict();

export const DisableMedicationReminderRequestSchema = z
  .object({
    operation: z.literal("disable_medication_reminder"),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const MedicationReminderOccurrenceProjectionSchema = z
  .object({
    occurrenceId: OpaqueIdSchema,
    reminderId: OpaqueIdSchema,
    scheduleVersion: z.number().int().positive(),
    occurrenceNumber: z.number().int().positive(),
    occurrenceCount: z.number().int().min(1).max(31),
    sourceLocalStart: LocalDateTimeSchema,
    sourceTimeZone: IanaTimeZoneSchema,
    sourceUtcOffset: UtcOffsetSchema,
    scheduledAtUtc: CanonicalUtcInstantSchema,
    recurrenceFinalLocalDate: LocalDateSchema,
    state: MedicationOccurrenceStateSchema,
    notificationIntent: z.enum(["recorded", "cancelled"]),
  })
  .strict()
  .refine((value) => value.occurrenceNumber <= value.occurrenceCount, {
    message: "medication_occurrence_invalid",
    path: ["occurrenceNumber"],
  });

export const MedicationReminderProjectionSchema = z
  .object({
    reminderId: OpaqueIdSchema,
    householdId: OpaqueIdSchema,
    recipientContextId: OpaqueIdSchema,
    medicationLabel: MedicationReminderLabelSchema,
    amount: MedicationReminderAmountSchema,
    unit: MedicationReminderUnitSchema,
    otherUnitLabel: SingleLineTextSchema(24).nullable(),
    sourceLocalStart: LocalDateTimeSchema,
    sourceTimeZone: IanaTimeZoneSchema,
    sourceUtcOffset: UtcOffsetSchema,
    ambiguousTimePolicy: AppointmentAmbiguousTimePolicySchema.nullable(),
    recurrence: MedicationReminderRecurrenceSchema,
    status: MedicationReminderStatusSchema,
    version: z.number().int().positive(),
    occurrences: z.array(MedicationReminderOccurrenceProjectionSchema).min(1).max(31),
    createdAt: CanonicalUtcInstantSchema,
    updatedAt: CanonicalUtcInstantSchema,
    disabledAt: CanonicalUtcInstantSchema.nullable(),
    confirmedAt: CanonicalUtcInstantSchema,
  })
  .strict();

export const MedicationReminderListProjectionSchema = z
  .object({
    items: z.array(MedicationReminderProjectionSchema).max(50),
    snapshotAt: CanonicalUtcInstantSchema,
  })
  .strict();

export const MedicationReminderIntentEventSchema = z
  .object({
    eventId: OpaqueIdSchema,
    eventType: z.literal("care.medication_reminder.intent.v1"),
    eventVersion: z.literal(1),
    occurredAt: CanonicalUtcInstantSchema,
    producer: z.literal("care-coordination"),
    aggregateId: OpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    correlationId: CorrelationIdSchema,
    causationId: OpaqueIdSchema,
    payload: z.discriminatedUnion("intent", [
      z
        .object({
          intent: z.literal("schedule"),
          reminderId: OpaqueIdSchema,
          occurrenceId: OpaqueIdSchema,
          householdId: OpaqueIdSchema,
          recipientContextId: OpaqueIdSchema,
          recipientId: OpaqueIdSchema,
          occurrenceVersion: z.number().int().positive(),
          scheduledAtUtc: CanonicalUtcInstantSchema,
          sourceLocalStart: LocalDateTimeSchema,
          sourceTimeZone: IanaTimeZoneSchema,
          sourceUtcOffset: UtcOffsetSchema,
          messageKey: z.literal("notifications.medication_reminder.generic"),
        })
        .strict(),
      z
        .object({
          intent: z.literal("cancel"),
          reminderId: OpaqueIdSchema,
          occurrenceId: OpaqueIdSchema,
          householdId: OpaqueIdSchema,
          recipientContextId: OpaqueIdSchema,
          recipientId: OpaqueIdSchema,
          occurrenceVersion: z.number().int().positive(),
          reason: z.enum(["schedule_changed", "schedule_disabled"]),
          messageKey: z.literal("notifications.medication_reminder.generic"),
        })
        .strict(),
    ]),
  })
  .strict();

export const MedicationReminderIntentStateSchema = z.enum(["pending", "cancelled"]);
export const MedicationReminderDeliveryStateSchema = z.enum([
  "pending",
  "uncertain",
  "delivered",
  "failed",
  "missed",
  "cancelled",
]);
export const MedicationReminderDeliveryEvidenceSchema = z.enum(["none", "in_app_persisted"]);
export const MedicationReminderAcknowledgementStateSchema = z.enum(["unacknowledged", "seen"]);

export const MedicationReminderNotificationProjectionSchema = z
  .object({
    notificationId: OpaqueIdSchema.nullable(),
    reminderId: OpaqueIdSchema,
    occurrenceId: OpaqueIdSchema,
    sourceLocalStart: LocalDateTimeSchema.nullable(),
    sourceTimeZone: IanaTimeZoneSchema.nullable(),
    sourceUtcOffset: UtcOffsetSchema.nullable(),
    scheduledAtUtc: CanonicalUtcInstantSchema.nullable(),
    messageKey: z.literal("notifications.medication_reminder.generic"),
    intentState: MedicationReminderIntentStateSchema,
    deliveryState: MedicationReminderDeliveryStateSchema,
    deliveryEvidence: MedicationReminderDeliveryEvidenceSchema,
    attemptCount: z.number().int().nonnegative().max(3),
    deliveredAt: CanonicalUtcInstantSchema.nullable(),
    failedAt: CanonicalUtcInstantSchema.nullable(),
    missedAt: CanonicalUtcInstantSchema.nullable(),
    acknowledgementState: MedicationReminderAcknowledgementStateSchema,
    acknowledgedAt: CanonicalUtcInstantSchema.nullable(),
    version: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, context) => {
    const delivered = value.deliveryState === "delivered";
    if (
      delivered !== (value.deliveryEvidence === "in_app_persisted" && Boolean(value.deliveredAt))
    ) {
      context.addIssue({ code: "custom", message: "delivery_evidence_invalid" });
    }
    if ((value.acknowledgementState === "seen") !== Boolean(value.acknowledgedAt)) {
      context.addIssue({ code: "custom", message: "acknowledgement_evidence_invalid" });
    }
  });

export const MedicationReminderNotificationListSchema = z
  .object({
    items: z.array(MedicationReminderNotificationProjectionSchema).max(50),
    snapshotAt: CanonicalUtcInstantSchema,
  })
  .strict();

export const AcknowledgeMedicationReminderRequestSchema = z
  .object({
    operation: z.literal("acknowledge_medication_reminder"),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const MedicationReminderAcknowledgementResultSchema = z
  .object({
    result: z.enum(["recorded", "duplicate"]),
    notification: MedicationReminderNotificationProjectionSchema,
  })
  .strict();

export const MedicationReminderSeenEventSchema = z
  .object({
    eventId: OpaqueIdSchema,
    eventType: z.literal("notification.medication_reminder.seen.v1"),
    eventVersion: z.literal(1),
    occurredAt: CanonicalUtcInstantSchema,
    producer: z.literal("notification"),
    aggregateId: OpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    correlationId: CorrelationIdSchema,
    causationId: OpaqueIdSchema,
    payload: z
      .object({
        reminderId: OpaqueIdSchema,
        occurrenceId: OpaqueIdSchema,
        outcome: z.literal("seen"),
        acknowledgedAt: CanonicalUtcInstantSchema,
      })
      .strict(),
  })
  .strict();

const CoordinationStatementSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine(
    (value) =>
      [...value].every((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code > 31 && code !== 127;
      }),
    "control_character_rejected",
  );
export const CarePlanGoalCategorySchema = z.enum([
  "daily_routine",
  "communication",
  "transport",
  "community",
  "other_coordination",
]);
export const CarePlanPreferenceCategorySchema = z.enum([
  "communication",
  "schedule",
  "support_style",
  "privacy",
  "other_coordination",
]);
export const CarePlanResponsibilityCategorySchema = z.enum([
  "follow_up",
  "coordination",
  "transport",
  "household_support",
  "other_coordination",
]);
export const CarePlanGoalSchema = z
  .object({ category: CarePlanGoalCategorySchema, statement: CoordinationStatementSchema })
  .strict();
export const CarePlanPreferenceSchema = z
  .object({ category: CarePlanPreferenceCategorySchema, statement: CoordinationStatementSchema })
  .strict();
export const CarePlanResponsibilitySchema = z
  .object({
    category: CarePlanResponsibilityCategorySchema,
    statement: CoordinationStatementSchema,
    actorRef: OpaqueIdSchema,
  })
  .strict();
export const SaveCarePlanDraftRequestSchema = z
  .object({
    operation: z.literal("save_care_plan_draft"),
    expectedAggregateRevision: z.number().int().nonnegative(),
    expectedDraftRevision: z.number().int().nonnegative().nullable(),
    baseCurrentVersion: z.number().int().positive().nullable(),
    goals: z.array(CarePlanGoalSchema).max(10),
    preferences: z.array(CarePlanPreferenceSchema).max(10),
    responsibilities: z.array(CarePlanResponsibilitySchema).max(10),
    reviewLocalDate: LocalDateSchema.nullable(),
    reviewTimeZone: IanaTimeZoneSchema.nullable(),
  })
  .strict()
  .refine((value) => (value.reviewLocalDate === null) === (value.reviewTimeZone === null), {
    message: "review_date_zone_pair_required",
    path: ["reviewTimeZone"],
  });
export const ConfirmCarePlanVersionRequestSchema = z
  .object({
    operation: z.literal("confirm_care_plan_version"),
    expectedAggregateRevision: z.number().int().positive(),
    expectedDraftRevision: z.number().int().positive(),
    baseCurrentVersion: z.number().int().positive().nullable(),
  })
  .strict();
export const CarePlanReviewFactsSchema = z
  .object({
    reviewLocalDate: LocalDateSchema,
    reviewTimeZone: IanaTimeZoneSchema,
    reviewDayStartUtc: CanonicalUtcInstantSchema,
    reviewDayEndUtc: CanonicalUtcInstantSchema,
    reviewState: z.enum(["upcoming", "due_today", "overdue"]),
  })
  .strict();
export const CarePlanResponsibilityProjectionSchema = z
  .object({
    category: CarePlanResponsibilityCategorySchema,
    statement: CoordinationStatementSchema,
    actor: z.discriminatedUnion("state", [
      z.object({ state: z.literal("eligible"), actorRef: OpaqueIdSchema }).strict(),
      z.object({ state: z.literal("authorization_changed") }).strict(),
    ]),
  })
  .strict();
export const CarePlanVersionProjectionSchema = z
  .object({
    planVersion: z.number().int().positive(),
    changeGroups: z
      .array(
        z.enum([
          "initial",
          "goals_changed",
          "preferences_changed",
          "responsibilities_changed",
          "review_date_changed",
        ]),
      )
      .min(1)
      .max(5),
    goals: z.array(CarePlanGoalSchema).min(1).max(10),
    preferences: z.array(CarePlanPreferenceSchema).max(10),
    responsibilities: z.array(CarePlanResponsibilityProjectionSchema).min(1).max(10),
    review: CarePlanReviewFactsSchema,
    confirmedAt: CanonicalUtcInstantSchema,
    eventRef: OpaqueIdSchema,
  })
  .strict();
export const CarePlanDraftProjectionSchema = z
  .object({
    draftRevision: z.number().int().positive(),
    baseCurrentVersion: z.number().int().positive().nullable(),
    goals: z.array(CarePlanGoalSchema).max(10),
    preferences: z.array(CarePlanPreferenceSchema).max(10),
    responsibilities: z.array(CarePlanResponsibilityProjectionSchema).max(10),
    reviewLocalDate: LocalDateSchema.nullable(),
    reviewTimeZone: IanaTimeZoneSchema.nullable(),
    reviewDayStartUtc: CanonicalUtcInstantSchema.nullable(),
    reviewDayEndUtc: CanonicalUtcInstantSchema.nullable(),
    publicationReadiness: z.enum(["incomplete", "ready"]),
    updatedAt: CanonicalUtcInstantSchema,
  })
  .strict();
export const CarePlanProjectionSchema = z
  .object({
    state: z.enum(["no_plan", "plan"]),
    planId: OpaqueIdSchema.nullable(),
    aggregateRevision: z.number().int().nonnegative(),
    current: CarePlanVersionProjectionSchema.nullable(),
    draft: CarePlanDraftProjectionSchema.nullable(),
    eligibleResponsibilityActors: z.array(CoordinationActorSchema).max(25),
    reviewState: z.enum(["not_applicable", "upcoming", "due_today", "overdue"]),
    requiresReview: z.boolean(),
    coverageStartedAt: CanonicalUtcInstantSchema,
    serverTime: CanonicalUtcInstantSchema,
  })
  .strict();
export const CarePlanMutationResultSchema = z
  .object({
    planId: OpaqueIdSchema,
    aggregateRevision: z.number().int().positive(),
    draftRevision: z.number().int().positive().nullable(),
    planVersion: z.number().int().positive().nullable(),
    outcome: z.enum(["draft_saved", "confirmed"]),
    confirmedAt: CanonicalUtcInstantSchema,
    review: CarePlanReviewFactsSchema.nullable(),
    eventRef: OpaqueIdSchema.nullable(),
  })
  .strict();
export const CarePlanHistoryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(25).default(10),
    cursor: z.string().max(4096).optional(),
  })
  .strict();
export const CarePlanHistoryProjectionSchema = z
  .object({
    versions: z.array(CarePlanVersionProjectionSchema).max(25),
    nextCursor: z.string().nullable(),
    coverageStartedAt: CanonicalUtcInstantSchema,
  })
  .strict();
export const CarePlanVersionConfirmedEventSchema = z
  .object({
    eventId: OpaqueIdSchema,
    eventType: z.literal("care.care_plan.version_confirmed.v1"),
    eventVersion: z.literal(1),
    occurredAt: CanonicalUtcInstantSchema,
    producer: z.literal("care-coordination"),
    aggregateId: OpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    correlationId: CorrelationIdSchema,
    causationId: OpaqueIdSchema,
    payload: z
      .object({ outcome: z.literal("confirmed"), deliveryDisposition: z.literal("none") })
      .strict(),
  })
  .strict();

export const EmergencyContactInputSchema = z
  .object({
    contactId: OpaqueIdSchema.optional(),
    expectedVersion: z.number().int().positive().optional(),
    displayLabel: SingleLineTextSchema(60),
    dialString: z.string().regex(/^\+?\d{3,15}$/),
  })
  .strict()
  .superRefine((value, context) => {
    if (Boolean(value.contactId) !== Boolean(value.expectedVersion)) {
      context.addIssue({
        code: "custom",
        message: "contact_version_pair_required",
        path: ["expectedVersion"],
      });
    }
  });

export const ReplaceEmergencyContactsRequestSchema = z
  .object({
    operation: z.literal("replace_emergency_contacts"),
    expectedListRevision: z.number().int().nonnegative(),
    contacts: z.array(EmergencyContactInputSchema).max(10),
  })
  .strict()
  .superRefine((value, context) => {
    const identifiers = value.contacts.flatMap((contact) =>
      contact.contactId ? [contact.contactId] : [],
    );
    if (new Set(identifiers).size !== identifiers.length) {
      context.addIssue({ code: "custom", message: "duplicate_contact_id", path: ["contacts"] });
    }
  });

export const EmergencyContactProjectionSchema = z
  .object({
    contactId: OpaqueIdSchema,
    position: z.number().int().positive().max(10),
    displayLabel: SingleLineTextSchema(60),
    dialString: z.string().regex(/^\+?\d{3,15}$/),
    version: z.number().int().positive(),
  })
  .strict();

export const EmergencyContactListProjectionSchema = z
  .object({
    state: z.enum(["no_contacts", "configured"]),
    listRevision: z.number().int().nonnegative(),
    contacts: z.array(EmergencyContactProjectionSchema).max(10),
    lastConfirmedAtUtc: CanonicalUtcInstantSchema,
  })
  .strict();

export const EmergencyContactMutationResultSchema = z
  .object({
    outcome: z.literal("contacts_replaced"),
    listRevision: z.number().int().positive(),
    contacts: z
      .array(
        z
          .object({
            contactId: OpaqueIdSchema,
            position: z.number().int().positive().max(10),
            version: z.number().int().positive(),
          })
          .strict(),
      )
      .max(10),
    planState: z.enum(["no_plan", "draft_only", "reviewed", "review_required"]),
    confirmedAtUtc: CanonicalUtcInstantSchema,
  })
  .strict();

export const EmergencyHistoryQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(25).default(10),
    cursor: z.string().max(4096).optional(),
  })
  .strict();

export const EmergencyContactHistoryProjectionSchema = z
  .object({
    revisions: z
      .array(
        z
          .object({
            listRevision: z.number().int().positive(),
            action: z.literal("replaced"),
            occurredAtUtc: CanonicalUtcInstantSchema,
          })
          .strict(),
      )
      .max(25),
    nextCursor: z.string().nullable(),
    coverageStartedAtUtc: CanonicalUtcInstantSchema,
  })
  .strict();

export const SaveEmergencyPlanDraftRequestSchema = z
  .object({
    operation: z.literal("save_emergency_plan_draft"),
    expectedAggregateRevision: z.number().int().nonnegative(),
    expectedDraftRevision: z.number().int().nonnegative(),
    basePlanVersion: z.number().int().nonnegative(),
    contactListRevision: z.number().int().nonnegative(),
    steps: z.array(SingleLineTextSchema(160)).min(1).max(8),
  })
  .strict();

export const ReviewEmergencyPlanVersionRequestSchema = z
  .object({
    operation: z.literal("review_emergency_plan_version"),
    expectedAggregateRevision: z.number().int().nonnegative(),
    expectedDraftRevision: z.number().int().positive(),
    basePlanVersion: z.number().int().nonnegative(),
    contactListRevision: z.number().int().positive(),
    displayTimeZone: IanaTimeZoneSchema,
  })
  .strict();

export const EmergencyPlanStateSchema = z.enum([
  "no_plan",
  "draft_only",
  "reviewed",
  "review_required",
]);

export const EmergencyPlanDraftProjectionSchema = z
  .object({
    draftRevision: z.number().int().positive(),
    basePlanVersion: z.number().int().nonnegative(),
    contactListRevision: z.number().int().nonnegative(),
    steps: z.array(SingleLineTextSchema(160)).min(1).max(8),
    updatedAtUtc: CanonicalUtcInstantSchema,
  })
  .strict();

export const EmergencyPlanVersionProjectionSchema = z
  .object({
    planVersion: z.number().int().positive(),
    contactListRevision: z.number().int().positive(),
    steps: z.array(SingleLineTextSchema(160)).min(1).max(8),
    reviewedAtUtc: CanonicalUtcInstantSchema,
    displayTimeZone: IanaTimeZoneSchema,
    displayLocalTime: z.string().min(1).max(80),
    displayUtcOffset: UtcOffsetSchema,
  })
  .strict();

export const EmergencyPlanProjectionSchema = z
  .object({
    state: EmergencyPlanStateSchema,
    aggregateRevision: z.number().int().nonnegative(),
    contactListRevision: z.number().int().nonnegative(),
    current: EmergencyPlanVersionProjectionSchema.nullable(),
    draft: EmergencyPlanDraftProjectionSchema.nullable(),
    lastConfirmedAtUtc: CanonicalUtcInstantSchema,
  })
  .strict();

export const EmergencyPlanMutationResultSchema = z
  .object({
    outcome: z.enum(["draft_saved", "version_reviewed"]),
    aggregateRevision: z.number().int().positive(),
    draftRevision: z.number().int().positive().nullable(),
    planVersion: z.number().int().positive().nullable(),
    contactListRevision: z.number().int().nonnegative(),
    state: EmergencyPlanStateSchema,
    confirmedAtUtc: CanonicalUtcInstantSchema,
  })
  .strict();

export const EmergencyPlanHistoryProjectionSchema = z
  .object({
    versions: z
      .array(
        z
          .object({
            planVersion: z.number().int().positive(),
            contactListRevision: z.number().int().positive(),
            reviewedAtUtc: CanonicalUtcInstantSchema,
            displayTimeZone: IanaTimeZoneSchema,
            displayLocalTime: z.string().min(1).max(80),
            displayUtcOffset: UtcOffsetSchema,
          })
          .strict(),
      )
      .max(25),
    nextCursor: z.string().nullable(),
    coverageStartedAtUtc: CanonicalUtcInstantSchema,
  })
  .strict();

export const EmergencyOfflineSnapshotSchema = z
  .object({
    contractVersion: z.literal("P4-S2-offline-v1"),
    source: z.literal("care-coordination"),
    scopeBinding: z.string().regex(/^[a-f0-9]{64}$/),
    planVersion: z.number().int().positive(),
    contactListRevision: z.number().int().positive(),
    reviewedAtUtc: CanonicalUtcInstantSchema,
    lastConfirmedAtUtc: CanonicalUtcInstantSchema,
    displayTimeZone: IanaTimeZoneSchema,
    displayLocalTime: z.string().min(1).max(80),
    displayUtcOffset: UtcOffsetSchema,
    freshUntilUtc: CanonicalUtcInstantSchema,
    expiresAtUtc: CanonicalUtcInstantSchema,
    contacts: z
      .array(EmergencyContactProjectionSchema.omit({ version: true }))
      .min(1)
      .max(10),
    steps: z
      .array(
        z
          .object({
            position: z.number().int().positive().max(8),
            text: SingleLineTextSchema(160),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();

const EmergencyEventBaseSchema = z
  .object({
    eventId: OpaqueIdSchema,
    eventVersion: z.literal(1),
    occurredAt: CanonicalUtcInstantSchema,
    producer: z.literal("care-coordination"),
    aggregateId: OpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    correlationId: CorrelationIdSchema,
    causationId: OpaqueIdSchema,
  })
  .strict();

const EmergencyEventPayloadSchema = z
  .object({
    action: z.enum(["contacts_replaced", "version_reviewed"]),
    outcome: z.literal("confirmed"),
    contactListRevision: z.number().int().nonnegative(),
    planVersion: z.number().int().nonnegative(),
    deliveryDisposition: z.literal("none"),
  })
  .strict();

export const EmergencyContactsChangedEventSchema = EmergencyEventBaseSchema.extend({
  eventType: z.literal("care.emergency_contacts.changed.v1"),
  payload: EmergencyEventPayloadSchema,
}).strict();

export const EmergencyPlanVersionReviewedEventSchema = EmergencyEventBaseSchema.extend({
  eventType: z.literal("care.emergency_plan.version_reviewed.v1"),
  payload: EmergencyEventPayloadSchema,
}).strict();

const EventBaseSchema = z
  .object({
    eventId: OpaqueIdSchema,
    eventType: z.literal("care.task.completed.v1"),
    eventVersion: z.literal(1),
    occurredAt: z.iso.datetime({ offset: true }),
    producer: z.literal("care-coordination"),
    aggregateId: OpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    correlationId: CorrelationIdSchema,
    causationId: OpaqueIdSchema,
  })
  .strict();

const DeliverPayloadSchema = z
  .object({
    householdId: OpaqueIdSchema,
    notificationDisposition: z.literal("deliver"),
    recipientId: OpaqueIdSchema,
    completedBy: OpaqueIdSchema,
    completedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((value) => value.recipientId !== value.completedBy, {
    message: "recipient_must_differ_from_completer",
    path: ["recipientId"],
  });

const SuppressPayloadSchema = z
  .object({
    householdId: OpaqueIdSchema,
    notificationDisposition: z.literal("suppress_self"),
    completedBy: OpaqueIdSchema,
    completedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const CareTaskCompletedEventSchema = EventBaseSchema.extend({
  payload: z.discriminatedUnion("notificationDisposition", [
    DeliverPayloadSchema,
    SuppressPayloadSchema,
  ]),
}).strict();

export const CareTaskHandedOffEventSchema = z
  .object({
    eventId: OpaqueIdSchema,
    eventType: z.literal("care.task.handed_off.v1"),
    eventVersion: z.literal(1),
    occurredAt: z.iso.datetime({ offset: true }),
    producer: z.literal("care-coordination"),
    aggregateId: OpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    correlationId: CorrelationIdSchema,
    causationId: OpaqueIdSchema,
    payload: z
      .object({
        householdId: OpaqueIdSchema,
        recipientContextId: OpaqueIdSchema,
        fromActorId: OpaqueIdSchema,
        toActorId: OpaqueIdSchema,
        reasonCode: HandoffReasonCodeSchema,
        outcome: z.literal("accepted"),
        effectiveAt: z.iso.datetime({ offset: true }),
        notificationDisposition: z.literal("deliver"),
        recipientId: OpaqueIdSchema,
      })
      .strict()
      .refine(
        (value) => value.fromActorId !== value.toActorId && value.recipientId === value.toActorId,
        {
          message: "handoff_notification_recipient_invalid",
          path: ["recipientId"],
        },
      ),
  })
  .strict();

export const CareCoordinationEventSchema = z.union([
  CareTaskCompletedEventSchema,
  CareTaskHandedOffEventSchema,
  AppointmentReminderIntentEventSchema,
  MedicationReminderIntentEventSchema,
  CarePlanVersionConfirmedEventSchema,
  EmergencyContactsChangedEventSchema,
  EmergencyPlanVersionReviewedEventSchema,
]);

export const NotificationSchema = z
  .object({
    notificationId: OpaqueIdSchema,
    recipientId: OpaqueIdSchema,
    sourceEventId: OpaqueIdSchema,
    sourceTaskId: OpaqueIdSchema,
    messageKey: z.enum(["notifications.task.completed", "notifications.task.handed_off"]),
    messageParams: z
      .object({
        taskId: OpaqueIdSchema,
      })
      .strict(),
    read: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ConsumerAcknowledgementSchema = z
  .object({
    eventId: OpaqueIdSchema,
    result: z.enum([
      "stored",
      "duplicate",
      "suppressed_self",
      "reminder_scheduled",
      "reminder_cancelled",
      "medication_reminder_scheduled",
      "medication_reminder_cancelled",
    ]),
    notificationId: OpaqueIdSchema.nullable(),
    processedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const DashboardProjectionSchema = z
  .object({
    openCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    nextTasks: z.array(TaskProjectionSchema).max(5),
    lastConfirmedAt: z.iso.datetime({ offset: true }).nullable(),
    taskSourceFreshness: z.literal("current"),
    notificationDependency: z.enum(["available", "degraded"]),
    notifications: z.array(NotificationSchema).nullable(),
  })
  .strict();

export const DocumentProcessingStateSchema = z.enum([
  "processing",
  "ready_unscanned",
  "rejected",
  "failed",
  "integrity_failed",
]);
export const DocumentScannerStatusSchema = z.literal("not_configured");
export const DocumentMalwareStatusSchema = z.literal("not_scanned");
export const DocumentProcessingEvidenceSchema = z.literal("strict_text_and_integrity_validation");
export const DocumentAccessPolicySchema = z.literal(
  "care_recipient_and_current_document_collaborators",
);
export const DocumentRetentionPolicySchema = z.literal("retained_until_explicit_delete");

export const UploadDocumentRequestSchema = z
  .object({
    uploadReference: OpaqueIdSchema,
    fileName: z.string().min(1).max(255),
    declaredType: z.string().min(1).max(80),
    decodedSizeBytes: z.number().int().min(1).max(300_000),
    contentBase64: z
      .string()
      .min(4)
      .max(400_000)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
  })
  .strict();

export const DeleteDocumentRequestSchema = z
  .object({
    expectedVaultVersion: z.number().int().positive(),
    expectedDocumentVersion: z.number().int().positive(),
  })
  .strict();

export const DocumentProjectionSchema = z
  .object({
    documentId: OpaqueIdSchema,
    uploadReference: OpaqueIdSchema,
    displayName: z.string().min(1).max(120),
    verifiedType: z.literal("text/plain"),
    sizeBytes: z.number().int().min(1).max(262_144),
    processingState: DocumentProcessingStateSchema,
    scannerStatus: DocumentScannerStatusSchema,
    malwareStatus: DocumentMalwareStatusSchema,
    processingEvidence: DocumentProcessingEvidenceSchema,
    accessPolicy: DocumentAccessPolicySchema,
    retentionPolicy: DocumentRetentionPolicySchema,
    version: z.number().int().positive(),
    uploadedAt: z.iso.datetime({ offset: true }),
    processingConfirmedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();

export const DocumentVaultProjectionSchema = z
  .object({
    vaultVersion: z.number().int().positive(),
    documents: z.array(DocumentProjectionSchema).max(25),
    serverTime: z.iso.datetime({ offset: true }),
  })
  .strict();

export const DocumentMutationResultSchema = z
  .object({
    vaultVersion: z.number().int().positive(),
    document: DocumentProjectionSchema.nullable(),
    deletedDocumentId: OpaqueIdSchema.nullable(),
    confirmedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const DocumentContentMetadataSchema = z
  .object({
    documentId: OpaqueIdSchema,
    displayName: z.string().min(1).max(120),
    sizeBytes: z.number().int().min(1).max(262_144),
    version: z.number().int().positive(),
  })
  .strict();

export const DocumentVaultEventSchema = z
  .object({
    eventId: OpaqueIdSchema,
    eventType: z.enum([
      "care.document.upload_accepted.v1",
      "care.document.processing_state_changed.v1",
      "care.document.removed.v1",
    ]),
    eventVersion: z.literal(1),
    producer: z.literal("care-coordination"),
    aggregateId: OpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    occurredAt: z.iso.datetime({ offset: true }),
    correlationId: CorrelationIdSchema,
  })
  .strict();

export type UploadDocumentRequest = z.infer<typeof UploadDocumentRequestSchema>;
export type DeleteDocumentRequest = z.infer<typeof DeleteDocumentRequestSchema>;
export type DocumentProjection = z.infer<typeof DocumentProjectionSchema>;
export type DocumentVaultProjection = z.infer<typeof DocumentVaultProjectionSchema>;
export type DocumentMutationResult = z.infer<typeof DocumentMutationResultSchema>;
export type DocumentContentMetadata = z.infer<typeof DocumentContentMetadataSchema>;
export type DocumentVaultEvent = z.infer<typeof DocumentVaultEventSchema>;

export const ApiErrorCodeSchema = z.enum([
  "TASK_VALIDATION_FAILED",
  "IDEMPOTENCY_KEY_REQUIRED",
  "IDEMPOTENCY_KEY_REUSED",
  "TASK_NOT_FOUND",
  "TASK_VERSION_CONFLICT",
  "NOTIFICATION_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_CONTRACT_INVALID",
  "REGISTRATION_ACCEPTED",
  "AUTHENTICATION_CONTINUE",
  "AUTHENTICATION_FAILED",
  "AUTHENTICATION_RATE_LIMITED",
  "RECOVERY_ACCEPTED",
  "SESSION_REQUIRED",
  "SESSION_EXPIRED",
  "CSRF_REJECTED",
  "ORIGIN_REJECTED",
  "PREFERENCES_VERSION_CONFLICT",
  "IDENTITY_SERVICE_UNAVAILABLE",
  "HOUSEHOLD_NOT_FOUND",
  "HOUSEHOLD_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "INVITATION_ACCEPTED",
  "INVITATION_DECLINED",
  "INVITATION_EXPIRED",
  "INVITATION_REVOKED",
  "INVITATION_RATE_LIMITED",
  "CONSENT_VALIDATION_FAILED",
  "CONSENT_AUTHORITY_REQUIRED",
  "CONSENT_RESOURCE_NOT_FOUND",
  "CONSENT_VERSION_CONFLICT",
  "CONSENT_SCOPE_BROADENING_REJECTED",
  "COMMUNITY_CONSENT_REVOKED",
  "AUDIT_CURSOR_INVALID",
  "PRIVACY_VERSION_CONFLICT",
  "COORDINATION_RESOURCE_NOT_FOUND",
  "COORDINATION_AUTHORITY_REQUIRED",
  "TIMELINE_VALIDATION_FAILED",
  "TIMELINE_CURSOR_INVALID",
  "HANDOFF_VALIDATION_FAILED",
  "HANDOFF_VERSION_CONFLICT",
  "HANDOFF_STATE_CONFLICT",
  "APPOINTMENT_VALIDATION_FAILED",
  "APPOINTMENT_LOCAL_TIME_INVALID",
  "APPOINTMENT_RECURRENCE_INVALID",
  "CALENDAR_RANGE_TOO_DENSE",
  "APPOINTMENT_VERSION_CONFLICT",
  "APPOINTMENT_STATE_CONFLICT",
  "APPOINTMENT_TIME_CONFLICT",
  "APPOINTMENT_RESULT_UNKNOWN",
  "MEDICATION_REMINDER_VALIDATION_FAILED",
  "MEDICATION_REMINDER_LOCAL_TIME_INVALID",
  "MEDICATION_REMINDER_RECURRENCE_INVALID",
  "MEDICATION_REMINDER_VERSION_CONFLICT",
  "MEDICATION_REMINDER_STATE_CONFLICT",
  "MEDICATION_REMINDER_RESULT_UNKNOWN",
  "MEDICATION_NOTIFICATION_UNAVAILABLE",
  "MEDICATION_DELIVERY_STATE_CONFLICT",
  "MEDICATION_ACKNOWLEDGEMENT_VERSION_CONFLICT",
  "MEDICATION_ACKNOWLEDGEMENT_STATE_CONFLICT",
  "CARE_PLAN_VALIDATION_FAILED",
  "CARE_PLAN_REVIEW_DATE_INVALID",
  "CARE_PLAN_VERSION_CONFLICT",
  "CARE_PLAN_STATE_CONFLICT",
  "CARE_PLAN_CURSOR_INVALID",
  "CARE_PLAN_RESULT_UNKNOWN",
  "EMERGENCY_CONTACT_VALIDATION_FAILED",
  "EMERGENCY_CONTACT_LIST_VERSION_CONFLICT",
  "EMERGENCY_CONTACT_VERSION_CONFLICT",
  "EMERGENCY_PLAN_VALIDATION_FAILED",
  "EMERGENCY_PLAN_AGGREGATE_CONFLICT",
  "EMERGENCY_PLAN_DRAFT_CONFLICT",
  "EMERGENCY_PLAN_CONTACTS_CHANGED",
  "EMERGENCY_PLAN_REVIEW_REQUIRED",
  "EMERGENCY_PLAN_STATE_CONFLICT",
  "EMERGENCY_RESULT_UNKNOWN",
  "DOCUMENT_VALIDATION_FAILED",
  "DOCUMENT_TYPE_UNSUPPORTED",
  "DOCUMENT_TOO_LARGE",
  "DOCUMENT_CONTENT_REJECTED",
  "DOCUMENT_PROCESSING_PENDING",
  "DOCUMENT_PROCESSING_FAILED",
  "DOCUMENT_INTEGRITY_FAILED",
  "DOCUMENT_VERSION_CONFLICT",
  "DOCUMENT_VAULT_CONFLICT",
  "DOCUMENT_CAPACITY_REACHED",
  "DOCUMENT_RESULT_UNKNOWN",
  "DOCUMENT_STORAGE_UNAVAILABLE",
]);

export const ApiErrorSchema = z
  .object({
    error: z
      .object({
        code: ApiErrorCodeSchema,
        messageKey: z.string().min(1).max(120),
        fieldErrors: z.record(z.string(), z.string()).optional(),
        retryable: z.boolean(),
        correlationId: CorrelationIdSchema,
        currentTask: TaskProjectionSchema.optional(),
        currentAppointment: AppointmentProjectionSchema.optional(),
        conflict: AppointmentConflictProjectionSchema.optional(),
        recoveryAction: z
          .enum(["reload_current", "choose_another_time", "check_current_state"])
          .optional(),
      })
      .strict(),
  })
  .strict();

export type Member = z.infer<typeof MemberSchema>;
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;
export type CompleteTaskRequest = z.infer<typeof CompleteTaskRequestSchema>;
export type TaskProjection = z.infer<typeof TaskProjectionSchema>;
export type TimelineFilter = z.infer<typeof TimelineFilterSchema>;
export type DailyTimelineQuery = z.infer<typeof DailyTimelineQuerySchema>;
export type DailyTimelineItem = z.infer<typeof DailyTimelineItemSchema>;
export type DailyTimelineProjection = z.infer<typeof DailyTimelineProjectionSchema>;
export type HandoffReasonCode = z.infer<typeof HandoffReasonCodeSchema>;
export type HandoffTaskRequest = z.infer<typeof HandoffTaskRequestSchema>;
export type HandoffReviewProjection = z.infer<typeof HandoffReviewProjectionSchema>;
export type HandoffResultProjection = z.infer<typeof HandoffResultProjectionSchema>;
export type AppointmentKind = z.infer<typeof AppointmentKindSchema>;
export type AppointmentLogistics = z.infer<typeof AppointmentLogisticsSchema>;
export type AppointmentSchedule = z.infer<typeof AppointmentScheduleSchema>;
export type CreateAppointmentRequest = z.infer<typeof CreateAppointmentRequestSchema>;
export type ChangeAppointmentRequest = z.infer<typeof ChangeAppointmentRequestSchema>;
export type CancelAppointmentRequest = z.infer<typeof CancelAppointmentRequestSchema>;
export type AppointmentProjection = z.infer<typeof AppointmentProjectionSchema>;
export type AppointmentSeriesProjection = z.infer<typeof AppointmentSeriesProjectionSchema>;
export type AppointmentConflictProjection = z.infer<typeof AppointmentConflictProjectionSchema>;
export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;
export type CalendarFilter = z.infer<typeof CalendarFilterSchema>;
export type CalendarProjection = z.infer<typeof CalendarProjectionSchema>;
export type AppointmentReminderIntentEvent = z.infer<typeof AppointmentReminderIntentEventSchema>;
export type MedicationReminderUnit = z.infer<typeof MedicationReminderUnitSchema>;
export type MedicationReminderRecurrence = z.infer<typeof MedicationReminderRecurrenceSchema>;
export type MedicationReminderSchedule = z.infer<typeof MedicationReminderScheduleSchema>;
export type CreateMedicationReminderRequest = z.infer<typeof CreateMedicationReminderRequestSchema>;
export type ChangeMedicationReminderRequest = z.infer<typeof ChangeMedicationReminderRequestSchema>;
export type DisableMedicationReminderRequest = z.infer<
  typeof DisableMedicationReminderRequestSchema
>;
export type MedicationReminderOccurrenceProjection = z.infer<
  typeof MedicationReminderOccurrenceProjectionSchema
>;
export type MedicationReminderProjection = z.infer<typeof MedicationReminderProjectionSchema>;
export type MedicationReminderListProjection = z.infer<
  typeof MedicationReminderListProjectionSchema
>;
export type MedicationReminderIntentEvent = z.infer<typeof MedicationReminderIntentEventSchema>;
export type MedicationReminderNotificationProjection = z.infer<
  typeof MedicationReminderNotificationProjectionSchema
>;
export type MedicationReminderNotificationList = z.infer<
  typeof MedicationReminderNotificationListSchema
>;
export type AcknowledgeMedicationReminderRequest = z.infer<
  typeof AcknowledgeMedicationReminderRequestSchema
>;
export type MedicationReminderAcknowledgementResult = z.infer<
  typeof MedicationReminderAcknowledgementResultSchema
>;
export type MedicationReminderSeenEvent = z.infer<typeof MedicationReminderSeenEventSchema>;
export type SaveCarePlanDraftRequest = z.infer<typeof SaveCarePlanDraftRequestSchema>;
export type ConfirmCarePlanVersionRequest = z.infer<typeof ConfirmCarePlanVersionRequestSchema>;
export type CarePlanReviewFacts = z.infer<typeof CarePlanReviewFactsSchema>;
export type CarePlanVersionProjection = z.infer<typeof CarePlanVersionProjectionSchema>;
export type CarePlanDraftProjection = z.infer<typeof CarePlanDraftProjectionSchema>;
export type CarePlanProjection = z.infer<typeof CarePlanProjectionSchema>;
export type CarePlanMutationResult = z.infer<typeof CarePlanMutationResultSchema>;
export type CarePlanHistoryQuery = z.infer<typeof CarePlanHistoryQuerySchema>;
export type CarePlanHistoryProjection = z.infer<typeof CarePlanHistoryProjectionSchema>;
export type CarePlanVersionConfirmedEvent = z.infer<typeof CarePlanVersionConfirmedEventSchema>;
export type EmergencyContactInput = z.infer<typeof EmergencyContactInputSchema>;
export type ReplaceEmergencyContactsRequest = z.infer<typeof ReplaceEmergencyContactsRequestSchema>;
export type EmergencyContactProjection = z.infer<typeof EmergencyContactProjectionSchema>;
export type EmergencyContactListProjection = z.infer<typeof EmergencyContactListProjectionSchema>;
export type EmergencyContactMutationResult = z.infer<typeof EmergencyContactMutationResultSchema>;
export type EmergencyHistoryQuery = z.infer<typeof EmergencyHistoryQuerySchema>;
export type EmergencyContactHistoryProjection = z.infer<
  typeof EmergencyContactHistoryProjectionSchema
>;
export type SaveEmergencyPlanDraftRequest = z.infer<typeof SaveEmergencyPlanDraftRequestSchema>;
export type ReviewEmergencyPlanVersionRequest = z.infer<
  typeof ReviewEmergencyPlanVersionRequestSchema
>;
export type EmergencyPlanState = z.infer<typeof EmergencyPlanStateSchema>;
export type EmergencyPlanDraftProjection = z.infer<typeof EmergencyPlanDraftProjectionSchema>;
export type EmergencyPlanVersionProjection = z.infer<typeof EmergencyPlanVersionProjectionSchema>;
export type EmergencyPlanProjection = z.infer<typeof EmergencyPlanProjectionSchema>;
export type EmergencyPlanMutationResult = z.infer<typeof EmergencyPlanMutationResultSchema>;
export type EmergencyPlanHistoryProjection = z.infer<typeof EmergencyPlanHistoryProjectionSchema>;
export type EmergencyOfflineSnapshot = z.infer<typeof EmergencyOfflineSnapshotSchema>;
export type EmergencyContactsChangedEvent = z.infer<typeof EmergencyContactsChangedEventSchema>;
export type EmergencyPlanVersionReviewedEvent = z.infer<
  typeof EmergencyPlanVersionReviewedEventSchema
>;
export type CareTaskCompletedEvent = z.infer<typeof CareTaskCompletedEventSchema>;
export type CareTaskHandedOffEvent = z.infer<typeof CareTaskHandedOffEventSchema>;
export type CareCoordinationEvent = z.infer<typeof CareCoordinationEventSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type ConsumerAcknowledgement = z.infer<typeof ConsumerAcknowledgementSchema>;
export type DashboardProjection = z.infer<typeof DashboardProjectionSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type RegistrationRequest = z.infer<typeof RegistrationRequestSchema>;
export type RegistrationFactorRequest = z.infer<typeof RegistrationFactorRequestSchema>;
export type RegistrationRecoveryConfirmation = z.infer<
  typeof RegistrationRecoveryConfirmationSchema
>;
export type SignInRequest = z.infer<typeof SignInRequestSchema>;
export type SignInFactorRequest = z.infer<typeof SignInFactorRequestSchema>;
export type PasswordRecoveryRequest = z.infer<typeof PasswordRecoveryRequestSchema>;
export type FactorRecoveryRequest = z.infer<typeof FactorRecoveryRequestSchema>;
export type FactorRecoveryConfirmation = z.infer<typeof FactorRecoveryConfirmationSchema>;
export type IdentityPreferences = z.infer<typeof IdentityPreferencesSchema>;
export type UpdateIdentityPreferences = z.infer<typeof UpdateIdentityPreferencesSchema>;
export type CompleteAccountOnboarding = z.infer<typeof CompleteAccountOnboardingSchema>;
export type IdentitySessionProjection = z.infer<typeof IdentitySessionProjectionSchema>;

export interface SuccessEnvelope<T> {
  data: T;
  meta: {
    correlationId: string;
  };
}

export function successEnvelope<T>(data: T, correlationId: string): SuccessEnvelope<T> {
  return {
    data,
    meta: { correlationId },
  };
}
