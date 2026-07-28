ALTER TABLE care_schema_state
  ADD COLUMN IF NOT EXISTS medication_reminder_coverage_started_at TIMESTAMPTZ
  DEFAULT CURRENT_TIMESTAMP;

UPDATE care_schema_state
SET medication_reminder_coverage_started_at = CURRENT_TIMESTAMP
WHERE service = 'care-coordination'
  AND medication_reminder_coverage_started_at IS NULL;

ALTER TABLE care_schema_state
  ALTER COLUMN medication_reminder_coverage_started_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN medication_reminder_coverage_started_at SET NOT NULL;

UPDATE care_schema_state
SET version = GREATEST(version, 5), updated_at = CURRENT_TIMESTAMP
WHERE service = 'care-coordination';

CREATE TABLE IF NOT EXISTS care_medication_reminders (
  reminder_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  recipient_context_id TEXT NOT NULL,
  notification_recipient_id TEXT NOT NULL,
  medication_label TEXT NOT NULL CHECK (
    char_length(medication_label) BETWEEN 1 AND 80
    AND medication_label !~ E'[\\n\\r]'
  ),
  amount TEXT NOT NULL CHECK (
    amount ~ E'^(0\\.(00[1-9]|0[1-9][0-9]|[1-9][0-9]{0,2})|[1-9][0-9]{0,2}(\\.[0-9]{1,3})?)$'
  ),
  unit TEXT NOT NULL CHECK (
    unit IN ('tablet','capsule','millilitre','drop','puff','patch','application','unit','other')
  ),
  other_unit_label TEXT CHECK (
    other_unit_label IS NULL
    OR (char_length(other_unit_label) BETWEEN 1 AND 24 AND other_unit_label !~ E'[\\n\\r]')
  ),
  source_local_start TEXT NOT NULL,
  source_time_zone TEXT NOT NULL,
  source_utc_offset TEXT NOT NULL,
  ambiguous_time_policy TEXT CHECK (
    ambiguous_time_policy IS NULL OR ambiguous_time_policy IN ('earlier','later')
  ),
  recurrence_frequency TEXT NOT NULL CHECK (
    recurrence_frequency IN ('none','daily','weekly')
  ),
  recurrence_interval INTEGER CHECK (
    recurrence_interval IS NULL OR recurrence_interval BETWEEN 1 AND 7
  ),
  occurrence_count INTEGER NOT NULL CHECK (occurrence_count BETWEEN 1 AND 31),
  recurrence_final_local_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','disabled')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  disabled_at TIMESTAMPTZ,
  CHECK (
    (unit = 'other' AND other_unit_label IS NOT NULL)
    OR (unit <> 'other' AND other_unit_label IS NULL)
  ),
  CHECK (
    (recurrence_frequency = 'none' AND recurrence_interval IS NULL AND occurrence_count = 1)
    OR (recurrence_frequency = 'daily' AND recurrence_interval BETWEEN 1 AND 7 AND occurrence_count BETWEEN 2 AND 31)
    OR (recurrence_frequency = 'weekly' AND recurrence_interval BETWEEN 1 AND 4 AND occurrence_count BETWEEN 2 AND 12)
  ),
  CHECK (
    (status = 'active' AND disabled_at IS NULL)
    OR (status = 'disabled' AND disabled_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS care_medication_reminders_scope_order
  ON care_medication_reminders(household_id, recipient_context_id, created_at, reminder_id);

CREATE TABLE IF NOT EXISTS care_medication_reminder_occurrences (
  occurrence_id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL
    REFERENCES care_medication_reminders(reminder_id) ON DELETE RESTRICT,
  schedule_version INTEGER NOT NULL CHECK (schedule_version > 0),
  occurrence_number INTEGER NOT NULL CHECK (occurrence_number > 0),
  occurrence_count INTEGER NOT NULL CHECK (occurrence_count BETWEEN 1 AND 31),
  source_local_start TEXT NOT NULL,
  source_time_zone TEXT NOT NULL,
  source_utc_offset TEXT NOT NULL,
  scheduled_at_utc TIMESTAMPTZ NOT NULL,
  recurrence_final_local_date DATE NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('current','superseded','disabled')),
  notification_intent TEXT NOT NULL CHECK (notification_intent IN ('recorded','cancelled')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (occurrence_number <= occurrence_count),
  UNIQUE(reminder_id, schedule_version, occurrence_number)
);

CREATE INDEX IF NOT EXISTS care_medication_occurrences_current
  ON care_medication_reminder_occurrences(reminder_id, scheduled_at_utc, occurrence_id)
  WHERE state = 'current';

CREATE TABLE IF NOT EXISTS care_medication_reminder_transitions (
  transition_id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL
    REFERENCES care_medication_reminders(reminder_id) ON DELETE RESTRICT,
  reminder_version INTEGER NOT NULL CHECK (reminder_version > 0),
  action TEXT NOT NULL CHECK (action IN ('created','changed','disabled')),
  actor_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  UNIQUE(reminder_id, reminder_version)
);

CREATE INDEX IF NOT EXISTS care_medication_transition_order
  ON care_medication_reminder_transitions(reminder_id, occurred_at, transition_id);
