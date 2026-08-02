# P7-S1 pre-code review — service-owned migration safety

Date: 2026-08-02  
Base: `origin/dev@ae48031652fbc9e751cd0b0928deb5c01f39b5e0`  
Scope: P7-S1 only

## Frozen inventory

| Owner             | Runtime/tool                        | Current order | Credential today            | Required P7 boundary                                     |
| ----------------- | ----------------------------------- | ------------- | --------------------------- | -------------------------------------------------------- |
| identity-consent  | Node 22 / `pg` 8.22.0 custom runner | SQL 001–007   | `IDENTITY_DATABASE_URL`     | owner migration URL plus DML-only runtime URL            |
| care-coordination | Node 22 / `pg` 8.22.0 custom runner | SQL 001–007   | `CARE_DATABASE_URL`         | owner migration URL plus DML-only runtime URL            |
| notification      | Node 22 / `pg` 8.22.0 custom runner | SQL 001–003   | `NOTIFICATION_DATABASE_URL` | owner migration URL plus DML-only runtime URL            |
| community         | Spring Boot 4.1.0 / Flyway 12.4.0   | `V1`–`V3`     | application datasource      | owner Flyway datasource plus DML-only runtime datasource |

Each owner has a separate PostgreSQL database. `public` is owner-local, not a
shared schema. No service may connect to, migrate, read or write a foreign
owner database, schema, ledger or table.

## Independent review reconciliation

Three read-only reviews covered (A) ownership/credentials/compatibility, (B)
Node/Flyway migration mechanics and recovery, and (C) security/operations/CI.
They independently found the same blocking gaps:

1. Node runners have no immutable per-file checksum ledger, owner lock, bounded
   timeout, drift detection or uncertain-commit reconciliation.
2. Application and migration credentials are not separated; the P6 hosted
   Notification replacement proof even uses an admin URL and therefore is not
   P7 credential evidence.
3. No machine-readable four-owner inventory defines tool/version, order,
   credential capability, tables and `N-1/N` window.
4. Existing rollback/reapply tests do not prove concurrent production runners,
   mixed immutable runtime artifacts, lock timeout, drift, unavailable DB or
   recovery/compensation.
5. Community readiness accepts versions 1–2 although Flyway V3 records version 3. Readiness needs a bounded compatibility interval, never an unbounded
   `>=` check.

There was no unresolved tool-version question: the repository already pins
Node `pg` 8.22.0 and records Spring Boot 4.1.0/Flyway 12.4.0/PostgreSQL 17.5.
No web research is required before implementation.

## Frozen implementation plan

1. Add a validated machine-readable owner ledger with exact historical file
   hashes, owner tables, migration/runtime credential identifiers, tool
   versions, order and compatibility window.
2. Add an owner-local Node ledger protocol with a PostgreSQL advisory lock,
   checksum/order validation before mutation, one transaction per migration,
   bounded lock/statement timeouts, safe repeat behavior and reconciliation
   after an uncertain commit. Emit only allow-listed migration health fields.
3. Keep Community on Flyway; explicitly enable validation and disable clean and
   out-of-order execution. Give Flyway its owner migration datasource while the
   runtime datasource remains DML-only. Normalize Flyway history into the same
   machine-verifiable acceptance evidence; never auto-repair drift.
4. Add one additive P7 migration per owner. Schema N must remain usable by the
   exact N-1 artifact throughout the declared window; contraction is deferred.
5. Provision owner, migrator and runtime roles in task-owned hosted databases.
   Prove runtime DDL denial, migrator/runtime foreign-owner denial, insufficient
   privilege failure and no admin credential in a service process.
6. Exercise fresh/repeat/duplicate/concurrent/partial/lock-timeout/drift/
   unavailable/uncertain outcomes, mixed N-1/N traffic, a verified bounded
   pre-migration recovery point, and idempotent roll-forward compensation.
7. Add one P7-S1 hosted job without weakening P6 exact-head, auth/artifact,
   docs-only classifier, bounded integrity or the always-reported aggregator.

## Rollback and recovery contract

An application artifact may roll back while the additive schema remains.
Schema reversal is not claimed. A bad data transition is repaired by a new
forward migration or an owner-local idempotent compensation whose invariant is
verified. Immediately before mutation, the operator records and verifies a
bounded owner recovery point tied to the current ledger/checksums. General
backup retention, deletion, RPO/RTO and disaster recovery remain P7-S3.

## Explicit non-goals

No UI/Stitch, P7-S2 replay, P7-S3 lifecycle/DR, new datastore/service/broker/
cache, shared schema/credential, Flyway `clean`/automatic `repair`, production
down migration, or P8/release work.
