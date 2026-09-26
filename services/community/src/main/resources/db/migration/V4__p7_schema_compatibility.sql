ALTER TABLE community_schema_state DROP CONSTRAINT community_schema_state_version_supported;
ALTER TABLE community_schema_state
  ADD CONSTRAINT community_schema_state_version_supported CHECK (version <= 4);

CREATE TABLE community_schema_compatibility (
  service TEXT PRIMARY KEY CHECK (service = 'community'),
  minimum_runtime_schema INTEGER NOT NULL,
  maximum_runtime_schema INTEGER NOT NULL,
  expanded_at TIMESTAMPTZ NOT NULL
);

INSERT INTO community_schema_compatibility
  (service, minimum_runtime_schema, maximum_runtime_schema, expanded_at)
VALUES ('community', 3, 4, CURRENT_TIMESTAMP);

UPDATE community_schema_state SET version=4, updated_at=CURRENT_TIMESTAMP
WHERE service='community' AND version=3;
