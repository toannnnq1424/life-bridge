CREATE TABLE IF NOT EXISTS identity_accounts (
  account_id TEXT PRIMARY KEY,
  login_name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_factor', 'active', 'disabled')),
  authentication_version INTEGER NOT NULL DEFAULT 1 CHECK (authentication_version > 0),
  failed_password_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_password_attempts >= 0),
  locked_until TIMESTAMPTZ,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  role_intent TEXT CHECK (role_intent IN ('coordinate', 'participate') OR role_intent IS NULL),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_authenticators (
  authenticator_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES identity_accounts(account_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type = 'totp'),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  encrypted_secret TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  last_accepted_step BIGINT,
  created_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_one_active_totp
  ON identity_authenticators(account_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS identity_recovery_codes (
  recovery_code_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES identity_accounts(account_id) ON DELETE CASCADE,
  code_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE (account_id, code_digest)
);

CREATE TABLE IF NOT EXISTS identity_challenges (
  challenge_id TEXT PRIMARY KEY,
  token_digest TEXT NOT NULL UNIQUE,
  account_id TEXT REFERENCES identity_accounts(account_id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN (
    'registration_factor', 'registration_recovery_ack',
    'signin_factor', 'factor_recovery_confirm'
  )),
  is_decoy BOOLEAN NOT NULL DEFAULT FALSE,
  encrypted_artifact TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_sessions (
  session_id TEXT PRIMARY KEY,
  session_family_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES identity_accounts(account_id) ON DELETE CASCADE,
  token_digest TEXT NOT NULL UNIQUE,
  csrf_digest TEXT NOT NULL,
  authentication_version INTEGER NOT NULL,
  authenticated_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  idle_expires_at TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
);

CREATE INDEX IF NOT EXISTS identity_sessions_account
  ON identity_sessions(account_id, revoked_at);

CREATE TABLE IF NOT EXISTS identity_rate_limits (
  operation TEXT NOT NULL,
  dimension_digest TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count > 0),
  PRIMARY KEY (operation, dimension_digest, window_started_at)
);

CREATE TABLE IF NOT EXISTS identity_preferences (
  account_id TEXT PRIMARY KEY REFERENCES identity_accounts(account_id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('vi-VN', 'en')),
  text_scale TEXT NOT NULL CHECK (text_scale IN ('default', 'large')),
  contrast TEXT NOT NULL CHECK (contrast IN ('system', 'more')),
  motion TEXT NOT NULL CHECK (motion IN ('system', 'reduce')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_audit (
  audit_id TEXT PRIMARY KEY,
  account_id TEXT REFERENCES identity_accounts(account_id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS identity_audit_account_time
  ON identity_audit(account_id, occurred_at DESC);
