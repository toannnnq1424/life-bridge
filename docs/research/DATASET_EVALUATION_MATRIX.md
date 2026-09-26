# Ma trận đánh giá nguồn / Dataset evaluation matrix

**Evaluated:** 2026-07-25
**Rule:** điểm cao không tự động cấp quyền sử dụng. Một blocker về license, privacy hoặc operational safety luôn thắng tổng điểm.

## Thang điểm / Scoring rubric

Mỗi tiêu chí chấm từ 0 đến 3:

| Code | Tiêu chí / Criterion | 0                        | 1                   | 2                            | 3                                    |
| ---- | -------------------- | ------------------------ | ------------------- | ---------------------------- | ------------------------------------ |
| A    | Authority            | unknown                  | secondary           | reputable partner            | authoritative producer/custodian     |
| V    | Viet Nam relevance   | none                     | global comparator   | Viet Nam partial             | Viet Nam national                    |
| T    | Temporal fit         | outside window           | baseline/stale      | 2019–2020 or mixed           | 2021–2026                            |
| L    | License clarity      | unknown/restrictive      | citation only       | conditional/public-use       | explicit open license                |
| M    | Machine readiness    | narrative/PDF only       | unstructured page   | downloadable structured data | stable documented API                |
| Q    | Quality metadata     | absent                   | limited             | method/definitions present   | method, version and provenance clear |
| P    | Privacy suitability  | direct sensitive records | high-risk microdata | aggregates with caveats      | non-personal aggregate/standard      |

Maximum score: 21. `P` measures suitability for repository use, not the social value of the source.

## Matrix

| ID    |   A |   V |   T |   L |   M |   Q |   P | Total | Fixture class | Blocker / Điều kiện                                             |
| ----- | --: | --: | --: | --: | --: | --: | --: | ----: | ------------- | --------------------------------------------------------------- |
| DS-01 |   3 |   3 |   3 |   3 |   3 |   3 |   3 |    21 | A             | Pin year/version and keep attribution                           |
| DS-02 |   3 |   3 |   2 |   1 |   1 |   3 |   3 |    16 | C             | 2019 reference; no explicit open-data license                   |
| DS-03 |   3 |   3 |   3 |   1 |   1 |   3 |   2 |    16 | B             | Dataset/reuse rights and machine-readable data not verified     |
| DS-04 |   3 |   3 |   3 |   2 |   2 |   3 |   1 |    17 | B             | High-risk microdata; approved aggregate-only analysis           |
| DS-05 |   3 |   3 |   1 |   1 |   1 |   3 |   2 |    14 | C             | Old baseline; UNICEF republication restriction                  |
| DS-06 |   3 |   3 |   3 |   1 |   2 |   3 |   1 |    16 | B/C           | Child/household microdata; external access workflow             |
| DS-07 |   3 |   3 |   3 |   3 |   3 |   3 |   3 |    21 | A             | National average only; pin source precision                     |
| DS-08 |   3 |   3 |   3 |   2 |   2 |   3 |   3 |    19 | C             | NC-SA and possible third-party terms                            |
| DS-09 |   3 |   1 |   3 |   3 |   3 |   3 |   3 |    19 | A conditional | Viet Nam indicator coverage not verified                        |
| DS-10 |   3 |   1 |   3 |   2 |   1 |   3 |   3 |    16 | C             | Global background, NC-SA                                        |
| DS-11 |   2 |   2 |   3 |   1 |   0 |   1 |   2 |    11 | C             | Programme story; not a directory/evaluation dataset             |
| DS-12 |   3 |   3 |   3 |   0 |   1 |   1 |   2 |    13 | C             | No license, stable IDs, completeness or update contract         |
| DS-13 |   3 |   3 |   3 |   0 |   1 |   1 |   2 |    13 | C             | All rights reserved; no alert-feed SLA; dynamic inconsistencies |
| DS-14 |   3 |   3 |   1 |   0 |   2 |   2 |   2 |    13 | C             | Ends 2019; reuse terms unclear                                  |
| DS-15 |   3 |   2 |   3 |   3 |   3 |   3 |   3 |    20 | C/standard    | Not a dataset; implement and test conformance                   |
| DS-16 |   3 |   2 |   3 |   1 |   2 |   3 |   1 |    15 | C/standard    | Not clinical; version/license check before any study            |
| DS-17 |   3 |   0 |   3 |   3 |   2 |   3 |   3 |    17 | C             | No Viet Nam estimate; methodology not transferable              |
| DS-18 |   3 |   1 |   3 |   1 |   1 |   3 |   3 |    15 | C/standard    | No confirmed Viet Nam HFML                                      |
| DS-19 |   3 |   3 |   2 |   1 |   1 |   3 |   2 |    15 | C             | Policy research; no current beneficiary/eligibility data        |

## Quyết định sử dụng / Use decision

### Approved candidates for a small aggregate fixture

| ID    | Allowed in a future slice                                                | Required provenance                                                                                                |
| ----- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| DS-01 | A frozen 2016–2024 age-65+ national series or two comparison points      | indicator code, unit, year, value, source organization, URL, retrieval date, CC BY 4.0                             |
| DS-07 | A frozen 2016–2024 Internet-use national series or two comparison points | indicator code, unit, precision, year, value, original ITU attribution through WDI, URL, retrieval date, CC BY 4.0 |
| DS-09 | Only a verified Viet Nam aggregate, after a targeted source check        | WHO indicator ID, dimensions, reference period, dataset owner, dataset-specific terms and query timestamp          |

Không được đưa các con số này vào logic xếp hạng rủi ro cá nhân. Chúng chỉ hỗ trợ context/demo visualization.

These values must not drive individual risk ranking. They are contextual/demo aggregates only.

### Approved only for aggregate derivation in a research sandbox

| ID    | Narrow research purpose                                                | Exit artifact                                                                        | Forbidden                                                             |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| DS-04 | Broad time-use/care-work distribution for synthetic workload scenarios | disclosure-checked aggregate ranges plus query notebook/hash outside product runtime | respondent rows, rare cross-tabs, household linkage, raw files in Git |
| DS-03 | Care-needs taxonomy from published analysis                            | manually reviewed concept map and citations                                          | table scraping, reconstructed respondent records                      |
| DS-06 | Validate inclusive scenario coverage                                   | published indicator or disclosure-safe aggregate with explicit access record         | child-level data, record copying, proxy profiling                     |

### Background-only

DS-02, DS-05, DS-08 and DS-10–DS-19 remain background, measurement or product-safety references. Their facts may be cited with attribution, but their records, tables, images and named cases are not fixture content.

## Operational safety gates

Một source không được chuyển từ C/B sang operational connector nếu chưa đạt tất cả:

1. explicit data/API terms permit the planned commercial/non-commercial use;
2. stable identifiers and documented schema/versioning;
3. named steward and update cadence;
4. `observed_at`, `published_at`, `retrieved_at` and expiry semantics;
5. outage, stale-data and contradictory-source behavior;
6. data minimization and access-control review;
7. threat model and abuse cases;
8. Vietnamese legal review for production processing;
9. user-facing attribution and correction channel;
10. targeted integration tests plus a safe fallback.

For emergency data, also require a formal source SLA, fail-closed UX and an explicit statement that LifeBridge does not replace official emergency services.

## Phase revisit triggers

| Trigger                                 | Re-evaluate                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| A new care-recommendation slice         | DS-03, DS-04, DS-09, GOV-01                                                         |
| A disability/access-needs profile slice | DS-05, DS-06, DS-10, DS-16, GOV-01                                                  |
| A community service finder slice        | DS-11, DS-12, DS-18, license and freshness                                          |
| An emergency-awareness slice            | DS-13, DS-14, formal operational sources and safety case                            |
| A digital-inclusion dashboard           | DS-07, DS-08 and disaggregated-data gap                                             |
| Any production deployment               | all active sources, GOV-01, GOV-02, current implementing rules                      |
| Any source schema/method revision       | dependent fixture version, API contract, tests, implementation plan and session log |

## Go / no-go snapshot

- **GO:** deterministic synthetic fixture design; cited source registry; aggregate-only prototype charts from DS-01/DS-07 after exact snapshot creation.
- **CONDITIONAL:** DS-04 research analysis; WHO long-term-care aggregates; any user-facing public-data visualization.
- **NO-GO:** real household/care records in Git; scraped facility referrals; live disaster routing; child/disability microdata in runtime; inference of individual needs from national statistics.
