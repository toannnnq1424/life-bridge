# Quản trị dữ liệu / Data governance

**Status:** Phase 0 baseline, 2026-07-25
**Applies to:** research, fixtures, telemetry, application data, imports, exports and any future external connector.

## 1. Nguyên tắc / Principles

1. **Purpose limitation / Giới hạn mục đích:** collect only what a documented LifeBridge flow needs.
2. **Data minimization / Tối thiểu hóa:** prefer role, age band and functional preference over identity, date of birth or diagnosis.
3. **Synthetic first / Ưu tiên synthetic:** demos and automated tests use deterministic fictional records.
4. **Source fidelity / Trung thực nguồn:** preserve publisher, URL, reference period, retrieval date, method and license.
5. **Fact separation:** facts, inferences, missing information and recommendations remain distinguishable in storage and UI.
6. **Least privilege:** separate household, research, analytics and admin access; deny by default.
7. **No silent repurposing:** a new purpose requires a new review and, where applicable, new consent.
8. **Human control:** no autonomous diagnosis, medical decision, benefits determination or emergency dispatch.
9. **Accessible by design:** privacy and consent flows must meet WCAG 2.2 AA and work in Vietnamese and English.
10. **Delete predictably:** every class has an owner, retention rule and deletion path before collection begins.

## 2. Legal baseline, not legal advice

Production design must be reviewed against:

- Viet Nam Law 91/2025/QH15 on Personal Data Protection, effective 2026-01-01: https://vanban.chinhphu.vn/?classid=1&docid=214590&pageid=27160&typegroup=
- Viet Nam Data Law 60/2024/QH15, effective 2025-07-01: https://vanban.chinhphu.vn/?classid=1&docid=212488&pageid=27160
- applicable health, child-protection, cybersecurity, consumer, archive, employment and sector rules;
- contracts and data-use terms for every provider and hosting region.

Phase 0 does not conclude which lawful basis, transfer mechanism or retention period is legally sufficient. Those are **MISSING** pending a concrete processing inventory and qualified Vietnamese counsel.

## 3. Data classification

| Class            | Examples                                                                                       | Default handling                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| PUBLIC-REFERENCE | source metadata, laws, standards, public aggregate indicators                                  | attributed, versioned; license checked                                        |
| SYNTHETIC        | fictional households, tasks, alerts, facilities                                                | allowed in Git only after synthetic-data checks                               |
| INTERNAL         | plans, non-sensitive test telemetry, quality metrics                                           | authenticated access; short retention                                         |
| PERSONAL         | name, contact, account ID, precise location                                                    | encrypted, purpose-bound, access logged; never in Git/logs                    |
| SENSITIVE        | health/functioning, disability, care dependency, children, consent, emergency/location context | explicit high-risk review, field-level controls, shortest justified retention |
| SECRET           | keys, tokens, credentials, signing material                                                    | secret manager/environment only; never docs, fixtures or logs                 |

When uncertain, classify upward.

## 4. Prohibited data in the repository

- real names, emails, phone numbers, home addresses, coordinates or government identifiers;
- health records, diagnoses, prescriptions, disability answers or care notes tied to a person;
- child-level or beneficiary-level records;
- copied public-use microdata, even if labelled anonymized;
- scraped facility/emergency records presented as current;
- API keys, cookies, tokens, `.env` files or provider credentials;
- faces, voices, photographs, narratives or rare attribute combinations copied from source reports;
- raw model prompts/outputs containing user content.

## 5. Research ingestion gate

Before downloading or querying a source, create a source card and answer:

1. What question is being answered?
2. Is an aggregate or synthetic substitute sufficient?
3. Who owns/custodies the data?
4. What exact terms and citation apply?
5. Does the dataset contain direct, indirect or quasi-identifiers?
6. What population is excluded?
7. What is the reference period and update behavior?
8. Where will raw data live, who can access it, and when will it be deleted?
9. What disclosure threshold applies to exports?
10. Which phase/slice and acceptance criterion need the output?

No answer means no ingestion.

## 6. Research workspace boundary

If DS-04 or another microdataset is approved later:

- raw files live in an access-controlled research workspace outside the repository and outside developer sync folders;
- record dataset version, checksum, access approver and deletion date;
- use read-only source files;
- export only documented aggregates;
- suppress small cells and rare cross-combinations; thresholds must be set by the research/privacy owner, not guessed in code;
- scan exports for direct and quasi-identifiers;
- review whether anonymization claims match the intended linkage environment;
- delete raw/local working copies on schedule and record completion;
- never send microdata to an LLM or third-party analytics service without a separate approved contract.

## 7. Synthetic-data standard

Synthetic means generated without reproducing a source person or source row. A fixture must:

- use obvious fictional IDs (`hh-syn-*`, `member-syn-*`);
- use age bands rather than real dates of birth unless a date-specific test is unavoidable;
- use fictional grid/service locations, not coordinates of private homes;
- avoid real phone numbers and emergency numbers;
- avoid diagnoses; model user-stated support/access needs with neutral language;
- include at least one low-connectivity and one assistive-technology scenario without stereotyping;
- maintain deterministic seed/version;
- carry source inspiration at the schema/scenario level, never pretend to be observed data;
- pass a similarity/uniqueness review before release.

See `data/fixtures/README.md`.

## 8. Consent and household roles

- Consent is specific to purpose, data category and actor; household membership does not imply access to all care notes.
- Support delegated access, revocation and expiry.
- A caregiver role is not automatically assigned by gender or family relationship.
- A dependent adult is not automatically incapable of controlling their data.
- Child and guardian flows require a dedicated legal/safeguarding design before implementation.
- Store a consent receipt/version, not a broad “accepted=true” shortcut.

## 9. Logging and observability

Allowed:

- request/correlation ID;
- service and route name;
- coarse result/error category;
- latency, retry count and source ID;
- schema/version and non-sensitive feature flags.

Forbidden:

- request/response bodies by default;
- names, contact data, task notes, access-needs answers, precise location;
- auth headers, cookies, tokens or connection strings;
- raw external-source payloads;
- model prompts and completions containing household content.

Use structured allow-listed fields. Redaction is a second line of defence, not permission to log everything.

## 10. Retention baseline

Exact production periods are **MISSING** until the processing inventory and legal review. Phase 0 defaults:

| Data                       | Default                                                                 |
| -------------------------- | ----------------------------------------------------------------------- |
| Synthetic fixtures         | versioned with code; remove superseded versions through normal review   |
| Public source metadata     | retain while referenced; revalidate at phase/release gates              |
| Raw approved research data | shortest project window in access agreement; never “indefinite”         |
| Research exports           | retain only while a documented decision/test depends on them            |
| Application telemetry      | short rolling window, configurable by environment                       |
| Security audit events      | separately protected; duration set by threat/legal review               |
| User content               | no default until deletion/export and legal requirements are implemented |

Backups must honor deletion and expiry; a soft delete alone is not completion.

## 11. External-source freshness

Every imported datum must support:

```text
source_id
source_record_id (when licensed and non-personal)
reference_period
observed_at (if available)
published_at (if available)
retrieved_at
expires_at or freshness_policy
source_url
license_id / terms_url
schema_version
evidence_kind = fact | inference | missing | recommendation
```

- A source update never overwrites a historical snapshot without an audit record.
- Conflicting values remain separate with source/method metadata.
- “Latest” is forbidden in persistent copy unless the timestamp and source are visible.
- Stale operational data must fail closed or fall back to neutral guidance.

## 12. Emergency and medical safety

- LifeBridge is not an emergency dispatch system and does not replace official services.
- Never infer an emergency solely from a demographic profile.
- Never generate a diagnosis or treatment recommendation from research aggregates.
- Emergency-aware features require formal source agreements, freshness SLAs, outage handling, localization, human escalation and safety review.
- If current data cannot be verified, display uncertainty and direct the user to verified official channels rather than inventing an answer.
- Hotline information is volatile and country-specific; do not hard-code it from this research registry.

## 13. Source and model change control

Any source, schema, inference rule or model change must record:

- previous and new source/version;
- reason and evidence;
- affected services, APIs, UI and fixtures;
- population/quality impact;
- license/privacy/security delta;
- migration or backfill;
- targeted and slice validation;
- rollback;
- implementation-plan, decision-log, known-issues and session-log updates.

If a change alters a future phase, add a dated plan delta: what moved, what was added/removed, why, dependencies, revised acceptance criteria and whether completed slices need revalidation.

## 14. Incident response minimum

On suspected exposure:

1. stop further processing and preserve minimal audit evidence;
2. rotate exposed credentials through the proper secret system;
3. identify data classes, subjects, systems, processors and time window;
4. do not copy exposed data into tickets/chat;
5. involve security/privacy/legal owners;
6. follow applicable notification duties and timelines;
7. document remediation and prevention;
8. add a regression test without using exposed records.

## 15. Phase 0 acceptance

- [x] Source registry uses direct URLs and reference/retrieval dates.
- [x] Fixture eligibility is explicit.
- [x] Raw microdata and PII are absent.
- [x] Legal sources effective in 2025–2026 are recorded.
- [x] Emergency, medical, child and disability safety caveats are explicit.
- [x] Future phase/source changes have a documentation protocol.
- [ ] Production processing inventory — deferred until a concrete vertical slice.
- [ ] Legal opinion and DPIA/risk assessment — deferred before any real-user pilot.
- [ ] Data subject export/deletion implementation — deferred until user-data persistence slice.
