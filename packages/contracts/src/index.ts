import { z } from "zod";

const opaqueIdPattern = /^[a-z][a-z0-9_-]{2,79}$/;
const correlationIdPattern = /^[A-Za-z0-9_-]{8,80}$/;
const idempotencyPattern = /^[\x21-\x7E]{8,128}$/;

export const OpaqueIdSchema = z.string().regex(opaqueIdPattern);
export const CorrelationIdSchema = z.string().regex(correlationIdPattern);
export const IdempotencyKeySchema = z.string().regex(idempotencyPattern);
export const LocaleSchema = z.enum(["vi-VN", "en"]);
export const IanaTimeZoneSchema = z.string().min(1).max(80).refine(isIanaTimeZone, {
  message: "invalid_time_zone",
});
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

export const ConsentScopeSchema = z.enum([
  "recipient_context.basic_label",
  "recipient_context.relationship_label",
]);
export const ConsentPurposeSchema = z.literal("household_coordination");
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
  .max(2)
  .superRefine((value, context) => {
    if (new Set(value).size !== value.length) {
      context.addIssue({ code: "custom", message: "duplicate_consent_scope" });
    }
  });

export const GrantConsentRequestSchema = z
  .object({
    action: z.literal("grant"),
    recipientRef: OpaqueIdSchema,
    purpose: ConsentPurposeSchema,
    scopes: ConsentScopeSetSchema,
    effectiveTime: ImmediateEffectiveTimeSchema,
    expectedSubjectVersion: z.number().int().positive(),
  })
  .strict();

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
  .strict();

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
    scopes: z.array(ConsentScopeSchema).max(2),
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
    scope: ConsentScopeSchema,
    value: z.string().min(1).max(80),
    grantId: OpaqueIdSchema.nullable(),
    authorizedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ConsentScope = z.infer<typeof ConsentScopeSchema>;
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

export const NotificationSchema = z
  .object({
    notificationId: OpaqueIdSchema,
    recipientId: OpaqueIdSchema,
    sourceEventId: OpaqueIdSchema,
    sourceTaskId: OpaqueIdSchema,
    messageKey: z.literal("notifications.task.completed"),
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
    result: z.enum(["stored", "duplicate", "suppressed_self"]),
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
  "AUDIT_CURSOR_INVALID",
  "PRIVACY_VERSION_CONFLICT",
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
        recoveryAction: z.literal("reload_current").optional(),
      })
      .strict(),
  })
  .strict();

export type Member = z.infer<typeof MemberSchema>;
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;
export type CompleteTaskRequest = z.infer<typeof CompleteTaskRequestSchema>;
export type TaskProjection = z.infer<typeof TaskProjectionSchema>;
export type CareTaskCompletedEvent = z.infer<typeof CareTaskCompletedEventSchema>;
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
