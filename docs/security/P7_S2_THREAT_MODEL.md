# P7-S2 threat model — durable event recovery

Date: 2026-08-02

## Protected assets and trust boundaries

Care owns source truth, immutable outbox intent, delivery attempts and terminal
attention. Notification owns receipt/deduplication and durable result. The
existing authenticated HTTP boundary remains the only delivery transport.
Operator reconciliation calls owner-local evidence endpoints with distinct
service keys; it never receives database credentials or raw event payloads.

## Threats and controls

| Threat                                           | Control                                                                                     | Proof                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Stale worker regresses delivered state           | Claim token and expected-state CAS                                                          | Lease-expiry two-worker test                              |
| Duplicate/replay creates another business result | Immutable event ID/hash, advisory lock, inbox and result uniqueness                         | Concurrent duplicate and crash-after-consume proof        |
| Older event overwrites newer result              | Aggregate lock and monotonic event head                                                     | N then N-1 rejection test                                 |
| Poison event retries forever                     | Bounded attempts and explicit terminal-attention error                                      | Version/hash/permanent-failure tests                      |
| Operator edits identity or payload               | Replay accepts only event ID, reason, dry-run/execute and CAS state transition              | Recovery audit and negative fitness                       |
| Gateway or publisher gains recovery visibility   | Dedicated `recovery-operator` caller and recovery/reconciliation scopes/keys                | Auth negative tests                                       |
| Evidence leaks care content or credentials       | Allow-listed opaque evidence, response ceiling and redacted errors                          | Fitness and output assertions                             |
| Cross-service ownership bypass                   | Owner-local APIs and migrations; no foreign SQL/imports/credentials                         | Architecture fitness and P7-S1 cumulative ownership gates |
| Unbounded recovery exhausts services             | Explicit single-event identity, two-second timeout, 16 KiB response and dispatcher bulkhead | Tool/static tests                                         |

## Residual risk and deferred controls

Recovery is intentionally single-event and operator-driven. Batch retention,
backup lifecycle, deletion, RPO/RTO and disaster recovery are P7-S3. Key
provisioning and production deployment remain later release gates. No UI,
broker, new datastore or Community delivery path is introduced.
