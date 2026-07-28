# Nhật ký nghiên cứu / Research log

Không chép output tìm kiếm dài vào đây. Mỗi entry giữ câu hỏi, nguồn đã kiểm tra, kết luận và hành động tiếp theo.

Do not paste large search output here. Each entry records the question, sources checked, conclusion and next action.

## 2026-07-25 — Phase 0 source landscape

### Objective / Mục tiêu

Khảo sát các nguồn 2016–2026 phục vụ LifeBridge, ưu tiên bằng chứng 2021–2026 cho ageing, disability, caregiving, digital inclusion, community services, emergency context and accessibility. Xác định nguồn nào có thể hỗ trợ fixture synthetic và nguồn nào chỉ làm background.

### Method / Phương pháp

- Searched official publisher domains and primary catalogs first: GSO, Government of Viet Nam, UNFPA, UNICEF, World Bank, WHO, ITU, UNDRR, OECD, W3C and Washington Group.
- Opened source/terms pages where available; did not infer an open license from public accessibility.
- Distinguished `reference period`, `publication date` and `retrieval date`.
- Reviewed metadata only; downloaded no microdata and copied no source dataset into the repository.
- Retrieval snapshot: 2026-07-25.

### Search groups / Nhóm tìm kiếm

1. **Ageing:** GSO 2019 Census monograph; UNFPA older-person survey analysis; World Bank WDI age-65+ series.
2. **Caregiving:** World Bank/GSO Time-Use Survey; WHO long-term-care indicators; OECD informal-carer comparison; UNICEF social-assistance research.
3. **Disability:** GSO/UNICEF 2016–2017 survey; MICS6; WHO disability equity; Washington Group tools/translations.
4. **Digital inclusion:** World Bank WDI Internet-use indicator; ITU DataHub and terms.
5. **Community services:** UNFPA/HelpAge ISHC evidence; Ministry of Health telehealth list; WHO health-facility master-list initiative.
6. **Emergency context:** DMC disaster catalog, VNDMS, UNDRR DesInventar.
7. **Accessibility:** W3C WCAG 2.2 and measurement-language references.
8. **Governance:** Viet Nam Laws 91/2025/QH15 and 60/2024/QH15; publisher terms.

### Facts / Sự kiện đã kiểm chứng

- **FACT:** World Bank WDI currently publishes Viet Nam age-65+ totals for the window; the reviewed endpoints are 6,212,245 (2016) and 9,136,541 (2024).
- **FACT:** World Bank WDI displays 84% Internet use for Viet Nam in 2024; the underlying ITU view displays 84.2%, reflecting presentation precision.
- **FACT:** GSO's 2021 population-change survey included an older-person care-needs module; the analysis was published in 2022.
- **FACT:** The Viet Nam Time-Use Survey documents care of children and older people and labels an anonymized v2.1 as public-use files with citation requirements.
- **FACT:** MICS6 and the national disability survey include sensitive child/functioning information; public discoverability does not make repository copying safe.
- **FACT:** Current community-service pages lack the stable IDs, completeness, update cadence and explicit data-reuse contract required for safe referral.
- **FACT:** DMC/VNDMS pages are dynamic and safety-critical; the DMC page states all rights reserved.
- **FACT:** Laws 91/2025/QH15 and 60/2024/QH15 are in force as of this review.

### Inferences / Suy luận

- **INFERENCE:** The WDI age series increases by roughly 47% between the two reviewed points. This strengthens the need to test coordination scenarios but does not measure care demand.
- **INFERENCE:** National Internet penetration is insufficient to justify online-only UX; age/disability/device/affordability disaggregation is missing.
- **INFERENCE:** A deterministic fixture should exercise care handoff, delegated access, low connectivity and accessible interaction without encoding demographic stereotypes.
- **INFERENCE:** Service-finder and emergency-aware features should remain future, separately gated slices; synthetic records are safer for the MVP.

### Missing / Còn thiếu

- Recent successor to the 2016–2017 national disability survey.
- Open authoritative Viet Nam social/health service master list.
- Contracted official emergency feed with SLA and reuse terms.
- Verified Viet Nam coverage in WHO long-term-care indicators.
- Jointly disaggregated recent digital-inclusion data.
- Production legal opinion, processing inventory and data-protection impact/risk assessment.

### Decisions / Quyết định

- Use only DS-01 and DS-07 as Phase 1 aggregate-fixture candidates.
- Treat DS-04 as a future, approval-gated research dataset; raw/public-use microdata stays outside Git.
- Keep child, disability, named service and emergency records out of fixtures.
- Make WCAG 2.2 AA part of each UI slice acceptance criteria.
- A later source/phase change must update the register, score matrix, implementation plan and session log together.

### Validation performed

- Confirmed each registered source has publisher, geography, reference/publication period, retrieval date, direct URL, terms status, intended use, limitations, privacy/sensitivity, freshness and fixture class.
- Cross-checked license claims against publisher terms where an explicit terms page was found.
- Separated fact/inference/missing/recommendation.
- Confirmed no raw dataset, PII, health record, child record, secret or real emergency contact was added.

### Validation intentionally deferred

- Download/API checksum of DS-01/DS-07 snapshots: defer to the aggregate-fixture vertical slice.
- Microdata access and variable-level analysis: defer until a narrow research question and approval exist.
- Legal interpretation and DPIA: defer until production processing scope is concrete, but required before any real-user pilot.
- Operational service/emergency integration: no-go until formal data contract and safety case.

### Exact next research slice

**`research/aggregate-context-fixture`** — create a tiny, machine-readable, attributed DS-01/DS-07 snapshot with schema validation and provenance tests; then generate fictional household/task scenarios independently from source rows. Acceptance requires:

1. exact indicator/year/unit/license metadata;
2. deterministic values and checksum;
3. zero person-level data;
4. no claim that Internet use or age predicts individual need;
5. bilingual README and UI attribution;
6. targeted schema/provenance tests.

### Later phase delta rule

Nếu một nguồn mới làm thay đổi phase/slice đã dự kiến, entry kế tiếp phải ghi:

- planned phase/slice before and after;
- new evidence and why it is material;
- work added, removed or moved;
- data contract/migration/backfill impact;
- privacy/license/safety impact;
- acceptance criteria and validation delta;
- whether completed slices require revalidation.

## 2026-07-26 — P2-S2 backend authorization micro-cycle

Result: `PASS WITH ASSUMPTIONS`; retrieved 2026-07-26. OWASP Forgot Password
Cheat Sheet (global/current living guidance, CC BY-SA 4.0) confirms consistent
existent/non-existent responses plus random, securely stored, single-use,
expiring and rate-limited URL tokens; this confirms invitation
non-disclosure/digest lifecycle tests. PostgreSQL 17 Explicit Locking
(global/current official documentation, PostgreSQL licence) confirms
`SELECT FOR UPDATE` blocks competing writers until transaction end; this
confirms accept/decline/revoke/resend race tests. NIST SP 800-63B-4 (US, 2025,
US Government work) confirms throttling for online secret verification; this
confirms bounded invite attempts without making an AAL/compliance claim.

These are background requirements, contain no person-level data and create no
fixture. Password recovery is analogous rather than invitation-specific.
Another source did not change a requirement, test, non-goal or decision, so the
micro-cycle stopped. Consent authority remains the frozen product contract and
P2-S3 gate, not an inference from these security sources.

If evidence changes the roadmap, the plan delta must be explicit and dated; do not rewrite history.

## 2026-07-26 — P2-S3 consent/privacy/audit micro-cycle

Result: `PASS WITH ASSUMPTIONS`; retrieved 2026-07-26. This was a bounded
official/primary-source review and introduced no dataset or fixture.

- EDPB, EU, 2026,
  [Consent summary](https://www.edpb.europa.eu/system/files/2026-04/edpb-summary-consent_en.pdf):
  specific affirmative choices must identify purpose/data and withdrawal must
  be as easy as grant.
- EUR-Lex, EU, 2016 current regulation,
  [GDPR Articles 5 and 7](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng):
  minimize purpose/data/storage, preserve accountability, and distinguish
  withdrawal from deletion of prior evidence. It is outside the preferred
  2021–2026 publication window but retained because it is still-current
  primary law; no direct-applicability claim is made.
- OWASP, global current living guidance,
  [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  and
  [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  deny by default/check every request and separate business audit from
  allow-listed operational telemetry.
- W3C, global, 2024,
  [WCAG 2.2](https://www.w3.org/TR/WCAG22/): keyboard, visible/unobscured
  focus, reflow, status messages, target size, and review/confirmation apply to
  the consequential consent/settings flows.

Kết luận / Conclusion: P2-S3 is a repository-specific product control, not a
legal-compliance engine. It uses granular affirmative scope selection,
server-side authorization at every governed read, easy narrowing/revocation,
redacted retained evidence, atomic privacy saves, and accessible review.
Ninety-day audit retention is an engineering default only. Production legal
review, processing inventory, jurisdictional retention, export/deletion
workflow, and manual assistive-technology evidence remain later gates.

## 2026-07-26 — P3-S1 chronology and accountable handoff micro-cycle

Result: `PASS WITH ASSUMPTIONS`; retrieved 2026-07-26. This was one bounded
2021–2026 official/primary-source review. It introduced no dataset, fixture,
clinical claim, diagnosis or treatment guidance.

- IETF/RFC Editor, global, April 2024,
  [RFC 9557](https://www.rfc-editor.org/rfc/rfc9557.html): an instant and its
  named time zone are distinct facts. This confirms server UTC instants,
  validated IANA display zones and explicit local-day boundaries.
- PostgreSQL Global Development Group, global, PostgreSQL 17 current official
  documentation,
  [Date/Time Types](https://www.postgresql.org/docs/17/datatype-datetime.html)
  and
  [Invalid or Ambiguous Timestamps](https://www.postgresql.org/docs/17/datetime-invalid-input.html):
  `timestamptz` is stored as UTC while full zone names carry DST rules; local
  boundary resolution and spring/fall transition behavior must be deterministic.
- W3C, global, 2024,
  [WCAG 2.2](https://www.w3.org/TR/WCAG22/): semantic structure, labelled
  controls, visible and unobscured focus, status messages, reflow and minimum
  target size apply to chronological navigation and handoff review.
- AHRQ, United States, current official TeamSTEPPS material,
  [Handoff tool](https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/handoff.html):
  accountable transfer includes information, authority and responsibility and
  requires recipient awareness. This is used only as non-clinical coordination
  background for explicit review/confirmation; no medical content or claim is
  imported.

Kết luận / Conclusion: P3-S1 stores server occurrence/effective instants in UTC,
keeps the validated IANA display zone and selected local date explicit, tests
23/24/25-hour days, and orders equal instants with a stable opaque tie-breaker.
Handoff is a reviewed, versioned, idempotent immediate command with enumerated
reason only; the UI confirms only durable returned state and never queues an
offline mutation. Task title may remain only in the authorized no-store read
projection. It must not enter cursor, audit, outbox, notification or telemetry.

The technical sources are global and do not establish Viet Nam legal
compliance. Production legal review, retention/deletion policy and manual
assistive-technology evidence remain later gates. Another official source would
not change the time, authority, privacy, accessibility or test decision, so the
micro-cycle stopped.

## 2026-07-27 — P3-S2 calendar and appointment micro-cycle

Result: `PASS WITH ASSUMPTIONS`; retrieved 2026-07-27. This was one bounded
2021–2026 official-source review after the accepted P3-S1 UTC/IANA boundary.
It introduced no dataset, fixture, clinical claim, diagnosis, treatment,
medication, contact, location or real appointment data.

Questions:

1. Which local/UTC/zone facts prevent silent DST reinterpretation?
2. Which finite recurrence and occurrence-change boundary is safe for v1?
3. What calendar keyboard pattern is necessary when an equivalent agenda
   remains the complete path?
4. Which reminder-intent fields are minimum necessary outside Care
   Coordination?

Sources and findings:

- IETF/RFC Editor, global, April 2024,
  [RFC 9557](https://www.rfc-editor.org/rfc/rfc9557.html), Standards Track:
  offset and named time zone are distinct and inconsistency can be critical.
  P3-S2 therefore returns canonical UTC, source local time, numeric offset and
  validated IANA zone as separate facts.
- PostgreSQL Global Development Group, global, PostgreSQL 18 current official
  documentation,
  [Date/Time Types](https://www.postgresql.org/docs/18/datatype-datetime.html)
  and
  [Invalid or Ambiguous Timestamps](https://www.postgresql.org/docs/18/datetime-invalid-input.html),
  PostgreSQL licence: PostgreSQL stores `timestamptz` as UTC and otherwise
  resolves DST gaps/overlaps by database rules. LifeBridge must not make that
  implicit choice for appointment commands; gaps are rejected and overlaps
  use an explicit earlier/later policy.
- Google Calendar API, global current official product documentation,
  [Recurring events](https://developers.google.com/workspace/calendar/api/guides/recurringevents)
  and
  [Calendars and events](https://developers.google.com/workspace/calendar/api/concepts/events-calendars),
  Google Developers Site Terms: recurring events have concrete instances and
  exceptions; changing “this and following” splits a series and can reset later
  exceptions. This is benchmark evidence only. P3-S2 materializes a finite
  weekly series and supports change/cancel for one named occurrence only.
- W3C WAI, global, page updated August 2025,
  [Date Picker Dialog Example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
  and [Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), W3C
  document licence: a calendar grid requires managed keyboard focus and
  explicit selection; APG examples are informative and require real
  assistive-technology testing. The native P3-S2 agenda remains complete and
  the visual calendar is an enhancement, never the only path.
- OWASP Foundation, global current living guidance,
  [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html),
  CC BY-SA 4.0: sensitive personal data and payloads should be removed,
  masked or pseudonymized. Notification receives only opaque appointment and
  recipient references, structured disposition/message key and UTC trigger/
  start facts—never title, notes, location, attendee, recurrence rule or
  idempotency material.

Kết luận / Conclusion: `P3-S2-v1` uses structured appointment kind/logistics,
canonical UTC plus source local/IANA/offset facts, half-open interval conflicts,
finite weekly recurrence with an explicit occurrence count and maximum, and
occurrence-only change/cancel. Confirmed cancellation remains visible. Reminder
intent is a separate durable structured fact and is not a delivery claim. The
agenda contains every authorized critical fact and remains keyboard complete at
every width.

The technical sources are global and do not establish Viet Nam legal
compliance or product usability. KI-016 retains manual assistive-technology
evidence; KI-019 retains independent private-render review. Re-check on a
series-wide mutation request, external calendar synchronization, arbitrary
reminder audience/channel, tzdb/runtime change, public pilot or accessibility
claim. Another source would not change the v1 time, recurrence, privacy or
accessibility decision, so the micro-cycle stopped.

## 2026-07-27 — P3-S3 support-plan review micro-cycle

Result: `PASS WITH ASSUMPTIONS`; retrieved 2026-07-27. This bounded
official/primary-source review introduced no dataset, person-level fixture,
clinical claim, diagnosis, treatment, or recommendation.

- WHATWG, global Living Standard updated 20 July 2026,
  [HTML date state](<https://html.spec.whatwg.org/multipage/input.html#date-state-(type=date)>):
  a date value is year/month/day with no time zone. LB-017 treats review date
  and IANA zone as separate facts and never parses a bare date as browser UTC.
- PostgreSQL Global Development Group, global PostgreSQL 18 official docs,
  [Date/Time Types](https://www.postgresql.org/docs/18/datatype-datetime.html)
  and [Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  `date` has no time of day, named zones carry DST rules, and row/advisory locks
  support the shared-draft and confirmation invariants.
- OWASP Foundation, global current living guidance,
  [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  and [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  deny by default and authorize every request; keep plan statements out of
  telemetry, errors, cursors, audit metadata, and events.
- W3C, global, 2024, [WCAG 2.2](https://www.w3.org/TR/WCAG22/): semantic
  structure, keyboard access, focus, reflow, status messages, target size, and
  review/confirmation apply to LB-017.

Kết luận / Conclusion: P3-S3 stores local review date, validated IANA zone, and
resolved 23/24/25-hour UTC bounds as separate immutable confirmation facts.
Fresh purpose-scoped P2 authority is checked on every request. Optimistic
locking and idempotency protect the one shared draft/current aggregate.
Structured support-plan text stays only in authorized Care reads;
cross-service evidence is content-free. These sources establish no Viet Nam
legal or clinical-compliance claim. KI-016 and KI-019 remain. Re-check on a new
consent scope, multiple drafts, reminders, clinical fields, retention policy,
or runtime/tzdb change.

## 2026-07-28 — P4-S2 encrypted offline-copy micro-cycle

Result: `PASS WITH ASSUMPTIONS`; retrieved 2026-07-28. This bounded review used
global official/primary technical guidance and introduced no real contact,
care-plan, credential, private locator, diagnosis, treatment, or emergency
claim.

- OWASP Foundation,
  [HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
  and
  [Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html):
  sensitive browser persistence needs explicit threat treatment; authenticated
  encryption is preferred; same-origin script compromise remains a boundary;
  service-worker cache scope and stored response classes must be narrow.
- OWASP Foundation,
  [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html):
  PBKDF2-HMAC-SHA-256 at 600,000 iterations is the accepted current
  FIPS-oriented work factor; P4-S2 uses a random salt and keeps the offline
  passphrase separate from account authentication.
- W3C,
  [Web Cryptography Level 2](https://www.w3.org/TR/WebCryptoAPI/) and
  [WCAG 2.2](https://www.w3.org/TR/WCAG22/):
  Web Crypto supplies PBKDF2/AES-GCM primitives; native semantics, keyboard
  access, focus, reflow, non-color status, target size, and status messaging
  apply to LB-020/LB-021/LB-032.

Kết luận / Conclusion: ADR-025 accepts one explicitly saved, authenticated
encrypted snapshot in IndexedDB and only a non-sensitive shell in Cache
Storage. The copy remains “not live,” is recent through 24 hours, stale through
72 hours, then hidden and purged. These sources do not prove protection from
same-origin XSS, an unlocked device, weak-passphrase guessing, unavailable
remote revocation, Viet Nam legal compliance, clinical correctness, emergency
dispatch, manual assistive-technology conformance, or private-render visual
approval. Re-check on different KDF/AEAD parameters, Web Crypto/browser support,
multiple offline copies, longer retention, background synchronization, public
pilot, or a new legal/clinical claim.

## 2026-07-28 — P4-S3 bounded document-vault micro-cycle

Result: `PASS WITH ASSUMPTIONS`; retrieved 2026-07-28. This bounded official-
source review introduced no real document, PII, care record, credential,
private locator, malware-clean claim, storage product or scanner engine.

- OWASP Foundation,
  [File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html):
  extension allowlisting, independently checking declared type and content,
  generated storage names, size bounds, authorization, storage outside active
  web content, and malware scanning when available are distinct controls.
- PostgreSQL Global Development Group,
  [Binary Data Types](https://www.postgresql.org/docs/current/datatype-binary.html),
  [SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html), and
  [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html):
  `bytea` stores bounded binary strings; owner-local logical dump/restore can
  rehearse recovery without creating a new storage owner.
- IETF, [RFC 6266](https://www.rfc-editor.org/rfc/rfc6266):
  attachment disposition and carefully encoded, advisory filenames prevent a
  supplied filename from controlling a local path or active-inline response.
- WHATWG,
  [File upload state](<https://html.spec.whatwg.org/multipage/input.html#file-upload-state-(type=file)>):
  the native file input is the complete keyboard-accessible selection path;
  optional drag/drop is not required.
- W3C WAI,
  [ARIA25: role=status](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA25):
  meaningful upload and reconciliation status changes are announced without
  moving focus.

Kết luận / Conclusion: ADR-026 selects no new engine. Care stores one
strict-UTF-8 `.txt` object of 1–262,144 decoded bytes in PostgreSQL, verifies
digest/object binding, exposes only attachment downloads, and reports
`ready_unscanned`/`not_configured`/`not_scanned` rather than a clean claim.
These sources do not prove malware safety, production at-rest or backup
encryption, historical-backup deletion, RPO/RTO, Viet Nam legal compliance,
manual assistive-technology conformance or private-render visual approval.
Re-check when file types, maximum size, scanner, object storage, crypto,
retention, public exposure or compliance claims change.

## 2026-07-28 — P5-S1 Community contract and toolchain micro-cycle

Result: `PASS`; retrieved 2026-07-28 and frozen before Java/product code. This
bounded official-source review introduced no dataset, real person, care record,
credential, private locator, generated source, organization claim, exact
address, diagnosis, treatment, urgency, eligibility, safety or matching fact.
The complete reconciliation is
`docs/research/P5_S1_CONTRACT_TOOLCHAIN_REVIEW.md`.

- Eclipse Adoptium official Temurin releases and installation guidance support
  the complete Windows x64 HotSpot JDK `25.0.3+9`; the accepted archive SHA-256
  is `709312cd0420296d9b9de917fe6e28a5b979e875ee5ab91783fb79bcd5857235`.
  The incomplete `25.0.4` placeholder was rejected rather than guessed.
- Spring official project/system-requirement documentation and the official
  Spring Boot 4.1.0 dependency BOM support Boot `4.1.0` on Java 25 and pin the
  accepted Spring-managed PostgreSQL JDBC `42.7.11`, Flyway `12.4.0`, JUnit
  Jupiter `6.0.3` and Spring Framework `7.0.8` lines. Boot 4's official
  migration guidance requires the `spring-boot-starter-flyway` integration.
- Apache Maven official download/release/wrapper documentation supports Maven
  `3.9.16` and Wrapper `3.3.4` in `only-script` mode. The accepted Maven ZIP
  SHA-256 is
  `5af3b743dd8b876b5c45da33b676251e5f1687712644abb4ee519ca56e1d89ce`,
  derived only after the archive matched Apache's published SHA-512.
- The accepted explicit plugin pins are compiler `3.15.0`, surefire/failsafe
  `3.5.6`, enforcer `3.6.3` and CycloneDX `2.9.1`. The repository wrappers and
  bootstrap verify exact bytes/version and set Java only for the current
  process/children; they never use system Maven, Registry, `setx`, a package
  manager, global settings or machine `PATH` changes.
- PostgreSQL official locking/index/transaction behavior supports the single-
  owner request aggregate, structured parameterized search, one pending tuple,
  optimistic/advisory serialization, atomic audit/outbox/replay and
  transactional migration proof. It does not establish organization
  eligibility, availability, safety, endorsement or a match.
- OWASP authorization/logging guidance supports deny-by-default per-request
  decisions and allowlisted content-free operational evidence. W3C WCAG 2.2
  supplies the native keyboard/focus/reflow/status/target requirements; it does
  not replace manual assistive-technology evidence.

Kết luận / Conclusion: `P5-S1-v1` separates identity-free public directory
reads from fresh-purpose protected request operations; accepts only bounded
category/province-city/day-part/disclosure fields; freezes digest-bound
idempotency, duplicate/conflict/uncertain recovery, `pending -> closed ->
deleted`, 30-day close/purge and 365-day content-free evidence; and keeps
PostgreSQL as the only search engine. Community is the sole Spring/PostgreSQL
owner under ADR-019. The four synthetic Stitch references are design input
only; KI-019 remains.

Re-check on JDK/Spring/Maven/plugin upgrades; new request fields or location
granularity; eligibility/matching/moderation; public-directory import/crawl;
Elasticsearch/Redis/broker/object storage/cache/crypto; another Community
service; production deployment; legal/compliance or accessibility-conformance
claims. P5-S2 requires a new bounded micro-cycle and may not infer authority
from this review.
