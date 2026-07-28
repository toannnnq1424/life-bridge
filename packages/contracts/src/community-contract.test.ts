import { describe, expect, it } from "vitest";

import {
  CommunityAuthorizationContextSchema,
  CommunityDirectorySuccessSchema,
  CommunityFailureSchema,
  CommunityHelpRequestCommandSchema,
  CommunityHelpRequestSubmissionSchema,
  CommunityOutboxEventSchema,
  ConsentGrantProjectionSchema,
  GrantConsentRequestSchema,
} from "./index.js";

const authorization = {
  decisionId: "decision_synthetic_0001",
  purpose: "community_support" as const,
  permission: "community.help_request.submit" as const,
  actorRef: "actor_synthetic_0001",
  householdId: "household_synthetic",
  recipientContextId: "recipient_synthetic",
  subjectVersion: 3,
  grantId: null,
  grantVersion: null,
  privacyVersion: null,
  requestId: null,
  decidedAt: "2026-07-29T01:02:03.000Z",
  correlationId: "corr_p5s1_contract",
  requestDigest: "a".repeat(64),
};

const submission = {
  submissionReference: "submission_synthetic_0001",
  category: "daily_living_support" as const,
  location: {
    granularity: "province_city" as const,
    provinceCityCode: "SYN-PC-001",
  },
  dayPart: "flexible" as const,
  disclosure: {
    purpose: "community_support" as const,
    visibility: "current_request_collaborators" as const,
    policyVersion: "P5-S1-v1" as const,
    confirmed: true as const,
  },
};

describe("P5-S1 Community language-neutral contracts", () => {
  it("adds an exact purpose/scope pair without broadening old grants", () => {
    const grant = GrantConsentRequestSchema.parse({
      action: "grant",
      recipientRef: "member_synthetic_0001",
      purpose: "community_support",
      scopes: ["community_help_request.access"],
      effectiveTime: { mode: "immediate", displayTimeZone: "Asia/Bangkok" },
      expectedSubjectVersion: 2,
    });
    expect(grant.purpose).toBe("community_support");
    expect(() =>
      GrantConsentRequestSchema.parse({
        ...grant,
        purpose: "household_coordination",
      }),
    ).toThrow(/consent_scope_purpose_mismatch/);
    expect(() =>
      ConsentGrantProjectionSchema.parse({
        grantId: "grant_synthetic_0001",
        subjectId: "subject_synthetic_0001",
        recipientRef: "member_synthetic_0001",
        recipientDisplayKey: "consent.recipient.household_member",
        purpose: "community_support",
        scopes: ["recipient_context.basic_label"],
        state: "active",
        effectiveAt: "2026-07-29T01:02:03.000Z",
        revokedEffectiveAt: null,
        displayTimeZone: "Asia/Bangkok",
        version: 1,
      }),
    ).toThrow(/consent_scope_purpose_mismatch/);
  });

  it("accepts only bounded help-request fields and province/city granularity", () => {
    expect(CommunityHelpRequestSubmissionSchema.parse(submission)).toEqual(submission);
    expect(() =>
      CommunityHelpRequestSubmissionSchema.parse({
        ...submission,
        narrative: "free-form need",
      }),
    ).toThrow();
    expect(() =>
      CommunityHelpRequestSubmissionSchema.parse({
        ...submission,
        location: { granularity: "gps", latitude: 1, longitude: 2 },
      }),
    ).toThrow();
  });

  it("binds each protected command to an exact authorization decision", () => {
    expect(
      CommunityHelpRequestCommandSchema.parse({
        operation: "submit",
        authorization,
        request: submission,
      }),
    ).toMatchObject({ operation: "submit" });
    expect(() =>
      CommunityAuthorizationContextSchema.parse({
        ...authorization,
        purpose: "household_coordination",
      }),
    ).toThrow();
    expect(() =>
      CommunityHelpRequestCommandSchema.parse({
        operation: "close",
        authorization,
        expectedVersion: 1,
        notes: "not allowed",
      }),
    ).toThrow();
  });

  it("freezes public provenance truth and content-free failures/events", () => {
    const result = CommunityDirectorySuccessSchema.parse({
      data: {
        items: [
          {
            listingId: "listing_synthetic_0001",
            publicName: "Synthetic community desk",
            organizationType: "community_group",
            provinceCityCode: "SYN-PC-002",
            provinceCityLabel: "Synthetic Province/City 002",
            categories: ["social_connection"],
            contactChannel: {
              type: "website",
              label: "Synthetic public page",
              value: "https://example.invalid/community",
            },
            accessibilityContactNote: "contact_for_accessibility_details",
            provenance: {
              sourceLabel: "Synthetic reviewed source",
              sourceUrl: "https://example.invalid/source",
              lastReviewedAt: "2026-07-20T00:00:00.000Z",
              nextReviewAt: "2026-08-20T00:00:00.000Z",
              state: "current",
            },
            availabilityState: "not_verified",
            eligibilityState: "not_determined",
            endorsementState: "none",
          },
        ],
        generatedAt: "2026-07-29T01:02:03.000Z",
        cachePolicy: "public_5m_session_24h",
        matchingState: "unavailable_in_p5_s1",
        resultMeaning: "informational_not_eligibility_availability_or_endorsement",
      },
      meta: { correlationId: "corr_p5s1_contract" },
    });
    expect(result.data.items[0]?.provenance.state).toBe("current");

    const failure = CommunityFailureSchema.parse({
      error: {
        code: "COMMUNITY_CONSENT_REVOKED",
        messageKey: "community.consent_revoked",
        retryable: false,
        correlationId: "corr_p5s1_contract",
      },
    });
    const event = CommunityOutboxEventSchema.parse({
      eventId: "event_synthetic_0001",
      eventType: "community.help_request.submitted.v1",
      eventVersion: 1,
      producer: "community",
      aggregateId: "request_synthetic_0001",
      aggregateVersion: 1,
      lifecycleOutcome: "pending",
      deliveryState: "suppressed_not_configured",
      occurredAt: "2026-07-29T01:02:03.000Z",
      correlationId: "corr_p5s1_contract",
      causationId: "command_synthetic_0001",
    });
    expect(JSON.stringify({ failure, event })).not.toMatch(
      /submissionReference|provinceCity|category|dayPart|narrative/i,
    );
  });
});
