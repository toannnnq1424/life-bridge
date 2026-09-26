CREATE TABLE IF NOT EXISTS notification_schema_state (
  service TEXT PRIMARY KEY,
  version INTEGER NOT NULL CHECK (version > 0),
  medication_reminder_coverage_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO notification_schema_state (
  service, version, medication_reminder_coverage_started_at, updated_at
) VALUES ('notification', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (service) DO UPDATE
SET version = GREATEST(notification_schema_state.version, EXCLUDED.version),
    updated_at = CURRENT_TIMESTAMP;

ALTER TABLE notification_inbox
  DROP CONSTRAINT IF EXISTS notification_inbox_result_check;

ALTER TABLE notification_inbox
  ADD CONSTRAINT notification_inbox_result_check CHECK (
    result IN (
      'stored',
      'suppressed_self',
      'reminder_scheduled',
      'reminder_cancelled',
      'medication_reminder_scheduled',
      'medication_reminder_cancelled'
    )
  );

CREATE TABLE IF NOT EXISTS medication_reminder_intents (
  occurrence_id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  recipient_context_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL UNIQUE
    REFERENCES notification_inbox(source_event_id) ON DELETE RESTRICT,
  occurrence_version INTEGER NOT NULL CHECK (occurrence_version > 0),
  intent_state TEXT NOT NULL CHECK (intent_state IN ('pending','cancelled')),
  delivery_state TEXT NOT NULL CHECK (
    delivery_state IN ('pending','uncertain','delivered','failed','missed','cancelled')
  ),
  delivery_evidence TEXT NOT NULL CHECK (
    delivery_evidence IN ('none','in_app_persisted')
  ),
  scheduled_at_utc TIMESTAMPTZ,
  source_local_start TEXT,
  source_time_zone TEXT,
  source_utc_offset TEXT,
  message_key TEXT NOT NULL CHECK (
    message_key = 'notifications.medication_reminder.generic'
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 3),
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  missed_at TIMESTAMPTZ,
  last_failure_reason TEXT CHECK (
    last_failure_reason IS NULL
    OR last_failure_reason IN ('in_app_store_failed','integration_uncertain')
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  processed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (
    (intent_state = 'pending' AND scheduled_at_utc IS NOT NULL
      AND source_local_start IS NOT NULL AND source_time_zone IS NOT NULL
      AND source_utc_offset IS NOT NULL)
    OR intent_state = 'cancelled'
  ),
  CHECK (
    (delivery_state = 'delivered' AND delivery_evidence = 'in_app_persisted'
      AND delivered_at IS NOT NULL)
    OR (delivery_state <> 'delivered' AND delivery_evidence = 'none'
      AND delivered_at IS NULL)
  ),
  CHECK ((delivery_state = 'failed') = (failed_at IS NOT NULL)),
  CHECK ((delivery_state = 'missed') = (missed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS medication_reminder_intents_due
  ON medication_reminder_intents(delivery_state, scheduled_at_utc, occurrence_id)
  WHERE intent_state = 'pending' AND delivery_state IN ('pending','uncertain');

CREATE INDEX IF NOT EXISTS medication_reminder_intents_recipient
  ON medication_reminder_intents(
    household_id, recipient_context_id, recipient_id, scheduled_at_utc, occurrence_id
  );

CREATE TABLE IF NOT EXISTS medication_delivery_attempts (
  attempt_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL
    REFERENCES medication_reminder_intents(occurrence_id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 3),
  result TEXT NOT NULL CHECK (result IN ('delivered','failed','uncertain','missed')),
  reason_code TEXT CHECK (
    reason_code IS NULL
    OR reason_code IN ('in_app_persisted','in_app_store_failed','integration_uncertain','delivery_window_expired')
  ),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  UNIQUE(occurrence_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS medication_reminder_notifications (
  notification_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL UNIQUE
    REFERENCES medication_reminder_intents(occurrence_id) ON DELETE RESTRICT,
  recipient_id TEXT NOT NULL,
  message_key TEXT NOT NULL CHECK (
    message_key = 'notifications.medication_reminder.generic'
  ),
  delivered_at TIMESTAMPTZ NOT NULL,
  acknowledgement_state TEXT NOT NULL DEFAULT 'unacknowledged' CHECK (
    acknowledgement_state IN ('unacknowledged','seen')
  ),
  acknowledged_at TIMESTAMPTZ,
  acknowledgement_actor_id TEXT,
  CHECK (
    (acknowledgement_state = 'unacknowledged'
      AND acknowledged_at IS NULL AND acknowledgement_actor_id IS NULL)
    OR (acknowledgement_state = 'seen'
      AND acknowledged_at IS NOT NULL AND acknowledgement_actor_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS medication_notifications_recipient_order
  ON medication_reminder_notifications(recipient_id, delivered_at DESC, notification_id);

CREATE TABLE IF NOT EXISTS notification_idempotency (
  operation TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(operation, actor_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS notification_audit (
  audit_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type = 'medication_reminder_notification'),
  resource_id TEXT NOT NULL,
  resource_version INTEGER NOT NULL CHECK (resource_version > 0),
  result TEXT NOT NULL CHECK (result IN ('success','duplicate','denied','conflict')),
  reason_code TEXT,
  decision_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type = 'notification.medication_reminder.seen.v1'),
  event_version INTEGER NOT NULL CHECK (event_version = 1),
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  correlation_id TEXT NOT NULL,
  causation_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed')),
  UNIQUE(aggregate_id, aggregate_version, event_type)
);
