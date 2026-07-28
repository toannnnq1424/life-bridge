ALTER TABLE care_schema_state
  ADD COLUMN IF NOT EXISTS care_plan_coverage_started_at TIMESTAMPTZ
  DEFAULT CURRENT_TIMESTAMP;

UPDATE care_schema_state
SET care_plan_coverage_started_at = CURRENT_TIMESTAMP
WHERE service = 'care-coordination' AND care_plan_coverage_started_at IS NULL;

ALTER TABLE care_schema_state
  ALTER COLUMN care_plan_coverage_started_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN care_plan_coverage_started_at SET NOT NULL;

UPDATE care_schema_state
SET version = GREATEST(version, 4), updated_at = CURRENT_TIMESTAMP
WHERE service = 'care-coordination';

CREATE TABLE IF NOT EXISTS care_plans (
  plan_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  recipient_context_id TEXT NOT NULL,
  aggregate_revision INTEGER NOT NULL CHECK (aggregate_revision > 0),
  current_version INTEGER CHECK (current_version IS NULL OR current_version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (household_id, recipient_context_id)
);

CREATE TABLE IF NOT EXISTS care_plan_drafts (
  plan_id TEXT PRIMARY KEY REFERENCES care_plans(plan_id) ON DELETE RESTRICT,
  draft_revision INTEGER NOT NULL CHECK (draft_revision > 0),
  base_current_version INTEGER CHECK (base_current_version IS NULL OR base_current_version > 0),
  review_local_date DATE,
  review_time_zone TEXT,
  review_day_start_utc TIMESTAMPTZ,
  review_day_end_utc TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK ((review_local_date IS NULL) = (review_time_zone IS NULL)),
  CHECK ((review_day_start_utc IS NULL) = (review_day_end_utc IS NULL)),
  CHECK (review_day_end_utc IS NULL OR review_day_end_utc > review_day_start_utc)
);

CREATE TABLE IF NOT EXISTS care_plan_draft_items (
  plan_id TEXT NOT NULL REFERENCES care_plan_drafts(plan_id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('goal', 'preference', 'responsibility')),
  item_position INTEGER NOT NULL CHECK (item_position BETWEEN 0 AND 9),
  category TEXT NOT NULL,
  statement TEXT NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 160),
  actor_ref TEXT,
  PRIMARY KEY (plan_id, item_type, item_position),
  CHECK ((item_type = 'responsibility') = (actor_ref IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS care_plan_versions (
  plan_id TEXT NOT NULL REFERENCES care_plans(plan_id) ON DELETE RESTRICT,
  plan_version INTEGER NOT NULL CHECK (plan_version > 0),
  change_groups TEXT[] NOT NULL CHECK (cardinality(change_groups) BETWEEN 1 AND 5),
  review_local_date DATE NOT NULL,
  review_time_zone TEXT NOT NULL,
  review_day_start_utc TIMESTAMPTZ NOT NULL,
  review_day_end_utc TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL,
  event_ref TEXT NOT NULL UNIQUE,
  PRIMARY KEY (plan_id, plan_version),
  CHECK (review_day_end_utc > review_day_start_utc)
);

CREATE TABLE IF NOT EXISTS care_plan_version_items (
  plan_id TEXT NOT NULL,
  plan_version INTEGER NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('goal', 'preference', 'responsibility')),
  item_position INTEGER NOT NULL CHECK (item_position BETWEEN 0 AND 9),
  category TEXT NOT NULL,
  statement TEXT NOT NULL CHECK (char_length(statement) BETWEEN 1 AND 160),
  actor_ref TEXT,
  PRIMARY KEY (plan_id, plan_version, item_type, item_position),
  FOREIGN KEY (plan_id, plan_version)
    REFERENCES care_plan_versions(plan_id, plan_version) ON DELETE RESTRICT,
  CHECK ((item_type = 'responsibility') = (actor_ref IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS care_plan_transitions (
  transition_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES care_plans(plan_id) ON DELETE RESTRICT,
  aggregate_revision INTEGER NOT NULL CHECK (aggregate_revision > 0),
  action TEXT NOT NULL CHECK (action IN ('draft_saved', 'version_confirmed')),
  actor_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  UNIQUE (plan_id, aggregate_revision)
);

CREATE INDEX IF NOT EXISTS care_plan_history_order
  ON care_plan_versions(plan_id, plan_version DESC);
