# P6-S3 authenticated service communication threat model

Status: pre-code contract frozen 2026-08-02

## Objective and boundary

P6-S3 makes every non-local internal call attributable to an explicit,
least-privilege service identity and keeps Care-confirmed state authoritative
when Notification or Community is unavailable. No UI, service, datastore,
broker, cache, shared database credential, or cross-service table access is in
scope.

Minimum implementation surfaces are the shared configuration/identity and
observability packages, Gateway dependency clients, the four service auth
middlewares, Care's Notification dispatcher, Spring Community auth/config,
artifact manifests, focused tests, the P6-S3 validator and CI job, plus the
direct architecture/API/security/deployment/test/state documents.

## Frozen controls

- Callers sign a short-lived assertion containing version, key id, caller,
  audience, exact allow-listed scope, issued-at, expiry and nonce. Providers
  verify signature, time window, audience and route scope before parsing or
  invoking business handlers. Missing, malformed, expired, wrong-audience and
  wrong-scope assertions fail without resource enumeration.
- Credentials are independently scoped per caller-to-audience edge. Current and
  previous verification keys may overlap only for a bounded rolling window;
  removal of the previous key completes rotation. Secrets and assertions are
  never logged.
- Production dependency URLs require HTTPS and reject URL credentials, query
  and fragment components. Explicit `local` and `test` modes may use HTTP only
  on loopback or the documented isolated hosted test network.
- Each dependency has its own timeout, concurrency bulkhead and circuit state.
  Retry is bounded to pre-confirmation timeout/429/5xx cases, uses backoff, and
  never changes the idempotency/event identity. Non-retryable failures terminate
  immediately.
- A timeout after a mutation may have been dispatched is reported as an unknown
  result and reconciled by authoritative read or safe same-key replay; it is
  never reported as a confirmed failure or success.
- Request and dependency-response bytes are bounded before parsing. Health
  bodies remain minimum and unauthenticated for orchestrator probes; detailed
  dependency attribution is emitted only as redacted structured telemetry.

## Threats and proof

| Threat                                   | Control and required proof                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| stolen token replay or lateral movement  | short lifetime, nonce, caller/audience/scope verification; wrong-caller/scope tests                        |
| confused deputy or direct Gateway bypass | provider-owned method/path scope matrix; Gateway cannot publish Care events                                |
| transport downgrade                      | production HTTPS startup validation; bounded local/test exception tests                                    |
| rotation outage or stale key             | current/previous overlap and cutoff tests; mixed-version rollback flow                                     |
| oversized header/body/response           | bounded assertion, inbound body and response reads; fail-closed tests                                      |
| dependency exhaustion                    | per-dependency bulkhead/circuit, bounded probe/recovery tests                                              |
| ambiguous writes                         | durable idempotency plus unknown-result reconciliation tests                                               |
| false core confirmation                  | Care commits independently; outage/recovery proves one Notification inbox item and truthful delivery state |
| secret or care-data leakage              | Node/Spring log capture rejects headers, assertions, raw ids, bodies and URLs                              |

Fixtures remain synthetic and minimum-data. Internal events must not contain
task titles/descriptions, contact details, browser session/CSRF credentials,
authorization headers or raw idempotency keys.

## Rollback

Deploy providers that accept current and previous credentials before callers
begin signing with the current key. Roll back consumers first while overlap is
active. Revoke the previous key only after the old caller is drained and the
authenticated smoke path is green. A rollback must not broaden scope, restore
plaintext production transport, or claim delivery that the authoritative
owner has not acknowledged.
