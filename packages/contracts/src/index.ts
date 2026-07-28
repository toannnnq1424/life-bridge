import { z } from "zod";

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

export const CoordinationPermissionSchema = z.enum([
  "coordination.timeline.read",
  "coordination.task.handoff",
  "coordination.calendar.read",
  "coordination.appointment.create",
  "coordination.appointment.change",
  "coordination.appointment.cancel",
  "coordination.care_plan.read",
  "coordination.care_plan.history.read",
  "coordination.care_plan.draft.save",
  "coordination.care_plan.version.confirm",
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
  CarePlanVersionConfirmedEventSchema,
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
  "CARE_PLAN_VALIDATION_FAILED",
  "CARE_PLAN_REVIEW_DATE_INVALID",
  "CARE_PLAN_VERSION_CONFLICT",
  "CARE_PLAN_STATE_CONFLICT",
  "CARE_PLAN_CURSOR_INVALID",
  "CARE_PLAN_RESULT_UNKNOWN",
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
