ALTER TABLE identity_care_recipient_contexts
  ADD COLUMN IF NOT EXISTS created_by_account_id TEXT
    REFERENCES identity_accounts(account_id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS identity_consent_subjects (
  subject_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL UNIQUE
    REFERENCES identity_households(household_id) ON DELETE RESTRICT,
  recipient_context_id TEXT NOT NULL UNIQUE
    REFERENCES identity_care_recipient_contexts(recipient_context_id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL
    REFERENCES identity_accounts(account_id) ON DELETE RESTRICT,
  authority TEXT NOT NULL CHECK (authority = 'self'),
  version INTEGER NOT NULL CHECK (version > 0),
  established_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_consent_subject_account_household
  ON identity_consent_subjects(account_id, household_id);

CREATE TABLE IF NOT EXISTS identity_consent_grants (
  grant_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL
    REFERENCES identity_consent_subjects(subject_id) ON DELETE RESTRICT,
  grantee_account_id TEXT NOT NULL
    REFERENCES identity_accounts(account_id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (purpose = 'household_coordination'),
  scopes TEXT[] NOT NULL CHECK (
    cardinality(scopes) BETWEEN 1 AND 2
    AND scopes <@ ARRAY[
      'recipient_context.basic_label',
      'recipient_context.relationship_label'
    ]::TEXT[]
  ),
  state TEXT NOT NULL CHECK (state IN ('active', 'revoked')),
  effective_at TIMESTAMPTZ NOT NULL,
  revoked_effective_at TIMESTAMPTZ,
  display_time_zone TEXT NOT NULL CHECK (char_length(display_time_zone) BETWEEN 1 AND 80),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (
    (state = 'active' AND revoked_effective_at IS NULL)
    OR (state = 'revoked' AND revoked_effective_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_one_active_consent_grant
  ON identity_consent_grants(subject_id, grantee_account_id, purpose)
  WHERE state = 'active';

CREATE INDEX IF NOT EXISTS identity_consent_grant_authorization
  ON identity_consent_grants(subject_id, grantee_account_id, state, effective_at);

CREATE TABLE IF NOT EXISTS identity_consent_transitions (
  transition_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL
    REFERENCES identity_consent_subjects(subject_id) ON DELETE RESTRICT,
  grant_id TEXT NOT NULL
    REFERENCES identity_consent_grants(grant_id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('grant', 'narrow', 'revoke')),
  purpose TEXT NOT NULL CHECK (purpose = 'household_coordination'),
  scopes TEXT[] NOT NULL CHECK (
    cardinality(scopes) BETWEEN 0 AND 2
    AND scopes <@ ARRAY[
      'recipient_context.basic_label',
      'recipient_context.relationship_label'
    ]::TEXT[]
  ),
  subject_version INTEGER NOT NULL CHECK (subject_version > 0),
  grant_version INTEGER NOT NULL CHECK (grant_version > 0),
  effective_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS identity_consent_transition_history
  ON identity_consent_transitions(subject_id, occurred_at DESC, transition_id DESC);

CREATE TABLE IF NOT EXISTS identity_consent_idempotency (
  subject_id TEXT NOT NULL
    REFERENCES identity_consent_subjects(subject_id) ON DELETE RESTRICT,
  operation TEXT NOT NULL CHECK (
    operation IN ('consent.grant', 'consent.narrow', 'consent.revoke')
  ),
  idempotency_key_digest TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (subject_id, operation, idempotency_key_digest)
);

CREATE TABLE IF NOT EXISTS identity_consent_outbox (
  event_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL
    REFERENCES identity_consent_subjects(subject_id) ON DELETE RESTRICT,
  grant_id TEXT NOT NULL
    REFERENCES identity_consent_grants(grant_id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'identity.consent.granted.v1',
      'identity.consent.narrowed.v1',
      'identity.consent.revoked.v1'
    )
  ),
  event_version INTEGER NOT NULL CHECK (event_version = 1),
  event_json JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS identity_consent_outbox_pending
  ON identity_consent_outbox(occurred_at, event_id)
  WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS identity_consent_audit (
  audit_id TEXT PRIMARY KEY,
  subject_id TEXT
    REFERENCES identity_consent_subjects(subject_id) ON DELETE RESTRICT,
  actor_account_id TEXT
    REFERENCES identity_accounts(account_id) ON DELETE RESTRICT,
  grant_id TEXT
    REFERENCES identity_consent_grants(grant_id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (
    category IN (
      'consent.subject_established',
      'consent.granted',
      'consent.narrowed',
      'consent.revoked',
      'recipient_context.access_allowed',
      'recipient_context.access_denied',
      'privacy.confirmed'
    )
  ),
  outcome TEXT NOT NULL CHECK (outcome IN ('confirmed', 'allowed', 'denied')),
  redaction TEXT NOT NULL CHECK (redaction = 'protected'),
  correlation_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS identity_consent_audit_history
  ON identity_consent_audit(subject_id, occurred_at DESC, audit_id DESC);

CREATE TABLE IF NOT EXISTS identity_privacy_preferences (
  account_id TEXT PRIMARY KEY
    REFERENCES identity_accounts(account_id) ON DELETE RESTRICT,
  profile_visibility TEXT NOT NULL CHECK (
    profile_visibility IN ('private', 'household_only')
  ),
  coordination_activity_visibility TEXT NOT NULL CHECK (
    coordination_activity_visibility IN ('hidden', 'household_only')
  ),
  access_alerts BOOLEAN NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  confirmed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_schema_state (
  service TEXT PRIMARY KEY,
  version INTEGER NOT NULL CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL
);

INSERT INTO identity_schema_state(service, version, updated_at)
VALUES ('identity-consent', 3, CURRENT_TIMESTAMP)
ON CONFLICT (service)
DO UPDATE SET
  version = GREATEST(identity_schema_state.version, EXCLUDED.version),
  updated_at = EXCLUDED.updated_at;
