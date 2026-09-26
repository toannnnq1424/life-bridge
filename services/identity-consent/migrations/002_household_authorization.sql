CREATE TABLE IF NOT EXISTS identity_households (
  household_id TEXT PRIMARY KEY,
  display_label TEXT NOT NULL CHECK (char_length(display_label) BETWEEN 1 AND 80),
  status TEXT NOT NULL CHECK (status = 'active'),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_household_memberships (
  membership_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES identity_households(household_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES identity_accounts(account_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('organizer', 'caregiver', 'member')),
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'left')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (household_id, account_id)
);

CREATE INDEX IF NOT EXISTS identity_memberships_account
  ON identity_household_memberships(account_id, status, household_id);

CREATE TABLE IF NOT EXISTS identity_household_invitations (
  invitation_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES identity_households(household_id) ON DELETE CASCADE,
  invitee_account_id TEXT REFERENCES identity_accounts(account_id) ON DELETE CASCADE,
  invitee_dimension_digest TEXT NOT NULL,
  is_decoy BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT NOT NULL CHECK (role IN ('caregiver', 'member')),
  state TEXT NOT NULL CHECK (state IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  token_digest TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  resend_count INTEGER NOT NULL DEFAULT 0 CHECK (resend_count BETWEEN 0 AND 3),
  last_sent_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  terminal_at TIMESTAMPTZ,
  created_by_account_id TEXT NOT NULL REFERENCES identity_accounts(account_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (
    (is_decoy = TRUE AND invitee_account_id IS NULL)
    OR (is_decoy = FALSE AND invitee_account_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_one_pending_invitation
  ON identity_household_invitations(household_id, invitee_dimension_digest)
  WHERE state = 'pending';

CREATE TABLE IF NOT EXISTS identity_household_idempotency (
  account_id TEXT NOT NULL REFERENCES identity_accounts(account_id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  idempotency_key_digest TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (account_id, operation, idempotency_key_digest)
);

CREATE TABLE IF NOT EXISTS identity_care_recipient_contexts (
  recipient_context_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL UNIQUE REFERENCES identity_households(household_id) ON DELETE CASCADE,
  display_label TEXT NOT NULL CHECK (char_length(display_label) BETWEEN 1 AND 80),
  relationship_label TEXT NOT NULL CHECK (char_length(relationship_label) BETWEEN 1 AND 80),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE identity_audit
  ADD COLUMN IF NOT EXISTS household_id TEXT,
  ADD COLUMN IF NOT EXISTS target_type TEXT,
  ADD COLUMN IF NOT EXISTS target_id TEXT,
  ADD COLUMN IF NOT EXISTS reason_code TEXT;

CREATE INDEX IF NOT EXISTS identity_audit_household_time
  ON identity_audit(household_id, occurred_at DESC);
