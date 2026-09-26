ALTER TABLE community_schema_state DROP CONSTRAINT community_schema_state_version_supported;
ALTER TABLE community_schema_state
  ADD CONSTRAINT community_schema_state_version_supported CHECK (version <= 3);

CREATE TABLE community_moderator_enrollments (
  enrollment_id TEXT PRIMARY KEY,
  actor_ref_digest TEXT NOT NULL CHECK (actor_ref_digest ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  UNIQUE(actor_ref_digest)
);

CREATE TABLE community_moderation_cases (
  case_id TEXT PRIMARY KEY,
  report_ref_digest TEXT NOT NULL CHECK (report_ref_digest ~ '^[a-f0-9]{64}$'),
  state TEXT NOT NULL CHECK (state IN ('open', 'withdrawn', 'expired', 'resolved')),
  evidence_category TEXT NOT NULL CHECK (evidence_category IN ('content_boundary', 'privacy_boundary', 'contact_boundary')),
  provenance TEXT NOT NULL CHECK (provenance IN ('community_report', 'community_record')),
  redaction_state TEXT NOT NULL CHECK (redaction_state IN ('minimum_redacted', 'purged')),
  policy_version TEXT NOT NULL CHECK (policy_version = 'P5-S3-v1'),
  version INTEGER NOT NULL CHECK (version > 0),
  reported_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  purge_after TIMESTAMPTZ
);
CREATE INDEX community_moderation_queue_idx
  ON community_moderation_cases(state, reported_at, case_id);

CREATE TABLE community_moderation_resolutions (
  resolution_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE REFERENCES community_moderation_cases(case_id),
  outcome TEXT NOT NULL CHECK (outcome IN ('no_change', 'content_visibility_restricted', 'community_participation_restricted')),
  reason TEXT NOT NULL CHECK (reason IN ('insufficient_authoritative_evidence', 'duplicate_report', 'outside_moderation_scope', 'policy_content_boundary', 'policy_privacy_boundary', 'policy_contact_boundary')),
  actor_ref_digest TEXT NOT NULL CHECK (actor_ref_digest ~ '^[a-f0-9]{64}$'),
  policy_version TEXT NOT NULL CHECK (policy_version = 'P5-S3-v1'),
  resolved_at TIMESTAMPTZ NOT NULL,
  retain_until TIMESTAMPTZ NOT NULL
);

CREATE TABLE community_moderation_idempotency (
  key_digest TEXT NOT NULL CHECK (key_digest ~ '^[a-f0-9]{64}$'),
  actor_ref_digest TEXT NOT NULL CHECK (actor_ref_digest ~ '^[a-f0-9]{64}$'),
  operation TEXT NOT NULL CHECK (operation = 'resolve'),
  intent_digest TEXT NOT NULL CHECK (intent_digest ~ '^[a-f0-9]{64}$'),
  case_id TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(key_digest, actor_ref_digest, operation)
);

ALTER TABLE community_audit DROP CONSTRAINT community_audit_action_check;
ALTER TABLE community_audit ADD CONSTRAINT community_audit_action_check CHECK (action IN (
  'help_request.submitted', 'help_request.closed', 'help_request.auto_closed',
  'help_request.deleted', 'help_request.retention_purged',
  'match.approved', 'match.rejected', 'match.offered', 'match.offer_responded',
  'match.assigned', 'match.reassigned', 'match.progress_recorded',
  'match.closed', 'match.revoked', 'moderation.queue_read',
  'moderation.case_read', 'moderation.resolved'
));

ALTER TABLE community_outbox DROP CONSTRAINT community_outbox_event_type_check;
ALTER TABLE community_outbox ADD CONSTRAINT community_outbox_event_type_check CHECK (event_type IN (
  'community.help_request.submitted.v1', 'community.help_request.closed.v1',
  'community.help_request.deleted.v1', 'community.match.approved.v1',
  'community.match.rejected.v1', 'community.match.offered.v1',
  'community.match.offer_responded.v1', 'community.match.assigned.v1',
  'community.match.reassigned.v1', 'community.match.progress_recorded.v1',
  'community.match.closed.v1', 'community.match.revoked.v1',
  'community.moderation.resolved.v1'
));
ALTER TABLE community_outbox DROP CONSTRAINT community_outbox_lifecycle_outcome_check;
ALTER TABLE community_outbox ADD CONSTRAINT community_outbox_lifecycle_outcome_check CHECK (lifecycle_outcome IN (
  'pending', 'closed', 'deleted', 'approved', 'rejected', 'offered', 'accepted',
  'declined', 'assigned', 'reassigned', 'in_progress', 'revoked', 'resolved'
));

UPDATE community_schema_state SET version=3, updated_at=CURRENT_TIMESTAMP
WHERE service='community' AND version=2;
