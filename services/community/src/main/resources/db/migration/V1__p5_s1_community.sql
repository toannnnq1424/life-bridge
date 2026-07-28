CREATE TABLE community_schema_state (
  service TEXT PRIMARY KEY CHECK (service = 'community'),
  version INTEGER NOT NULL CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE community_directory_listings (
  listing_id TEXT PRIMARY KEY,
  public_name TEXT NOT NULL CHECK (char_length(public_name) BETWEEN 1 AND 120),
  organization_type TEXT NOT NULL
    CHECK (organization_type IN ('public_service', 'nonprofit', 'community_group')),
  province_city_code TEXT NOT NULL CHECK (province_city_code ~ '^[A-Z0-9-]{3,32}$'),
  province_city_label TEXT NOT NULL CHECK (char_length(province_city_label) BETWEEN 1 AND 120),
  categories TEXT[] NOT NULL CHECK (cardinality(categories) BETWEEN 1 AND 6),
  contact_type TEXT NOT NULL CHECK (contact_type IN ('phone', 'website', 'in_person')),
  contact_label TEXT NOT NULL CHECK (char_length(contact_label) BETWEEN 1 AND 80),
  contact_value TEXT NOT NULL CHECK (char_length(contact_value) BETWEEN 1 AND 200),
  accessibility_contact_note TEXT
    CHECK (accessibility_contact_note IS NULL
      OR accessibility_contact_note = 'contact_for_accessibility_details'),
  source_label TEXT NOT NULL CHECK (char_length(source_label) BETWEEN 1 AND 120),
  source_url TEXT NOT NULL CHECK (char_length(source_url) BETWEEN 1 AND 500),
  last_reviewed_at TIMESTAMPTZ NOT NULL,
  next_review_at TIMESTAMPTZ NOT NULL,
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX community_directory_structured_search_idx
  ON community_directory_listings(province_city_code, organization_type, public_name, listing_id);
CREATE INDEX community_directory_categories_idx
  ON community_directory_listings USING GIN(categories);

CREATE TABLE community_help_requests (
  request_id TEXT PRIMARY KEY,
  submission_reference TEXT NOT NULL CHECK (
    char_length(submission_reference) BETWEEN 12 AND 128
    AND submission_reference ~ '^[A-Za-z0-9_-]+$'
  ),
  actor_ref_digest TEXT NOT NULL CHECK (actor_ref_digest ~ '^[a-f0-9]{64}$'),
  household_id TEXT NOT NULL,
  recipient_context_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'daily_living_support',
    'transport_coordination',
    'household_errand',
    'social_connection',
    'digital_access',
    'accessibility_support'
  )),
  location_granularity TEXT NOT NULL CHECK (location_granularity = 'province_city'),
  province_city_code TEXT NOT NULL CHECK (province_city_code ~ '^[A-Z0-9-]{3,32}$'),
  day_part TEXT CHECK (day_part IS NULL OR day_part IN (
    'flexible', 'morning', 'afternoon', 'evening'
  )),
  visibility TEXT NOT NULL CHECK (visibility = 'current_request_collaborators'),
  status TEXT NOT NULL CHECK (status IN ('pending', 'closed')),
  version INTEGER NOT NULL CHECK (version > 0),
  confirmed_at TIMESTAMPTZ NOT NULL,
  pending_auto_close_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  purge_after TIMESTAMPTZ,
  UNIQUE(actor_ref_digest, submission_reference)
);
CREATE UNIQUE INDEX community_help_request_pending_tuple_idx
  ON community_help_requests(
    recipient_context_id, category, province_city_code, COALESCE(day_part, '')
  ) WHERE status = 'pending';
CREATE INDEX community_help_request_actor_read_idx
  ON community_help_requests(household_id, recipient_context_id, confirmed_at DESC, request_id);

CREATE TABLE community_idempotency (
  key_digest TEXT NOT NULL CHECK (key_digest ~ '^[a-f0-9]{64}$'),
  actor_ref_digest TEXT NOT NULL CHECK (actor_ref_digest ~ '^[a-f0-9]{64}$'),
  operation TEXT NOT NULL CHECK (operation IN ('submit', 'close', 'delete')),
  route_digest TEXT NOT NULL CHECK (route_digest ~ '^[a-f0-9]{64}$'),
  aggregate_ref_digest TEXT NOT NULL CHECK (aggregate_ref_digest ~ '^[a-f0-9]{64}$'),
  intent_digest TEXT NOT NULL CHECK (intent_digest ~ '^[a-f0-9]{64}$'),
  response_status INTEGER NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(key_digest, actor_ref_digest, operation, route_digest)
);
CREATE INDEX community_idempotency_aggregate_idx
  ON community_idempotency(aggregate_ref_digest);

CREATE TABLE community_request_tombstones (
  tombstone_id TEXT PRIMARY KEY,
  request_digest TEXT NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  actor_ref_digest TEXT NOT NULL CHECK (actor_ref_digest ~ '^[a-f0-9]{64}$'),
  submission_reference_digest TEXT NOT NULL
    CHECK (submission_reference_digest ~ '^[a-f0-9]{64}$'),
  deleted_at TIMESTAMPTZ NOT NULL,
  retain_until TIMESTAMPTZ NOT NULL
);

CREATE TABLE community_audit (
  audit_id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN (
    'help_request.submitted',
    'help_request.closed',
    'help_request.auto_closed',
    'help_request.deleted',
    'help_request.retention_purged'
  )),
  outcome TEXT NOT NULL CHECK (outcome IN ('confirmed', 'purged')),
  actor_ref_digest TEXT NOT NULL CHECK (actor_ref_digest ~ '^[a-f0-9]{64}$'),
  aggregate_ref_digest TEXT NOT NULL CHECK (aggregate_ref_digest ~ '^[a-f0-9]{64}$'),
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  correlation_id TEXT NOT NULL CHECK (
    char_length(correlation_id) BETWEEN 8 AND 128
    AND correlation_id ~ '^[A-Za-z0-9_-]+$'
  ),
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE community_outbox (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'community.help_request.submitted.v1',
    'community.help_request.closed.v1',
    'community.help_request.deleted.v1'
  )),
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  lifecycle_outcome TEXT NOT NULL CHECK (lifecycle_outcome IN ('pending', 'closed', 'deleted')),
  delivery_state TEXT NOT NULL CHECK (delivery_state = 'suppressed_not_configured'),
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT NOT NULL,
  UNIQUE(aggregate_id, aggregate_version)
);

INSERT INTO community_schema_state(service, version, updated_at)
VALUES ('community', 1, CURRENT_TIMESTAMP);
