# P2-S2 household authorization threat model

Status: Frozen vertical-slice contract; Stitch design and local Level C gates
resolved, stable candidate pending exact-head and post-merge promotion evidence.

## Authority and ownership

Identity & Consent owns households, membership, invitations, minimum
care-recipient context, capability decisions and audit evidence in its own
PostgreSQL database. Account authentication alone grants no household
capability. Gateway forwards the authenticated session; no public actor header,
cross-service SQL, shared credential, new service or new engine is introduced.

The household creator atomically becomes its first active organizer. Roles are
`organizer`, `caregiver` and `member`; the server owns the capability matrix.
Organizer can manage the household, invitations and minimum recipient context.
Caregiver/member can view only their authorized household and minimum context.
Unknown roles/actions deny by default. Care-recipient subject authority and
granular consent grant/revoke/history are P2-S3, never inferred from organizer
status.

## Invitation lifecycle

States are `pending`, `accepted`, `declined`, `expired`, and `revoked`.
Invitations target one verified account and only `caregiver|member`. Tokens are
256-bit CSPRNG values, returned only on initial creation/resend, stored only as
SHA-256 digests, fixed to 48-hour expiry, and single-use. Resend rotates the
token, extends expiry, has a five-minute cooldown and maximum three resends.
Raw token and invitee login name never enter audit/logs or persisted
idempotency responses.

Unknown login names create a transactionally managed decoy invitation with the
same public projection, token length, lifecycle and organizer management
behavior, but no account link. Possessing its token cannot create membership.
This prevents the organizer-facing lifecycle from becoming an account
existence oracle.

Rows are locked before accept/decline/revoke/resend. Terminal transitions are
monotonic. Acceptance and membership insertion share one transaction and a
membership uniqueness constraint. Managed transitions require current version.
Same idempotency key/input replays the confirmed non-secret projection; changed
input conflicts.

## Non-disclosure and minimized context

Missing, cross-household, non-member and unauthorized targets use the same
`404 HOUSEHOLD_NOT_FOUND / household.notFound` envelope. A verified intended
invitee holding a valid token may receive a bounded terminal state; protected
household labels, membership and context are never returned first.

Context contains only opaque ID, household ID, safe display label,
relationship-neutral label, version and timestamps. It cannot contain
diagnosis, medication, medical inference, clinical notes, emergency data or
legal-authority claims. Establishing context creates no consent grant.

## Evidence and tests

Important transitions commit an Identity-owned audit row with opaque actor,
household and target IDs, action, result and correlation ID. Allow-listed logs
contain those opaque dimensions only. Prohibited fields include raw token,
login name, labels/context, request/body/header/cookie, database URL and thrown
error.

Backend proof covers schema bounds, account-only denial, cross-household
equivalence, digest-only persistence, expiry, resend limits, replay and races,
duplicate membership, idempotency conflict, stale versions, audit atomicity,
redacted logs, migration/restart and P1/P2-S1 compatibility. Browser,
accessibility and built-runtime E2E evidence are defined by the Frozen Stitch
handoff. Local Level C passed; exact-head CI, merge-commit promotion and
post-merge `dev` CI remain required before closure.
