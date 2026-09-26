ALTER TABLE notification_inbox
  DROP CONSTRAINT IF EXISTS notification_inbox_result_check;

ALTER TABLE notification_inbox
  ADD CONSTRAINT notification_inbox_result_check CHECK (
    result IN (
      'stored',
      'suppressed_self',
      'reminder_scheduled',
      'reminder_cancelled'
    )
  );

CREATE TABLE IF NOT EXISTS appointment_reminder_intents (
  appointment_id TEXT PRIMARY KEY,
  source_event_id TEXT NOT NULL UNIQUE
    REFERENCES notification_inbox(source_event_id) ON DELETE RESTRICT,
  recipient_id TEXT NOT NULL,
  intent_state TEXT NOT NULL CHECK (
    intent_state IN ('scheduled', 'cancelled')
  ),
  remind_at_utc TIMESTAMPTZ,
  starts_at_utc TIMESTAMPTZ,
  message_key TEXT NOT NULL CHECK (
    message_key = 'notifications.appointment.reminder'
  ),
  processed_at TIMESTAMPTZ NOT NULL,
  CHECK (
    (
      intent_state = 'scheduled'
      AND remind_at_utc IS NOT NULL
      AND starts_at_utc IS NOT NULL
      AND remind_at_utc < starts_at_utc
    )
    OR
    (
      intent_state = 'cancelled'
      AND remind_at_utc IS NULL
      AND starts_at_utc IS NULL
    )
  )
);
