CREATE TABLE IF NOT EXISTS care_schema_state (
  service TEXT PRIMARY KEY,
  version INTEGER NOT NULL CHECK (version > 0),
  coverage_started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

INSERT INTO care_schema_state(service, version, coverage_started_at, updated_at)
VALUES (
  'care-coordination',
  2,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (service)
DO UPDATE SET
  version = GREATEST(care_schema_state.version, EXCLUDED.version),
  updated_at = EXCLUDED.updated_at;

CREATE TABLE IF NOT EXISTS care_timeline_events (
  timeline_sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  event_ref TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  recipient_context_id TEXT NOT NULL,
  task_id TEXT NOT NULL
    REFERENCES care_tasks(task_id) ON DELETE RESTRICT,
  task_version INTEGER NOT NULL CHECK (task_version > 0),
  event_kind TEXT NOT NULL CHECK (
    event_kind IN ('task_created', 'task_completed', 'task_handoff')
  ),
  actor_id TEXT,
  actor_ref TEXT,
  from_actor_id TEXT,
  from_actor_ref TEXT,
  to_actor_id TEXT,
  to_actor_ref TEXT,
  reason_code TEXT CHECK (
    reason_code IS NULL OR reason_code IN (
      'availability_changed',
      'schedule_conflict',
      'coverage_update',
      'other_coordination'
    )
  ),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  CHECK (
    (
      event_kind IN ('task_created', 'task_completed')
      AND actor_id IS NOT NULL
      AND actor_ref IS NOT NULL
      AND from_actor_id IS NULL
      AND from_actor_ref IS NULL
      AND to_actor_id IS NULL
      AND to_actor_ref IS NULL
      AND reason_code IS NULL
    )
    OR
    (
      event_kind = 'task_handoff'
      AND actor_id IS NULL
      AND actor_ref IS NULL
      AND from_actor_id IS NOT NULL
      AND from_actor_ref IS NOT NULL
      AND to_actor_id IS NOT NULL
      AND to_actor_ref IS NOT NULL
      AND from_actor_id <> to_actor_id
      AND from_actor_ref <> to_actor_ref
      AND reason_code IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS care_timeline_task_version_kind
  ON care_timeline_events(task_id, task_version, event_kind);

CREATE INDEX IF NOT EXISTS care_timeline_household_chronology
  ON care_timeline_events(
    household_id,
    recipient_context_id,
    occurred_at,
    event_ref
  );

CREATE INDEX IF NOT EXISTS care_timeline_snapshot
  ON care_timeline_events(household_id, timeline_sequence);

CREATE TABLE IF NOT EXISTS care_task_handoffs (
  handoff_id TEXT PRIMARY KEY,
  event_ref TEXT NOT NULL UNIQUE
    REFERENCES care_timeline_events(event_ref) ON DELETE RESTRICT,
  household_id TEXT NOT NULL,
  recipient_context_id TEXT NOT NULL,
  task_id TEXT NOT NULL
    REFERENCES care_tasks(task_id) ON DELETE RESTRICT,
  task_version INTEGER NOT NULL CHECK (task_version > 0),
  from_actor_id TEXT NOT NULL,
  from_actor_ref TEXT NOT NULL,
  to_actor_id TEXT NOT NULL,
  to_actor_ref TEXT NOT NULL,
  reason_code TEXT NOT NULL CHECK (
    reason_code IN (
      'availability_changed',
      'schedule_conflict',
      'coverage_update',
      'other_coordination'
    )
  ),
  outcome TEXT NOT NULL CHECK (outcome = 'accepted'),
  occurred_at TIMESTAMPTZ NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  CHECK (
    from_actor_id <> to_actor_id
    AND from_actor_ref <> to_actor_ref
    AND effective_at = occurred_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS care_handoff_task_version
  ON care_task_handoffs(task_id, task_version);

CREATE INDEX IF NOT EXISTS care_handoff_retention
  ON care_task_handoffs(occurred_at, handoff_id);
