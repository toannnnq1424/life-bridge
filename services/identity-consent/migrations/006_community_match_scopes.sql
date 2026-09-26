ALTER TABLE identity_consent_grants
  DROP CONSTRAINT IF EXISTS identity_consent_grants_purpose_v5_check,
  DROP CONSTRAINT IF EXISTS identity_consent_grants_scopes_v5_check;

ALTER TABLE identity_consent_grants
  ADD CONSTRAINT identity_consent_grants_purpose_v6_check CHECK (
    purpose IN ('household_coordination', 'community_support', 'community_match_coordination')
  ),
  ADD CONSTRAINT identity_consent_grants_scopes_v6_check CHECK (
    (purpose = 'household_coordination' AND cardinality(scopes) BETWEEN 1 AND 3
      AND scopes <@ ARRAY['recipient_context.basic_label','recipient_context.relationship_label','document_vault.access']::TEXT[])
    OR (purpose = 'community_support' AND scopes = ARRAY['community_help_request.access']::TEXT[])
    OR (purpose = 'community_match_coordination' AND cardinality(scopes) = 1
      AND scopes <@ ARRAY[
        'community_match.volunteer.read','community_match.volunteer.respond',
        'community_match.coordinator.read','community_match.coordinator.manage',
        'community_match.progress.record'
      ]::TEXT[])
  );

ALTER TABLE identity_consent_transitions
  DROP CONSTRAINT IF EXISTS identity_consent_transitions_purpose_v5_check,
  DROP CONSTRAINT IF EXISTS identity_consent_transitions_scopes_v5_check;

ALTER TABLE identity_consent_transitions
  ADD CONSTRAINT identity_consent_transitions_purpose_v6_check CHECK (
    purpose IN ('household_coordination', 'community_support', 'community_match_coordination')
  ),
  ADD CONSTRAINT identity_consent_transitions_scopes_v6_check CHECK (
    cardinality(scopes) = 0
    OR (purpose = 'household_coordination' AND cardinality(scopes) BETWEEN 1 AND 3
      AND scopes <@ ARRAY['recipient_context.basic_label','recipient_context.relationship_label','document_vault.access']::TEXT[])
    OR (purpose = 'community_support' AND scopes = ARRAY['community_help_request.access']::TEXT[])
    OR (purpose = 'community_match_coordination' AND cardinality(scopes) = 1
      AND scopes <@ ARRAY[
        'community_match.volunteer.read','community_match.volunteer.respond',
        'community_match.coordinator.read','community_match.coordinator.manage',
        'community_match.progress.record'
      ]::TEXT[])
  );

INSERT INTO identity_schema_state(service, version, updated_at)
VALUES ('identity-consent', 6, CURRENT_TIMESTAMP)
ON CONFLICT (service) DO UPDATE SET
  version = GREATEST(identity_schema_state.version, EXCLUDED.version),
  updated_at = EXCLUDED.updated_at;
