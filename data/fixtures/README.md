# Fixture synthetic xác định được / Deterministic synthetic fixtures

Fixtures are fictional test/demo data. They exercise contracts and user flows without reproducing a real person, household, service provider or emergency event.

Fixture là dữ liệu kiểm thử/demo hư cấu. Chúng dùng để chạy luồng sản phẩm, không tái tạo một cá nhân, hộ gia đình, cơ sở dịch vụ hay sự kiện khẩn cấp có thật.

## Non-negotiable rules / Quy tắc bắt buộc

1. `synthetic: true` on every fixture root.
2. IDs use obvious prefixes such as `hh-syn-001`; no names copied from reports.
3. Deterministic seed and generator version are recorded.
4. No real phone number, email, home address, coordinate, government ID, photo or voice.
5. No diagnosis, prescription, clinical instruction or medical recommendation.
6. Support needs are neutral, user-stated functional preferences.
7. A fixture must not encode gender, age, disability or family relationship as automatic caregiver authority.
8. Emergency data are explicitly simulated and never include a real hotline or claim to be current.
9. Synthetic service locations use fictional grid cells, not a real facility or private residence.
10. Each fixture passes schema, referential-integrity, privacy and determinism tests before commit.

## Phase 1 minimum fixture set

The first vertical slice should remain small:

| Fixture                              | User-visible flow                                             | Required edge                       |
| ------------------------------------ | ------------------------------------------------------------- | ----------------------------------- |
| `care_task_happy_path`               | coordinator creates a task; authorized member sees it         | bilingual title/description         |
| `care_task_handoff`                  | assignee acknowledges or declines a handoff                   | no implicit responsibility transfer |
| `care_task_permission_denied`        | unauthorized member cannot view/edit a scoped task            | safe error, no data leak            |
| `care_task_notification_failed`      | task persists while notification delivery fails/retries       | idempotency and visible status      |
| `care_task_accessible_low_bandwidth` | same flow works by keyboard/screen reader and reduced payload | WCAG 2.2 AA checks                  |

Later fixtures require their own slice and source/safety review:

- community service directory with stale status;
- simulated hazard context that fails closed;
- consent delegation/revocation;
- multi-caregiver schedule conflict;
- aggregate research context charts.

## Proposed fixture envelope

This is a design contract, not implemented data:

```json
{
  "fixtureVersion": "1.0.0",
  "synthetic": true,
  "seed": "lifebridge-phase1-v1",
  "generatedAt": "fixed-by-generator",
  "scenarioId": "care_task_happy_path",
  "localeCoverage": ["vi", "en"],
  "researchContext": [
    {
      "sourceId": "DS-04",
      "usage": "scenario-design-only",
      "claim": "no source row or value copied"
    }
  ],
  "households": [],
  "members": [],
  "delegations": [],
  "careTasks": [],
  "notificationDeliveries": [],
  "evidence": []
}
```

## Record design / Thiết kế record

### Household

- `id`: `hh-syn-*`
- `displayName`: obviously fictional and localized
- `locale`: `vi` or `en`
- `connectivityMode`: synthetic product condition such as `intermittent`
- no address; optional `demoRegion` must be a fictional grid label

### Member

- `id`: `member-syn-*`
- `householdId`
- `displayLabel`: fictional
- `roleAssignments`: scoped roles, not family stereotypes
- `ageBand`: broad band only when a test requires it
- `accessPreferences`: user-stated UI preferences, e.g. larger text or reduced motion
- never `diagnosis`, medical history or legal status inferred by the generator

### Delegation

- grantor/grantee IDs;
- permitted action/resource scope;
- consent receipt/version;
- starts/expires/revoked timestamps;
- explicit state transition.

### Care task

- bilingual content;
- creator and visibility scope;
- assignee and acknowledgement state;
- due window and timezone;
- status and idempotency key;
- no clinical order or free-text secret.

### Notification delivery

- channel type without real destination;
- delivery status, attempt and provider-safe error code;
- correlation/idempotency ID;
- no message body in logs.

### Evidence

- `kind`: `fact`, `inference`, `missing`, or `recommendation`;
- `sourceId` when external evidence is referenced;
- `referencePeriod`, `retrievedAt` and `license`;
- no uncited “latest/current” wording.

## Aggregate context snapshots

DS-01 and DS-07 are candidates for a future tiny reference artifact, **not** household fixtures. That slice must:

- query/pin exact WDI indicator codes and years;
- store values at source precision, not rounded UI text;
- retain CC BY 4.0 attribution and original-source note;
- include checksum and schema;
- state that population statistics do not predict individual care need;
- keep the reference artifact separate from generated household records.

DS-04 is never copied here. If approved analysis produces broad aggregate parameters, store only the reviewed derived result and its query/provenance manifest.

## Scenario balance without stereotypes

Fixture review asks:

- Are care tasks shared across more than one role/gender presentation?
- Does an older member retain agency and permissions?
- Is a disability/access preference represented as a product interaction need, not incompetence?
- Does the low-connectivity scenario receive the same core outcome?
- Do permission-denied and consent-revoked cases avoid revealing existence/content of protected records?
- Are Vietnamese and English strings natural, equivalent and non-stigmatizing?
- Are no real-world rare combinations or source narratives reproduced?

## Required validation

Future fixture tooling should provide targeted commands for:

1. JSON/schema validation;
2. deterministic regeneration (same seed -> byte-identical normalized output);
3. unique IDs and valid references;
4. no direct identifiers, secrets, real phone/email/address patterns;
5. no forbidden medical/emergency claims;
6. bilingual key parity;
7. source/provenance completeness;
8. accessibility scenario coverage;
9. snapshot checksum verification;
10. package-scoped tests, not the full repository suite after each edit.

## Review checklist

- [ ] Every root says `synthetic: true`.
- [ ] Generator seed/version is fixed.
- [ ] No raw dataset or copied source row.
- [ ] No PII, sensitive personal data or secret.
- [ ] No real facility, private coordinate, active alert or hotline.
- [ ] Fact/inference/missing/recommendation are distinguishable.
- [ ] Source-inspired choices cite source IDs and limits.
- [ ] Vietnamese/English content is reviewed.
- [ ] Schema, privacy and determinism tests pass.
- [ ] Research register/matrix and session log are current.
- [ ] Phase/slice plan delta is recorded if scope changed.

## Safety statement

Fixtures must always be visibly labelled **DEMO / DỮ LIỆU GIẢ LẬP** in user-facing builds. They are not suitable for care, clinical, benefits, service-referral or emergency decisions.
