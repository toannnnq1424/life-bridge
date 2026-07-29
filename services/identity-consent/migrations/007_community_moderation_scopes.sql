ALTER TABLE identity_consent_grants
  DROP CONSTRAINT IF EXISTS identity_consent_grants_purpose_v6_check,
  DROP CONSTRAINT IF EXISTS identity_consent_grants_scopes_v6_check;
ALTER TABLE identity_consent_grants
  ADD CONSTRAINT identity_consent_grants_purpose_v7_check CHECK (purpose IN ('household_coordination','community_support','community_match_coordination','community_moderation_resolution')),
  ADD CONSTRAINT identity_consent_grants_scopes_v7_check CHECK (
    (purpose = 'household_coordination' AND cardinality(scopes) BETWEEN 1 AND 3 AND scopes <@ ARRAY['recipient_context.basic_label','recipient_context.relationship_label','document_vault.access']::TEXT[])
    OR (purpose = 'community_support' AND scopes = ARRAY['community_help_request.access']::TEXT[])
    OR (purpose = 'community_match_coordination' AND cardinality(scopes) = 1 AND scopes <@ ARRAY['community_match.volunteer.read','community_match.volunteer.respond','community_match.coordinator.read','community_match.coordinator.manage','community_match.progress.record']::TEXT[])
    OR (purpose = 'community_moderation_resolution' AND cardinality(scopes) = 1 AND scopes <@ ARRAY['community_moderation.queue.read','community_moderation.case.read','community_moderation.case.resolve','community_moderation.case.reconcile']::TEXT[]));
ALTER TABLE identity_consent_transitions
  DROP CONSTRAINT IF EXISTS identity_consent_transitions_purpose_v6_check,
  DROP CONSTRAINT IF EXISTS identity_consent_transitions_scopes_v6_check;
ALTER TABLE identity_consent_transitions
  ADD CONSTRAINT identity_consent_transitions_purpose_v7_check CHECK (purpose IN ('household_coordination','community_support','community_match_coordination','community_moderation_resolution')),
  ADD CONSTRAINT identity_consent_transitions_scopes_v7_check CHECK (
    cardinality(scopes) = 0
    OR (purpose = 'household_coordination' AND cardinality(scopes) BETWEEN 1 AND 3 AND scopes <@ ARRAY['recipient_context.basic_label','recipient_context.relationship_label','document_vault.access']::TEXT[])
    OR (purpose = 'community_support' AND scopes = ARRAY['community_help_request.access']::TEXT[])
    OR (purpose = 'community_match_coordination' AND cardinality(scopes) = 1 AND scopes <@ ARRAY['community_match.volunteer.read','community_match.volunteer.respond','community_match.coordinator.read','community_match.coordinator.manage','community_match.progress.record']::TEXT[])
    OR (purpose = 'community_moderation_resolution' AND cardinality(scopes) = 1 AND scopes <@ ARRAY['community_moderation.queue.read','community_moderation.case.read','community_moderation.case.resolve','community_moderation.case.reconcile']::TEXT[]));
INSERT INTO identity_schema_state(service, version, updated_at) VALUES ('identity-consent', 7, CURRENT_TIMESTAMP)
ON CONFLICT (service) DO UPDATE SET version = GREATEST(identity_schema_state.version, EXCLUDED.version), updated_at = EXCLUDED.updated_at;
