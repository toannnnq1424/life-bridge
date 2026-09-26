ALTER TABLE care_schema_state
  ADD COLUMN IF NOT EXISTS emergency_readiness_coverage_started_at TIMESTAMPTZ
  DEFAULT CURRENT_TIMESTAMP;

UPDATE care_schema_state
SET emergency_readiness_coverage_started_at = CURRENT_TIMESTAMP
WHERE service = 'care-coordination'
  AND emergency_readiness_coverage_started_at IS NULL;

ALTER TABLE care_schema_state
  ALTER COLUMN emergency_readiness_coverage_started_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN emergency_readiness_coverage_started_at SET NOT NULL;

UPDATE care_schema_state
SET version = GREATEST(version, 6), updated_at = CURRENT_TIMESTAMP
WHERE service = 'care-coordination';

CREATE TABLE IF NOT EXISTS care_emergency_readiness (
  readiness_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  recipient_context_id TEXT NOT NULL,
  aggregate_revision INTEGER NOT NULL CHECK (aggregate_revision >= 0),
  contact_list_revision INTEGER NOT NULL CHECK (contact_list_revision >= 0),
  current_plan_version INTEGER CHECK (current_plan_version IS NULL OR current_plan_version > 0),
  state TEXT NOT NULL CHECK (
    state IN ('no_plan','draft_only','reviewed','review_required')
  ),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_confirmed_at TIMESTAMPTZ NOT NULL,
  UNIQUE(household_id, recipient_context_id),
  CHECK (
    (state IN ('no_plan','draft_only') AND current_plan_version IS NULL)
    OR (state IN ('reviewed','review_required') AND current_plan_version IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS care_emergency_contacts (
  contact_id TEXT PRIMARY KEY,
  readiness_id TEXT NOT NULL
    REFERENCES care_emergency_readiness(readiness_id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10),
  display_label TEXT NOT NULL CHECK (
    char_length(display_label) BETWEEN 1 AND 60
    AND display_label !~ E'[\\n\\r]'
  ),
  dial_string TEXT NOT NULL CHECK (dial_string ~ E'^\\+?[0-9]{3,15}$'),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(readiness_id, position)
);

CREATE INDEX IF NOT EXISTS care_emergency_contacts_order
  ON care_emergency_contacts(readiness_id, position, contact_id);

CREATE TABLE IF NOT EXISTS care_emergency_contact_transitions (
  transition_id TEXT PRIMARY KEY,
  readiness_id TEXT NOT NULL
    REFERENCES care_emergency_readiness(readiness_id) ON DELETE RESTRICT,
  contact_list_revision INTEGER NOT NULL CHECK (contact_list_revision > 0),
  action TEXT NOT NULL CHECK (action = 'replaced'),
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  UNIQUE(readiness_id, contact_list_revision)
);

CREATE TABLE IF NOT EXISTS care_emergency_plan_drafts (
  readiness_id TEXT PRIMARY KEY
    REFERENCES care_emergency_readiness(readiness_id) ON DELETE CASCADE,
  draft_revision INTEGER NOT NULL CHECK (draft_revision > 0),
  base_plan_version INTEGER NOT NULL CHECK (base_plan_version >= 0),
  contact_list_revision INTEGER NOT NULL CHECK (contact_list_revision >= 0),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS care_emergency_plan_draft_steps (
  readiness_id TEXT NOT NULL
    REFERENCES care_emergency_plan_drafts(readiness_id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 8),
  step_text TEXT NOT NULL CHECK (
    char_length(step_text) BETWEEN 1 AND 160
    AND step_text !~ E'[\\n\\r]'
  ),
  PRIMARY KEY(readiness_id, position)
);

CREATE TABLE IF NOT EXISTS care_emergency_plan_versions (
  readiness_id TEXT NOT NULL
    REFERENCES care_emergency_readiness(readiness_id) ON DELETE RESTRICT,
  plan_version INTEGER NOT NULL CHECK (plan_version > 0),
  contact_list_revision INTEGER NOT NULL CHECK (contact_list_revision > 0),
  reviewed_at TIMESTAMPTZ NOT NULL,
  display_time_zone TEXT NOT NULL,
  display_local_time TEXT NOT NULL,
  display_utc_offset TEXT NOT NULL CHECK (
    display_utc_offset ~ E'^[+-](0[0-9]|1[0-4]):[0-5][0-9]$'
  ),
  event_ref TEXT NOT NULL,
  PRIMARY KEY(readiness_id, plan_version)
);

CREATE TABLE IF NOT EXISTS care_emergency_plan_version_steps (
  readiness_id TEXT NOT NULL,
  plan_version INTEGER NOT NULL,
  position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 8),
  step_text TEXT NOT NULL CHECK (
    char_length(step_text) BETWEEN 1 AND 160
    AND step_text !~ E'[\\n\\r]'
  ),
  PRIMARY KEY(readiness_id, plan_version, position),
  FOREIGN KEY(readiness_id, plan_version)
    REFERENCES care_emergency_plan_versions(readiness_id, plan_version)
    ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS care_emergency_plan_transitions (
  transition_id TEXT PRIMARY KEY,
  readiness_id TEXT NOT NULL
    REFERENCES care_emergency_readiness(readiness_id) ON DELETE RESTRICT,
  aggregate_revision INTEGER NOT NULL CHECK (aggregate_revision > 0),
  plan_version INTEGER CHECK (plan_version IS NULL OR plan_version > 0),
  action TEXT NOT NULL CHECK (action IN ('draft_saved','version_reviewed')),
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  UNIQUE(readiness_id, aggregate_revision)
);

CREATE INDEX IF NOT EXISTS care_emergency_plan_history
  ON care_emergency_plan_versions(readiness_id, plan_version DESC);
