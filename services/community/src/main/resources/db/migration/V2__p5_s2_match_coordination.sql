ALTER TABLE community_schema_state
  ADD CONSTRAINT community_schema_state_version_supported CHECK (version <= 2);

CREATE TABLE community_organizations (
  organization_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  version INTEGER NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE community_organization_enrollments (
  enrollment_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES community_organizations(organization_id),
  actor_ref_digest TEXT NOT NULL CHECK (actor_ref_digest ~ '^[a-f0-9]{64}$'),
  role TEXT NOT NULL CHECK (role IN ('coordinator', 'volunteer')),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  version INTEGER NOT NULL CHECK (version > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (organization_id, actor_ref_digest, role)
);

CREATE TABLE community_matches (
  match_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES community_help_requests(request_id),
  organization_id TEXT NOT NULL REFERENCES community_organizations(organization_id),
  recipient_context_digest TEXT NOT NULL CHECK (recipient_context_digest ~ '^[a-f0-9]{64}$'),
  state TEXT NOT NULL CHECK (state IN (
    'pending_approval', 'approved', 'rejected', 'offered', 'declined',
    'accepted', 'assigned', 'in_progress', 'closed', 'revoked', 'expired'
  )),
  disclosure_fields TEXT[] NOT NULL DEFAULT '{}',
  approval_expires_at TIMESTAMPTZ,
  assigned_enrollment_id TEXT REFERENCES community_organization_enrollments(enrollment_id),
  version INTEGER NOT NULL CHECK (version > 0),
  confirmed_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  purge_after TIMESTAMPTZ,
  UNIQUE (request_id, organization_id)
);
CREATE INDEX community_matches_org_queue_idx
  ON community_matches(organization_id, state, confirmed_at, match_id);

CREATE TABLE community_match_offers (
  offer_id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES community_matches(match_id),
  volunteer_enrollment_id TEXT NOT NULL REFERENCES community_organization_enrollments(enrollment_id),
  state TEXT NOT NULL CHECK (state IN ('offered', 'accepted', 'declined', 'expired', 'revoked')),
  version INTEGER NOT NULL CHECK (version > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX community_one_active_offer_per_match
  ON community_match_offers(match_id) WHERE state IN ('offered', 'accepted');

CREATE TABLE community_capacity_reservations (
  reservation_id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES community_matches(match_id),
  organization_id TEXT NOT NULL REFERENCES community_organizations(organization_id),
  volunteer_enrollment_id TEXT NOT NULL REFERENCES community_organization_enrollments(enrollment_id),
  service_date DATE NOT NULL,
  day_part TEXT NOT NULL CHECK (day_part IN ('flexible', 'morning', 'afternoon', 'evening')),
  state TEXT NOT NULL CHECK (state IN ('reserved', 'released', 'revoked', 'expired')),
  version INTEGER NOT NULL CHECK (version > 0),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX community_capacity_active_slot
  ON community_capacity_reservations(volunteer_enrollment_id, service_date, day_part)
  WHERE state = 'reserved';

CREATE TABLE community_match_progress (
  progress_id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES community_matches(match_id),
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  checkpoint TEXT NOT NULL CHECK (checkpoint IN (
    'arrangements_confirmed', 'support_started', 'support_completed', 'unable_to_proceed'
  )),
  actor_role TEXT NOT NULL CHECK (actor_role IN ('coordinator', 'volunteer')),
  occurred_at TIMESTAMPTZ NOT NULL,
  UNIQUE(match_id, aggregate_version)
);

CREATE TABLE community_match_idempotency (
  key_digest TEXT NOT NULL CHECK (key_digest ~ '^[a-f0-9]{64}$'),
  actor_ref_digest TEXT NOT NULL CHECK (actor_ref_digest ~ '^[a-f0-9]{64}$'),
  operation TEXT NOT NULL,
  route_digest TEXT NOT NULL CHECK (route_digest ~ '^[a-f0-9]{64}$'),
  intent_digest TEXT NOT NULL CHECK (intent_digest ~ '^[a-f0-9]{64}$'),
  match_id TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(key_digest, actor_ref_digest, operation, route_digest)
);

ALTER TABLE community_audit DROP CONSTRAINT community_audit_action_check;
ALTER TABLE community_audit ADD CONSTRAINT community_audit_action_check CHECK (
  action IN (
    'help_request.submitted', 'help_request.closed', 'help_request.auto_closed',
    'help_request.deleted', 'help_request.retention_purged',
    'match.approved', 'match.rejected', 'match.offered', 'match.offer_responded',
    'match.assigned', 'match.reassigned', 'match.progress_recorded',
    'match.closed', 'match.revoked'
  )
);

ALTER TABLE community_outbox DROP CONSTRAINT community_outbox_event_type_check;
ALTER TABLE community_outbox ADD CONSTRAINT community_outbox_event_type_check CHECK (
  event_type IN (
    'community.help_request.submitted.v1', 'community.help_request.closed.v1',
    'community.help_request.deleted.v1', 'community.match.approved.v1',
    'community.match.rejected.v1', 'community.match.offered.v1',
    'community.match.offer_responded.v1', 'community.match.assigned.v1',
    'community.match.reassigned.v1', 'community.match.progress_recorded.v1',
    'community.match.closed.v1', 'community.match.revoked.v1'
  )
);
ALTER TABLE community_outbox DROP CONSTRAINT community_outbox_lifecycle_outcome_check;
ALTER TABLE community_outbox ADD CONSTRAINT community_outbox_lifecycle_outcome_check CHECK (
  lifecycle_outcome IN (
    'pending', 'closed', 'deleted', 'approved', 'rejected', 'offered',
    'accepted', 'declined', 'assigned', 'reassigned', 'in_progress', 'revoked'
  )
);

UPDATE community_schema_state
SET version = 2, updated_at = CURRENT_TIMESTAMP
WHERE service = 'community' AND version = 1;
