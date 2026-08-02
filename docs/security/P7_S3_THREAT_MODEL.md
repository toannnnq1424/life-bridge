# P7-S3 threat model — lifecycle and recovery

Date: 2026-08-02

| Threat                                | Control                                                                                                 | Evidence                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Restore overwrites live truth         | task-name allowlist; source/target inequality; reject existing/canonical targets                        | recovery guard negatives                   |
| Missing/corrupt/stale artifact        | manifest, SHA-256, byte count, PostgreSQL/schema/ledger provenance verified before target creation      | recovery unit and hosted database proof    |
| Wrong owner or shared credential      | unique owner runtime/migration/backup/restore identifiers and owner/database binding                    | inventory fitness and wrong-owner negative |
| Backup disclosure                     | AES-256-GCM task artifact, owner-scoped access declaration, task-only cleanup; no URL/content telemetry | hosted recovery and redaction tests        |
| Partial restore or crash              | `pg_restore --single-transaction --exit-on-error`; isolated target is disposable, never a live rollback | hosted restore proof                       |
| Unapproved irreversible deletion      | registry fails closed with `POLICY_DECISION_REQUIRED` before action                                     | lifecycle policy tests                     |
| Duplicate or changed lifecycle intent | SHA-256 canonical intent, same-key replay, changed-intent conflict                                      | lifecycle idempotency tests                |
| Partial operation reported complete   | per-owner states and terminal attention are required by orchestration contract                          | policy-neutral contract tests              |
| Compliance overclaim                  | evidence is labelled engineering-only, not PITR/DR/regulatory export/erasure                            | inventory, manifest and docs fitness       |

Residual risk: production backup key custody, real infrastructure RPO/RTO
objectives, legal holds, statutory retention, data residency and the final
per-data-class disposition matrix remain owner/release decisions. The current
slice does not mutate production data or claim those controls.
