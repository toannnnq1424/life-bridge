# P9-S1 redacted observability runbook

Use `contracts/observability/p9-s1-inventory.json` as the executable ownership and SLI source and `p9-s1-dashboards.json` as the deterministic view/alert source. Correlate only by Gateway-created trace/correlation context. Never search by task, household, medication, document, person, session, assertion, token or payload content.

1. Identify the failing class: validation, authorization, rate limiting, dependency/circuit, database/migration/storage, durable-event lag/replay/poison/terminal attention, or privacy-policy block.
2. Follow the named service owner. Database inspection uses only that service's role/schema; dashboards never query business tables or reuse credentials.
3. For durable delivery, follow Care outbox state to dispatcher result and Notification inbox/result using opaque trusted context. Replay creates new processing evidence linked by the safe context and never copies payload attributes.
4. A terminal-attention or privacy/security signal escalates to the service owner and security/privacy owner. Multi-service impact adds the incident lead.
5. Confirm recovery with two consecutive successful synthetic probes. A telemetry exporter failure is itself bounded evidence and must not roll back, duplicate or mutate confirmed business state.

The initial SLO record is deliberately empty until exact-head local/hosted synthetic samples populate it. Counts, observed ranges, commit and environment must be reported; do not label them production availability, a provider guarantee or a legal retention policy.
