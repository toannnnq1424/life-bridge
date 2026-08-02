# P8-S2 pre-code review and docs-first plan

Status: reconciled 2026-08-02. Engineering controls only; no legal or compliance certification.

Three independent reviews covered secret/encryption/rotation boundaries, mixed Node/Spring/PostgreSQL runtime and container privilege, and SBOM/provenance/scanning/CI/redaction. They agreed that existing SHA-pinned Actions, digest-pinned bases, non-root images, current/previous service keys, migration ownership and docs-only classification are useful foundations, but are not P8-S2 acceptance by themselves.

The coherent slice freezes the actual inventory, adds bounded activation/overlap/revocation and key-id parity, evolves Identity sealed envelopes for current-write/previous-read rotation, freezes truthful encryption boundaries, and adds artifact runtime/supply-chain verification with tamper and leakage negatives. It does not introduce a provider, external secret manager, KMS, PKI, registry signing service, new datastore, or certification/SLSA claim.

Minimum implementation files are `contracts/security`, direct config/Identity/Community rotation code and tests, `artifacts/*/artifact.json`, P8-S2 quality/runner/CI files, and direct security/deployment/test/state documents. P8-S3, provider deployment, public release, legal retention decisions and production key custody remain deferred.

Official sources accessed 2026-08-02: NIST SP 800-57 Part 1 Rev. 5 key lifecycle/cryptoperiod guidance; OWASP Secrets Management and Cryptographic Storage Cheat Sheets; GitHub Actions secure-use, full-SHA pinning and artifact-attestation documentation; SLSA provenance v1; CycloneDX specification; Docker build-secret, multi-stage and rootless/runtime guidance; npm audit/provenance documentation; Maven reproducible-build guidance. These sources inform mapped engineering controls and do not establish compliance.
