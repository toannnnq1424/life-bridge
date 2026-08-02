# P7-S1 migration security, failure and recovery contract

Date: 2026-08-02

## Protected invariants

- A service runtime has DML access only to its owner database and cannot run
  DDL or inspect another owner's schema, ledger or credential.
- A migrator has only the DDL/DML needed for its owner database and cannot
  connect to or mutate another owner.
- Applied migration identity and SHA-256 are immutable. Drift, a ledger gap,
  an unknown row or an incompatible schema fails before DDL.
- Exactly one owner migration sequence executes at a time. Duplicate launch is
  a safe wait/no-op; lock timeout is a bounded, observable failure.
- Loss of acknowledgement around commit is `uncertain` until a fresh
  connection reconciles ledger and catalog evidence.
- Telemetry never contains a URL, username/password, SQL bytes, row values,
  care content, token, stack trace or raw database error.

## Failure decisions

| Failure                                     | Required result                                                      |
| ------------------------------------------- | -------------------------------------------------------------------- |
| partial statement/transaction               | rollback; no successful ledger row; safe retry                       |
| duplicate/concurrent launch                 | one executor; waiter safely applies remaining work or no-ops         |
| lock timeout                                | fail closed with owner/migration/failure class only                  |
| historical checksum or Flyway history drift | fail before mutation; no automatic repair                            |
| insufficient/foreign credential             | SQLSTATE-classified denial; no leaked target or secret               |
| unavailable database                        | bounded unavailable result; runtime does not claim ready             |
| connection loss at commit boundary          | reconnect and reconcile; never blindly replay                        |
| incompatible old runtime                    | block rollout/contract; preserve old artifact and expanded schema    |
| bad N application artifact                  | roll application back while schema stays expanded                    |
| bad data transition                         | new idempotent roll-forward/compensation plus invariant verification |

## Operational evidence

Before mutation, record a redacted recovery correlation, owner, timestamp,
ledger digest and a verified owner-local recovery artifact/checkpoint. P7-S1
proves only that this bounded point is readable and restores a synthetic
sentinel into an exact task-owned ephemeral database. It does not claim
retention, production PITR, RPO/RTO or full disaster recovery.

P6 exact-head checkout, authenticated service calls, dependency isolation,
independent artifacts, secrets checks, fail-closed docs-only classification and
the aggregator named `P1 through P6-S1 full required gate` remain mandatory.
