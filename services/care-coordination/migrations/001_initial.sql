CREATE TABLE IF NOT EXISTS care_tasks (
  task_id text PRIMARY KEY,
  household_id text NOT NULL,
  care_recipient_id text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text NOT NULL CHECK (char_length(description) <= 500),
  assignee_id text NOT NULL,
  created_by text NOT NULL,
  due_at timestamptz NOT NULL,
  due_time_zone text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('normal', 'important', 'urgent')),
  status text NOT NULL CHECK (status IN ('open', 'completed')),
  version integer NOT NULL CHECK (version > 0),
  created_at timestamptz NOT NULL,
  completed_by text,
  completed_at timestamptz,
  CHECK (
    (status = 'open' AND completed_by IS NULL AND completed_at IS NULL)
    OR
    (status = 'completed' AND completed_by IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS care_tasks_household_order_idx
  ON care_tasks (household_id, due_at, priority, created_at, task_id);

CREATE TABLE IF NOT EXISTS care_outbox (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  event_version integer NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_version integer NOT NULL,
  correlation_id text NOT NULL,
  causation_id text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL CHECK (
    status IN ('pending', 'retrying', 'failed', 'delivered', 'suppressed')
  ),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL,
  delivered_at timestamptz,
  last_error_code text
);

CREATE UNIQUE INDEX IF NOT EXISTS care_outbox_task_completion_idx
  ON care_outbox (aggregate_id, aggregate_version, event_type);

CREATE INDEX IF NOT EXISTS care_outbox_dispatch_idx
  ON care_outbox (status, next_attempt_at, occurred_at);

CREATE TABLE IF NOT EXISTS care_audit (
  audit_id text PRIMARY KEY,
  actor_id text NOT NULL,
  household_id text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  result text NOT NULL,
  occurred_at timestamptz NOT NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS care_idempotency (
  operation text NOT NULL,
  actor_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (operation, actor_id, idempotency_key)
);
