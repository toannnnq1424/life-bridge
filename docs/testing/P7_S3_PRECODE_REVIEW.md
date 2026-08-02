# P7-S3 pre-code review — lifecycle and recovery

Date: 2026-08-02  
Accepted base: `origin/dev@36ba33372a2b138e10d0fc76b7e3ac96a008f05f`

Three independent read-only reviews covered recovery/version ownership, privacy
and policy applicability, and failure/security/CI. They agreed that LifeBridge
has four authoritative PostgreSQL 17.5 databases owned by Identity, Care,
Notification, and Community. Care-owned `BYTEA` document content remains part
of Care PostgreSQL. The emergency IndexedDB envelope is an encrypted derived
offline copy, not a server source of truth. No second authoritative engine or
new ADR is justified.

The reviews found and this slice corrects a P7-S1 ledger defect: Identity has
schema 8, not 9; Care has schema 9, not 8. Recovery manifests derive current
truth from immutable migrations and database ledgers, never stale prose alone.

## Frozen reversible acceptance

- machine-readable owner/data-class/credential/backup/restore/rebuild inventory;
- encrypted task-owned logical artifacts with SHA-256, provenance, exact
  PostgreSQL/schema versions and owner binding;
- verification before target creation and refusal of live, existing, wrong-owner,
  missing, corrupt, unencrypted or version-incompatible input;
- isolated restore with single-transaction/error-stop behavior, synthetic
  N-1→N evidence and measured engineering RPO/RTO;
- repeat/concurrency/crash behavior fails closed without live overwrite;
- owner-safe telemetry, PostgreSQL-only fitness, heavy-path classification and
  an always-reported P1-through-P7-S3 aggregate gate.

## Frozen lifecycle boundary

P2 authorizes immediate consent revocation for future access but explicitly
defers account deletion, physical purge, legal hold and regulatory export or
erasure. P7-S3 therefore supplies a configurable registry and idempotent
orchestration contract. Missing dispositions return
`POLICY_DECISION_REQUIRED` before physical action. Synthetic fixture policies
exercise delete, pseudonymize, retain, tombstone, export include and exclude;
they are not production policy or legal/compliance evidence.

The owner delegated the product-policy choice on 2026-08-02. The accepted
engineering matrix is `contracts/lifecycle/p7-s3-product-policy.json`: active
identifiable content is deleted or pseudonymized, continuity/security evidence
is bounded to at most 365 days, export artifacts expire after 24 hours and
backup artifacts after 30 days. Unsupported legal hold remains fail-closed and
requires counsel evidence; the matrix makes no statutory compliance claim.

## Official-source applicability record

Retrieved 2026-08-02. PostgreSQL 17 documentation establishes that `pg_dump`
cannot dump from a newer server major, logical dumps are intended for restore
to newer versions, and custom archives use `pg_restore`; `--single-transaction`
implies error-stop semantics. Sources:
<https://www.postgresql.org/docs/17/app-pgdump.html>,
<https://www.postgresql.org/docs/17/backup-dump.html>, and
<https://www.postgresql.org/docs/17/app-pgrestore.html>.

Vietnam's official legal database records Personal Data Protection Law
91/2025/QH15 and Decree 356/2025/NĐ-CP as effective 2026-01-01; the latter
replaces Decree 13/2023/NĐ-CP. Sources:
<https://vbpl.vn/TW/Pages/ivbpq-toanvan.aspx?ItemID=179252> and
<https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=187276>. These sources confirm
that current privacy law exists but do not, by themselves, establish a
LifeBridge-specific statutory retention or legal-hold period. The selected
durations therefore remain disclosed engineering defaults pending counsel.
