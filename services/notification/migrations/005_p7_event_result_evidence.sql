ALTER TABLE notification_inbox DROP CONSTRAINT notification_inbox_result_check;
ALTER TABLE notification_inbox ADD CONSTRAINT notification_inbox_result_check CHECK (
  result IN ('stored','suppressed_self','reminder_scheduled','reminder_cancelled',
             'medication_reminder_scheduled','medication_reminder_cancelled',
             'out_of_order_rejected')
);
ALTER TABLE notification_inbox
  ADD COLUMN aggregate_id text,
  ADD COLUMN aggregate_version integer,
  ADD COLUMN payload_size integer NOT NULL DEFAULT 0 CHECK (payload_size BETWEEN 0 AND 65536);

CREATE TABLE notification_event_heads (
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  aggregate_version integer NOT NULL CHECK (aggregate_version > 0),
  source_event_id text NOT NULL REFERENCES notification_inbox(source_event_id),
  processed_at timestamptz NOT NULL,
  PRIMARY KEY (aggregate_id,event_type)
);

UPDATE notification_schema_compatibility
SET maximum_runtime_schema=5, expanded_at=CURRENT_TIMESTAMP
WHERE service='notification' AND maximum_runtime_schema=4;
UPDATE notification_schema_state SET version=5, updated_at=CURRENT_TIMESTAMP
WHERE service='notification' AND version=4;
