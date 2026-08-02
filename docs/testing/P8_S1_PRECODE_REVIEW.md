# P8-S1 pre-code review — household isolation and consent enforcement

Date: 2026-08-02
Base: `origin/dev@a6cd86fd891e30828d04dbbae00a5da1f6922ae6`
Gate: `PASS WITH REQUIRED CONTROLS`

## Repository truth

The human household roles are exactly `organizer`, `caregiver`, and `member`.
Consent authority is `self`; moderator, volunteer, coordinator, operator and
service identities are capabilities, not additional household roles. The
protected flow is browser session -> Gateway -> fresh Identity decision ->
owner service. Community directory lookup alone is intentionally public.

Three independent read-only reviews found the same priority discontinuities:

1. Legacy task, member, dashboard and notification routes still accept the
   local fixture actor header instead of an authenticated Identity decision.
2. Owner services validate decision shape, request binding and age, but the
   decision is an unsigned point-in-time projection; revocation can race its
   final use.
3. Service assertion verification accepts a signature made with a different
   configured key than the declared `kid`, and route scopes are broader than
   the business operation.
4. There is no executable complete policy registry or two-household negative
   fixture proving BOLA/IDOR and non-enumeration across every entry family.

## Frozen minimal slice

- Add a versioned machine-readable deny-by-default policy matrix covering the
  actual human/service actors, household relationships, resources, operations,
  consent requirements, owner service and datastore boundary.
- Generate architecture fitness from the matrix: every protected route and
  permission is covered; public Community directory is the only listed public
  business resource; unknown cells deny.
- Close the fixture-header and service-key confused-deputy seams; production
  code cannot activate a fixture identity.
- Bind accepted decisions to relationship and consent versions and require a
  current decision at the final protected use. A stale or unavailable
  authority fails closed; confirmed owner truth is preserved while queued or
  replayed disclosure is suppressed.
- Prove two-household collection/object/mutation/export/replay isolation,
  stable non-disclosing errors, revocation/regrant concurrency, direct-owner
  rejection, N-1/N fail-closed behavior and datastore ownership.

No UI, new role, IdP/protocol, emergency override, datastore, destructive
migration, public compliance claim, P8-S2 or P8-S3 is authorized.
