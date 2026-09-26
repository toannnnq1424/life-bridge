CREATE TABLE IF NOT EXISTS notification_inbox (
  source_event_id text PRIMARY KEY,
  payload_hash text NOT NULL,
  event_type text NOT NULL,
  event_version integer NOT NULL,
  result text NOT NULL CHECK (result IN ('stored', 'suppressed_self')),
  notification_id text,
  processed_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id text PRIMARY KEY,
  recipient_id text NOT NULL,
  source_event_id text NOT NULL UNIQUE,
  source_task_id text NOT NULL,
  message_key text NOT NULL,
  message_params jsonb NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  CONSTRAINT notifications_source_event_fk
    FOREIGN KEY (source_event_id)
    REFERENCES notification_inbox (source_event_id)
);

CREATE INDEX IF NOT EXISTS notifications_recipient_order_idx
  ON notifications (recipient_id, created_at DESC, notification_id);
