UPDATE care_schema_state
SET version = GREATEST(version, 7), updated_at = CURRENT_TIMESTAMP
WHERE service = 'care-coordination';

CREATE TABLE IF NOT EXISTS care_document_vaults (
  vault_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  recipient_context_id TEXT NOT NULL,
  vault_version INTEGER NOT NULL CHECK (vault_version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(household_id, recipient_context_id)
);

CREATE TABLE IF NOT EXISTS care_documents (
  document_id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL
    REFERENCES care_document_vaults(vault_id) ON DELETE RESTRICT,
  upload_reference TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK (
    char_length(display_name) BETWEEN 1 AND 120
    AND display_name !~ E'[\\n\\r]'
  ),
  verified_type TEXT NOT NULL CHECK (verified_type = 'text/plain'),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 262144),
  processing_state TEXT NOT NULL CHECK (
    processing_state IN (
      'processing','ready_unscanned','rejected','failed','integrity_failed'
    )
  ),
  scanner_status TEXT NOT NULL CHECK (scanner_status = 'not_configured'),
  malware_status TEXT NOT NULL CHECK (malware_status = 'not_scanned'),
  processing_evidence TEXT NOT NULL CHECK (
    processing_evidence = 'strict_text_and_integrity_validation'
  ),
  access_policy TEXT NOT NULL CHECK (
    access_policy = 'care_recipient_and_current_document_collaborators'
  ),
  retention_policy TEXT NOT NULL CHECK (
    retention_policy = 'retained_until_explicit_delete'
  ),
  version INTEGER NOT NULL CHECK (version > 0),
  uploaded_at TIMESTAMPTZ NOT NULL,
  processing_confirmed_at TIMESTAMPTZ,
  UNIQUE(vault_id, upload_reference)
);

CREATE INDEX IF NOT EXISTS care_document_vault_order
  ON care_documents(vault_id, uploaded_at DESC, document_id);

CREATE TABLE IF NOT EXISTS care_document_blobs (
  object_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL UNIQUE
    REFERENCES care_documents(document_id) ON DELETE CASCADE,
  vault_id TEXT NOT NULL
    REFERENCES care_document_vaults(vault_id) ON DELETE RESTRICT,
  household_id TEXT NOT NULL,
  recipient_context_id TEXT NOT NULL,
  document_version INTEGER NOT NULL CHECK (document_version > 0),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 262144),
  sha256_digest TEXT NOT NULL CHECK (sha256_digest ~ '^[a-f0-9]{64}$'),
  binding_digest TEXT NOT NULL CHECK (binding_digest ~ '^[a-f0-9]{64}$'),
  object_bytes BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS care_document_transitions (
  transition_id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL
    REFERENCES care_document_vaults(vault_id) ON DELETE RESTRICT,
  document_id TEXT NOT NULL,
  vault_version INTEGER NOT NULL CHECK (vault_version > 0),
  document_version INTEGER NOT NULL CHECK (document_version > 0),
  action TEXT NOT NULL CHECK (
    action IN ('upload_accepted','ready_unscanned','integrity_failed','removed')
  ),
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS care_document_tombstones (
  tombstone_id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL
    REFERENCES care_document_vaults(vault_id) ON DELETE RESTRICT,
  document_id_digest TEXT NOT NULL CHECK (document_id_digest ~ '^[a-f0-9]{64}$'),
  vault_version INTEGER NOT NULL CHECK (vault_version > 0),
  deleted_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL
);
