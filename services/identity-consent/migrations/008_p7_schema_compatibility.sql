CREATE TABLE identity_schema_compatibility (
  service TEXT PRIMARY KEY CHECK (service = 'identity-consent'),
  minimum_runtime_schema INTEGER NOT NULL,
  maximum_runtime_schema INTEGER NOT NULL,
  expanded_at TIMESTAMPTZ NOT NULL
);

INSERT INTO identity_schema_compatibility
  (service, minimum_runtime_schema, maximum_runtime_schema, expanded_at)
VALUES ('identity-consent', 7, 8, CURRENT_TIMESTAMP);

UPDATE identity_schema_state SET version=8, updated_at=CURRENT_TIMESTAMP
WHERE service='identity-consent' AND version=7;
