# P9-S2 pre-code review

Date: 2026-08-02. Base: `eb8a85aafafa6de83d5b0caa9c9f5cd0b434e66c`.

Three independent read-only reviews were completed before the contract and UI
implementation: contract/data/authority/reconciliation; Stitch/privacy/
accessibility/bilingual UI; and test/CI/operations/observability.

## Reconciled decisions

- Freeze one `P9-S2-truthful-state-v1` union. Confirmation requires an owning
  service version, observation time, provenance and bounded receipt.
- Inventory every actual Gateway mutation. Production routes are distinct from
  fixture-only routes. Create/update/delete/acknowledge/upload/event-backed
  representatives are mandatory.
- Default offline behavior is blocked/no queue. Only task creation may hold a
  maximum of ten intents for one hour in current-tab memory. Reconnect never
  submits; actor/session/household change, revocation or expiry purges it.
- Authority is always re-evaluated at dispatch. A ten-second authorization
  projection is never stored or replayed. Queue TTL stays below the common
  24-hour server idempotency window.
- A timeout after possible dispatch is uncertain, not failed. Reconciliation
  precedes any explicit retry. Confirmed core writes remain confirmed while
  notification/event/storage dependencies are reported separately.
- P9-S1 telemetry keeps trusted Gateway roots, baggage prohibition and strict
  redaction while adding lossless bounded state results.
- UI uses persistent semantic status, deterministic one-time focus for user-
  triggered failure, polite background reconciliation announcements, 320 px/
  400% reflow, long VI/EN text, forced colors and reduced motion.
- The cost hold forbids hosted CI and all GitHub mutation except one final
  branch push whose HEAD has `[skip ci]`; no PR or issue mutation occurs.

No provider, persistence engine, product/legal policy or architecture boundary
was added. Manual assistive-technology proof and hosted PostgreSQL/mixed-runtime
proof remain future gates, not local claims.
