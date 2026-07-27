ALTER TABLE care_schema_state
  ADD COLUMN IF NOT EXISTS appointment_coverage_started_at TIMESTAMPTZ
  DEFAULT CURRENT_TIMESTAMP;

UPDATE care_schema_state
SET appointment_coverage_started_at = CURRENT_TIMESTAMP
WHERE service = 'care-coordination'
  AND appointment_coverage_started_at IS NULL;

ALTER TABLE care_schema_state
  ALTER COLUMN appointment_coverage_started_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN appointment_coverage_started_at SET NOT NULL;

UPDATE care_schema_state
SET version = GREATEST(version, 3),
    updated_at = CURRENT_TIMESTAMP
WHERE service = 'care-coordination';

CREATE TABLE IF NOT EXISTS care_appointments (
  appointment_id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  recipient_context_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (
    kind IN (
      'household_coordination',
      'transport',
      'community_support',
      'other_personal'
    )
  ),
  logistics TEXT NOT NULL CHECK (
    logistics IN ('unspecified', 'in_person', 'phone', 'online')
  ),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'cancelled')),
  last_change TEXT NOT NULL CHECK (
    last_change IN ('created', 'changed', 'cancelled')
  ),
  starts_at_utc TIMESTAMPTZ NOT NULL,
  ends_at_utc TIMESTAMPTZ NOT NULL,
  source_local_start TEXT NOT NULL,
  source_utc_offset TEXT NOT NULL,
  source_time_zone TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
  occurrence_number INTEGER NOT NULL CHECK (occurrence_number > 0),
  occurrence_count INTEGER NOT NULL CHECK (occurrence_count BETWEEN 1 AND 12),
  recurrence_frequency TEXT NOT NULL CHECK (
    recurrence_frequency IN ('none', 'weekly')
  ),
  recurrence_interval_weeks INTEGER CHECK (
    recurrence_interval_weeks IS NULL OR recurrence_interval_weeks BETWEEN 1 AND 4
  ),
  recurrence_final_local_date DATE NOT NULL,
  reminder_intent TEXT NOT NULL CHECK (
    reminder_intent IN ('not_requested', 'recorded', 'cancelled')
  ),
  reminder_lead_minutes INTEGER CHECK (
    reminder_lead_minutes IS NULL OR reminder_lead_minutes IN (15, 60, 1440)
  ),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  CHECK (ends_at_utc > starts_at_utc),
  CHECK (occurrence_number <= occurrence_count),
  CHECK (
    (status = 'scheduled' AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS care_appointments_series_occurrence
  ON care_appointments(series_id, occurrence_number);

CREATE INDEX IF NOT EXISTS care_appointments_calendar_order
  ON care_appointments(
    household_id,
    recipient_context_id,
    starts_at_utc,
    appointment_id
  );

CREATE INDEX IF NOT EXISTS care_appointments_conflict
  ON care_appointments(recipient_context_id, starts_at_utc, ends_at_utc)
  WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS care_appointment_transitions (
  transition_id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL
    REFERENCES care_appointments(appointment_id) ON DELETE RESTRICT,
  appointment_version INTEGER NOT NULL CHECK (appointment_version > 0),
  action TEXT NOT NULL CHECK (action IN ('created', 'changed', 'cancelled')),
  actor_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  UNIQUE(appointment_id, appointment_version)
);

CREATE INDEX IF NOT EXISTS care_appointment_transition_order
  ON care_appointment_transitions(appointment_id, occurred_at, transition_id);
