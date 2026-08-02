CREATE TABLE notification_schema_compatibility (
  service TEXT PRIMARY KEY CHECK (service = 'notification'),
  minimum_runtime_schema INTEGER NOT NULL,
  maximum_runtime_schema INTEGER NOT NULL,
  expanded_at TIMESTAMPTZ NOT NULL
);

INSERT INTO notification_schema_compatibility
  (service, minimum_runtime_schema, maximum_runtime_schema, expanded_at)
VALUES ('notification', 3, 4, CURRENT_TIMESTAMP);

UPDATE notification_schema_state SET version=4, updated_at=CURRENT_TIMESTAMP
WHERE service='notification' AND version=3;
