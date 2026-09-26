# P4-S1 Medication Reminder Threat Model

- Status: Frozen for implementation
- Contract: `P4-S1-v1`
- Scope: LB-018 schedule and the minimum LB-019 generic delivery/seen extension

## Assets and ownership

Care Coordination owns the exact user-provided medication label, amount,
explicit unit, local minute, IANA zone, numeric offset, finite recurrence,
schedule version, occurrences, transitions, redacted audit, idempotency and
intent outbox. Notification owns minimum structured reminder intents, delivery
attempt/evidence state, generic in-app items, immutable seen acknowledgement,
redacted audit, idempotency and acknowledgement outbox. Identity & Consent owns
fresh exact-purpose decisions. Gateway owns no medication or acknowledgement
state and composes only current owner responses.

The acknowledgement asset means only that the generic reminder was seen. It is
not evidence of taken, skipped, dose, adherence, urgency, treatment outcome or
clinical safety.

## Trust boundaries

1. Browser to Gateway: session, same-origin/Fetch-Metadata, CSRF and
   idempotency boundaries.
2. Gateway to Identity: a new permission, household/resource scope,
   normalized request digest and correlation for every operation.
3. Gateway to Care: the current Identity decision plus Care-only command.
4. Care outbox to Notification inbox: minimum versioned schedule/cancel intent;
   never the medication label, amount, unit or free text.
5. Gateway to Notification: the current Identity decision plus generic
   read/acknowledge command.
6. Each service to its own PostgreSQL owner and schema. There is no
   cross-service SQL, credential, import or shared table ownership.

## Threats and required controls

| Threat                                                                  | Control                                                                                                                                                                                  | Required evidence                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Household role is mistaken for care-recipient consent                   | Fresh exact-purpose P2 decision for every read, create, change, disable, Notification read and acknowledgement; mismatched/stale decisions fail with the same bounded not-found response | Gateway denial test, stale-decision integration test, real Identity audit |
| Medication content leaks into Notification, logs or browser persistence | Strict minimum-data intent/seen schemas; generic message key; structured redacted logs; no client persistence of form values; source/log/persistence scans                               | Contract rejection, Care outbox inspection, real browser/log scan         |
| Client or server infers dosage, unit, treatment, urgency or adherence   | Exact decimal string and explicit enumerated/custom unit; no diagnosis/instruction/outcome fields; acknowledgement literal is `seen` only                                                | Contract tests and native VI/EN copy                                      |
| DST gap, overlap or offset mismatch shifts the reminder                 | Server resolves IANA wall time; gaps fail; overlaps require earlier/later plus matching explicit offset; finite recurrence materializes stable UTC occurrences                           | Bangkok/New York gap/overlap/transition tests                             |
| Intent receipt is reported as delivery                                  | Intent and delivery state are separate; `delivered` requires atomically persisted in-app evidence                                                                                        | Notification migration constraints and integration tests                  |
| Failed, missed or uncertain delivery becomes success                    | Durable distinct states and attempts; fixed 15-minute window; bounded retry only from uncertain; no acknowledgement outside delivered state                                              | Notification integration and LB-019 state tests                           |
| Duplicate/concurrent acknowledgement creates multiple outcomes          | Occurrence advisory lock, optimistic version, digest-only idempotency, immutable seen row and one audit/outbox event                                                                     | Concurrent PostgreSQL test and real duplicate path                        |
| Timeout causes blind client retry                                       | Mutation 5xx/network becomes unknown outcome; native UI offers a fresh read and does not auto-submit or generate a new retry                                                             | Mocked browser uncertain-state test                                       |
| Schedule change erases prior delivery evidence                          | Care creates new occurrence identities per schedule version; Notification keeps prior delivered/seen records immutable                                                                   | Change/intent integration evidence                                        |
| Partial transaction reports success                                     | State, transition/audit/outbox and idempotency commit in one owner-local transaction; injected pre-commit failures roll all rows back                                                    | Care and Notification rollback tests                                      |
| Migration backfills or couples owners                                   | Separate owner databases; transactional migration; rollback/reapply/no-backfill checks in each owner store                                                                               | `p4-s1-migration.ts`                                                      |
| Visual reference is overclaimed                                         | Generated source rejected; private pixels are not standalone approval; corrected native handoff drives semantic implementation                                                           | Frozen handoff and KI-019                                                 |

## Failure truth

Denied and absent resources are indistinguishable. Validation identifies only
submitted field names. Dependency failure never becomes an empty list.
`pending`, `uncertain`, `failed`, `missed`, `cancelled` and `delivered` are
distinct durable Notification facts. Offline schedule and acknowledgement
mutations are blocked, never queued and never auto-submitted. A stale version
requires a fresh read and a new review. Critical state remains in the document,
not only a toast.

## Residual risk

KI-001 continues to block deployment pending disposable Stitch credential
retirement review. KI-016 retains manual assistive-technology and
physical-device work. KI-019 retains the lack of independent private-pixel
inspection; native automated evidence does not become a standalone visual
conformance claim. No P4-S2/P4-S3 clinical, emergency, vault, deployment or
release authority is introduced.
