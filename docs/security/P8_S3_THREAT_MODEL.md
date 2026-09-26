# P8-S3 threat, privacy and abuse model

Status: candidate engineering control, not certification or legal advice.
Retrieved sources: OWASP API4/API6 and Logging Cheat Sheet, NIST CSF 2.0, and
CISA Incident Response Playbook (all accessed 2026-08-02).

The machine authority is `contracts/security/p8-s3-surface-inventory.json`.
Actors are public callers, account/household actors, scoped moderators,
service identities and operators. Boundaries are browser→Gateway,
Gateway→owner service, owner-local PostgreSQL, durable events/replay, isolated
backups and allow-listed telemetry. Threats include distributed bursts,
dimension bypass, payload/concurrency exhaustion, enumeration, duplicate or
poison moderation/events, stale consent/session, partial lifecycle work,
backup/event/log residue, evidence injection and false recovery/completion.

Unknown surfaces or policy dispositions fail closed. IP/source is never the
sole authenticated dimension. Recovery has an independent finite budget.
Identifiers in evidence are digests or synthetic references; raw care content,
PII, secrets and free-form incident content are forbidden. P5 supports queue,
detail, resolution and reconciliation only; report ingestion, claim and appeal
are not claimed. Physical deletion, external notification and statutory/legal
matrices remain policy decisions.
