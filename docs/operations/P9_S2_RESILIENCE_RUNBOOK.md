# P9-S2 truthful degradation runbook

Contract: `P9-S2-truthful-state-v1`. Inventory:
`contracts/resilience/p9-s2-mutation-inventory.json`.

## Classification

- `blocked`: not dispatched; offline, expired or policy disallows it.
- `queued`: allowlisted task-create intent held only in current-tab memory;
  undispatched, bounded, cancellable and never auto-submitted.
- `conflicted`/`rejected`: owner declined the request; preserve confirmed data.
- `dependency_failed`: dispatch outcome is known and a named dependency failed.
- `uncertain`: request may have dispatched; never blind retry.
- `reconciling`: fresh authorized owner read/reconcile is in progress.
- `confirmed`: owner version, observed time, provenance and receipt exist.

Validation/auth/abuse failures are user/rejected failures. Database, event,
storage/document, notification, privacy-policy, dependency, timeout and unknown
failures retain distinct safe classes. Internal details never enter UI or
telemetry.

## Outage and reconnect

1. Preserve last confirmed projection and label its time/version/source.
2. Block all non-allowlisted mutations. A held task is not saved.
3. On reconnect, announce availability politely; do not submit.
4. When the user explicitly reviews/sends, acquire current session/CSRF and
   authority, then dispatch with the original intent digest/idempotency policy.
5. If response is lost after possible dispatch, enter `uncertain`, read the
   operation-specific authoritative state, then move through `reconciling`.
6. Duplicate same-intent receipts converge; changed intent, out-of-order
   version, expired authority or revoked consent rejects without overwriting.
7. Purge held intent on cancel, expiry, logout, actor/session/household change
   or revocation. Never expose it to another household or tab.

## Partial failure and telemetry

Core and downstream outcomes are separate. A confirmed task/document/request is
not reverted in UI because notification or event projection lags. Emit only
P9-S1 allowlisted operation/result/failure-class/correlation fields; never
payload, actor, household, resource, filename, idempotency key or session. Sink
failure cannot affect product state.

Recovery requires two probes: an owning-service authoritative read and, for an
event-backed flow, the durable P7 result/replay evidence. This runbook claims no
production SLO, collector, retention store or legal compliance.
