CREATE TABLE care_schema_compatibility (
  service TEXT PRIMARY KEY CHECK (service = 'care-coordination'),
  minimum_runtime_schema INTEGER NOT NULL,
  maximum_runtime_schema INTEGER NOT NULL,
  expanded_at TIMESTAMPTZ NOT NULL
);

INSERT INTO care_schema_compatibility
  (service, minimum_runtime_schema, maximum_runtime_schema, expanded_at)
VALUES ('care-coordination', 7, 8, CURRENT_TIMESTAMP);

UPDATE care_schema_state SET version=8, updated_at=CURRENT_TIMESTAMP
WHERE service='care-coordination' AND version=7;
