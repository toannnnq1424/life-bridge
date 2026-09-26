# P8-S2 secrets, encryption, runtime and supply-chain threat model

Status: engineering model, reviewed 2026-08-02; not legal advice, certification or a provider/KMS claim.

The evidenced topology is source and GitHub Actions producing six independent Node/Spring container artifacts, four service-owned PostgreSQL boundaries, service assertions, Identity application-layer sealed authenticator material and P7 encrypted backup manifests. Production hosting, secret custody, PKI and storage-at-rest provider remain undecided.

Primary threats are credential disclosure through source/history/log/cache/layer/SBOM/provenance, stale workers or pools retaining revoked generations, `kid` confusion across Node/Spring, loss of Identity decryption availability during key replacement, runtime possession of migration authority, fixture/debug activation, mutable build inputs, incomplete dependency inventories, provenance tamper and privilege expansion at container start.

Controls are exact current/previous `kid` binding, short assertion lifetime, bounded overlap and explicit old-key rejection; AES-GCM envelopes with AAD and current-write/previous-read keyring; fail-closed production transport/config rules; separate owner credentials; full-SHA Actions and digest-pinned containers; resolved SBOM and digest-bound unsigned provenance verification; zero-leak thresholds and owned expiring exceptions; non-root/read-only/cap-drop/no-new-privileges/resource/shutdown runtime policy; independent negative fixtures and redacted attribution.

Rollback retains the previous generation only within its frozen overlap. Forward recovery activates a distinct current generation, drains stale work, rewraps data where needed, rejects the old generation and records only identifiers, generation, actor category and result. Secret values, connection URLs and protected payloads never enter evidence. If provider key custody, KMS, PKI, registry signing or a new scanner service becomes necessary, implementation stops for a major-decision gate.
