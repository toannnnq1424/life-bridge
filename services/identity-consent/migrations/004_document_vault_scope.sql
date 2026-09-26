ALTER TABLE identity_consent_grants
  DROP CONSTRAINT IF EXISTS identity_consent_grants_scopes_check,
  DROP CONSTRAINT IF EXISTS identity_consent_grants_scopes_v4_check;

ALTER TABLE identity_consent_grants
  ADD CONSTRAINT identity_consent_grants_scopes_v4_check CHECK (
    cardinality(scopes) BETWEEN 1 AND 3
    AND scopes <@ ARRAY[
      'recipient_context.basic_label',
      'recipient_context.relationship_label',
      'document_vault.access'
    ]::TEXT[]
  );

ALTER TABLE identity_consent_transitions
  DROP CONSTRAINT IF EXISTS identity_consent_transitions_scopes_check,
  DROP CONSTRAINT IF EXISTS identity_consent_transitions_scopes_v4_check;

ALTER TABLE identity_consent_transitions
  ADD CONSTRAINT identity_consent_transitions_scopes_v4_check CHECK (
    cardinality(scopes) BETWEEN 0 AND 3
    AND scopes <@ ARRAY[
      'recipient_context.basic_label',
      'recipient_context.relationship_label',
      'document_vault.access'
    ]::TEXT[]
  );

INSERT INTO identity_schema_state(service, version, updated_at)
VALUES ('identity-consent', 4, CURRENT_TIMESTAMP)
ON CONFLICT (service)
DO UPDATE SET
  version = GREATEST(identity_schema_state.version, EXCLUDED.version),
  updated_at = EXCLUDED.updated_at;
