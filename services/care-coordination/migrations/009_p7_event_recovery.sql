ALTER TABLE care_outbox DROP CONSTRAINT care_outbox_status_check;
UPDATE care_outbox SET status = 'attention_required' WHERE status = 'failed';
ALTER TABLE care_outbox ADD CONSTRAINT care_outbox_status_check CHECK (
  status IN ('pending', 'retrying', 'attention_required', 'delivered', 'suppressed')
);

ALTER TABLE care_outbox
  ADD COLUMN claim_token text,
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  ADD COLUMN first_failed_at timestamptz,
  ADD COLUMN last_failed_at timestamptz,
  ADD COLUMN terminal_at timestamptz;

CREATE TABLE care_delivery_attempts (
  event_id text NOT NULL REFERENCES care_outbox(event_id),
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  claim_token text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  result text CHECK (result IN ('acknowledged', 'retryable_failure', 'terminal_failure', 'lease_lost')),
  error_code text,
  PRIMARY KEY (event_id, attempt_number),
  UNIQUE (claim_token)
);

CREATE TABLE care_event_recovery_audit (
  recovery_id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES care_outbox(event_id),
  operator_id text NOT NULL,
  reason_code text NOT NULL,
  dry_run boolean NOT NULL,
  before_state text NOT NULL,
  after_state text NOT NULL,
  result text NOT NULL CHECK (result IN ('previewed', 'requeued', 'rejected', 'no_change')),
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL
);

UPDATE care_schema_compatibility
SET maximum_runtime_schema=9, expanded_at=CURRENT_TIMESTAMP
WHERE service='care-coordination' AND maximum_runtime_schema=8;
UPDATE care_schema_state SET version=9, updated_at=CURRENT_TIMESTAMP
WHERE service='care-coordination' AND version=8;
