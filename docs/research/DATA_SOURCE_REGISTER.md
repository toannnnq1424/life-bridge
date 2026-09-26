# Sổ đăng ký nguồn dữ liệu / Data source register

**Snapshot:** 2026-07-25
**Window:** 2016–2026; ưu tiên / priority 2021–2026
**Scope:** ageing, disability, caregiving, digital inclusion, community services, emergency context and accessibility.

## Cách đọc / How to read

`Fixture class` có ba mức:

- **A — aggregate-ready:** có thể nhập một tập chỉ số tổng hợp nhỏ sau khi pin kỳ tham chiếu, lưu attribution và kiểm tra lại license.
- **B — derive-only:** không commit dữ liệu gốc; chỉ dùng phân tích đã được phê duyệt để tạo tham số hoặc kịch bản synthetic, kèm provenance.
- **C — background-only:** chỉ định hình yêu cầu, glossary, risk hoặc UX. Không dùng số liệu/bản ghi làm fixture.

Không có nguồn nào dưới đây cho phép đưa PII thật, thông tin sức khỏe cá nhân, record trẻ em, địa chỉ hộ gia đình, hay danh bạ cứu hộ đang hoạt động vào Git.

## Tổng quan / Coverage summary

| ID     | Chủ đề / Theme                  | Source                                                 | Reference / publication               | Geography                       | Fixture class | Trạng thái / Status                   |
| ------ | ------------------------------- | ------------------------------------------------------ | ------------------------------------- | ------------------------------- | ------------- | ------------------------------------- |
| DS-01  | Ageing                          | World Bank WDI: population age 65+                     | 2016–2024 series                      | Viet Nam                        | A             | Candidate                             |
| DS-02  | Ageing                          | GSO/UNFPA 2019 Census ageing monograph                 | 2009, 2019 / 2021                     | Viet Nam                        | C             | Background                            |
| DS-03  | Ageing, care                    | GSO/UNFPA Older Persons Survey analysis                | 2021 / 2022                           | Viet Nam                        | B             | Candidate after rights check          |
| DS-04  | Caregiving                      | World Bank/GSO Time-Use Survey                         | 2022–2023 / 2023 catalog              | Viet Nam, 6 regions             | B             | Strong research candidate             |
| DS-05  | Disability                      | GSO/UNICEF National Survey on People with Disabilities | 2016–2017 / 2018                      | Viet Nam                        | C             | Ten-year baseline                     |
| DS-06  | Disability, children, inclusion | UNICEF MICS6                                           | 2020–2021 / 2023 catalog              | Viet Nam                        | B             | Restricted workflow                   |
| DS-07  | Digital inclusion               | World Bank WDI: individuals using Internet             | 2016–2024 series                      | Viet Nam                        | A             | Candidate                             |
| DS-08  | Digital inclusion               | ITU DataHub                                            | rolling; latest displayed 2024        | Viet Nam/global                 | C             | License is non-commercial/share-alike |
| DS-09  | Long-term care                  | WHO GHO long-term-care indicators                      | rolling                               | Global; country coverage varies | A conditional | Viet Nam coverage not verified        |
| DS-10  | Disability equity               | WHO global disability equity report                    | 2022                                  | Global                          | C             | Background                            |
| DS-11  | Community care                  | UNFPA/HelpAge ISHC implementation story                | 2023                                  | Viet Nam/Thanh Hoa              | C             | Background, not a directory           |
| DS-12  | Community/health services       | Ministry of Health telehealth facility list            | 2024                                  | Viet Nam                        | C             | Dynamic; rights/structure unclear     |
| DS-13  | Emergency context               | DMC disaster information catalog and VNDMS             | 2016–2026, rolling                    | Viet Nam                        | C             | Never an emergency routing source     |
| DS-14  | Disaster history                | UNDRR DesInventar profile                              | 1989–2019; use only 2016–2019         | Viet Nam                        | C             | Stale historical comparator           |
| DS-15  | Accessibility                   | W3C WCAG 2.2                                           | 2023; republished 2024                | Global web standard             | C             | Normative product requirement         |
| DS-16  | Disability measurement          | Washington Group question sets                         | current site; Vietnamese translations | Global                          | C             | Measurement reference only            |
| DS-17  | Caregiving comparator           | OECD Health at a Glance: informal carers               | 2021–2022 / 2025                      | OECD members                    | C             | No Viet Nam estimate                  |
| DS-18  | Service-directory design        | WHO Geolocated Health Facilities initiative            | 2022–2026                             | Global                          | C             | Viet Nam HFML not found               |
| DS-19  | Social protection               | UNICEF GRASSP Viet Nam                                 | reform 2015–2021 / 2024               | Viet Nam                        | C             | Policy background                     |
| GOV-01 | Governance                      | Viet Nam Personal Data Protection Law 91/2025/QH15     | effective 2026                        | Viet Nam                        | n/a           | Mandatory legal review input          |
| GOV-02 | Governance                      | Viet Nam Data Law 60/2024/QH15                         | effective 2025                        | Viet Nam                        | n/a           | Mandatory legal review input          |

## Source cards

### DS-01 — World Bank WDI: Population ages 65 and above, total

- **Publisher / origin:** World Bank World Development Indicators; source metadata credits UN Population Division's World Population Prospects and World Bank staff estimates.
- **Geography:** Viet Nam, national.
- **Reference / publication:** annual series; reviewed for 2016–2024. Portal currently exposes 2024 as a recent completed point.
- **Retrieved:** 2026-07-25.
- **URL:** https://data.worldbank.org/indicator/SP.POP.65UP.TO?locations=VN
- **License / terms:** indicator page states **CC BY 4.0**. Attribution and source metadata must travel with any extracted value.
- **Intended use:** ageing context; a small pinned aggregate series for demo charts; fixture parameter ranges.
- **Limitations:** national total hides functional need, income, gender, province and household structure; estimates can be revised. It is not a count of people needing care.
- **Privacy / sensitivity:** aggregate and low privacy risk; age remains a protected/sensitive dimension when joined to individual records.
- **Freshness:** annual; verify source update and observation status before each release.
- **Fixture class:** **A** for a pinned, attributed aggregate only.

### DS-02 — Population Ageing and Older Persons in Viet Nam

- **Publisher:** General Statistics Office of Viet Nam (GSO), with UNFPA technical assistance.
- **Geography:** Viet Nam; analysis includes national and demographic breakdowns.
- **Reference / publication:** Population and Housing Censuses 2009 and 2019; issued 2021-08-26.
- **Retrieved:** 2026-07-25.
- **URL:** https://www.gso.gov.vn/en/data-and-statistics/2021/08/population-ageing-and-older-persons-in-viet-nam/
- **License / terms:** no explicit open-data license was found on the publication page during this review. Cite/link; do not rehost tables or figures without permission.
- **Intended use:** domain baseline, terminology, demographic trend context and validation of product assumptions.
- **Limitations:** primary reference year is 2019; not current operational data and not individual care-need data.
- **Privacy / sensitivity:** published aggregates; low privacy risk.
- **Freshness:** baseline; check for a newer census monograph at phase/release boundaries.
- **Fixture class:** **C**.

### DS-03 — Older Persons in Viet Nam: analysis of the 2021 Population Change and Family Planning Survey

- **Publisher:** GSO; hosted by UNFPA Viet Nam.
- **Geography:** Viet Nam, national survey.
- **Reference / publication:** survey 2021; publication 2022-09-27.
- **Retrieved:** 2026-07-25.
- **URL:** https://vietnam.unfpa.org/en/publications/older-persons-viet-nam-analysis-population-change-and-family-planning-survey-2021
- **License / terms:** UNFPA site terms permit attributed extracts for research/private study and non-commercial use; substantial reproduction or other use requires prior authorization: https://www.unfpa.org/terms-use
- **Intended use:** care-needs taxonomy, socioeconomic context, and synthetic scenario proportions after manual review.
- **Limitations:** self-reported survey data; report aggregates cannot identify an individual's needs. Full reusable machine-readable data and a dataset-specific license were not found.
- **Privacy / sensitivity:** ageing, health and care need are sensitive when individualised.
- **Freshness:** useful 2021 baseline; look for a newer older-person module before implementing care recommendation logic.
- **Fixture class:** **B**, but only derived synthetic parameters; no copied rows/tables.

### DS-04 — Viet Nam Time-Use Survey 2022

- **Publisher / producer:** World Bank; GSO listed as producer; field collection 2022-10-13 to 2023-01-10.
- **Geography:** six socioeconomic regions of Viet Nam; 6,000 respondents aged 15–64 in the documented target universe.
- **Reference / publication:** 2022–2023; catalog created 2023-05-22.
- **Retrieved:** 2026-07-25.
- **URL:** https://microdata.worldbank.org/catalog/5844/study-description
- **License / terms:** catalog labels the anonymized v2.1 as **Public Use Files** and requires dataset citation. This is an access condition, not permission to commit the microdata into this repository.
- **Intended use:** research on unpaid household work and time spent caring for children/older people; derive broad synthetic workload distributions in an isolated, approved analysis.
- **Limitations:** target universe excludes people outside 15–64 and those unable to participate; mixed sample frame; regional rather than province-level; public-use anonymization does not eliminate re-identification risk.
- **Privacy / sensitivity:** household and individual microdata; **high**. Raw files stay outside Git and production.
- **Freshness:** strong recent caregiving source; recheck catalog revision/date before analysis.
- **Fixture class:** **B** after data-owner approval, documented query, disclosure review and aggregate-only export.

### DS-05 — National Survey on People with Disabilities 2016–2017

- **Publisher:** GSO and UNICEF Viet Nam.
- **Geography:** Viet Nam; household sample and review of social-protection/care facilities.
- **Reference / publication:** fieldwork 2016–2017; report 2018-11.
- **Retrieved:** 2026-07-25.
- **URLs:** https://www.unicef.org/vietnam/reports/children-disabilities-viet-nam and https://www.unicef.org/vietnam/media/2786/file/Main%20report%20people%20with%20disabilities%20survey.pdf
- **License / terms:** UNICEF reserves copyright and requires prior written permission for mirroring/republication: https://www.unicef.org/legal
- **Intended use:** ten-year baseline; understand functional-domain measurement and structural barriers.
- **Limitations:** oldest boundary of the evidence window; not suitable for current prevalence claims without a newer corroborating source. Child findings require extra care.
- **Privacy / sensitivity:** disability and child data are highly sensitive; only published aggregates may be cited.
- **Freshness:** baseline only; search for a successor national survey before a disability-focused phase.
- **Fixture class:** **C**.

### DS-06 — Viet Nam Multiple Indicator Cluster Survey 2020–2021 (MICS6)

- **Publisher:** UNICEF; World Bank Microdata Library documents metadata.
- **Geography:** Viet Nam; household and individual files.
- **Reference / publication:** data collection 2020–2021; catalog metadata 2023.
- **Retrieved:** 2026-07-25.
- **URL:** https://microdata.worldbank.org/catalog/5956/study-description
- **License / terms:** microdata are obtained through the external UNICEF MICS workflow; citation is required. UNICEF copyright and access terms apply. No files are authorized for repository inclusion.
- **Intended use:** validate inclusive-design assumptions, child functioning measures, social protection and digital-access context using published aggregates or approved analysis.
- **Limitations:** household survey methodology and module-specific denominators; not a caregiver scheduling dataset; pandemic-period context may affect comparability.
- **Privacy / sensitivity:** children, disability, household composition and socioeconomic status; **very high**.
- **Freshness:** 2020–2021 reference; check for a newer round.
- **Fixture class:** **B** only for approved aggregate derivation; otherwise C.

### DS-07 — World Bank WDI: Individuals using the Internet (% of population)

- **Publisher / origin:** World Bank WDI; source metadata credits ITU World Telecommunication/ICT Indicators.
- **Geography:** Viet Nam, national.
- **Reference / publication:** reviewed for 2016–2024; 2024 value displayed by the portal.
- **Retrieved:** 2026-07-25.
- **URL:** https://data.worldbank.org/indicator/IT.NET.USER.ZS?locations=VN
- **License / terms:** indicator page states **CC BY 4.0**.
- **Intended use:** high-level digital-inclusion trend and offline/low-bandwidth product requirements; small attributed aggregate series.
- **Limitations:** “uses the Internet” does not measure affordability, device ownership, digital skill, accessibility, reliability or older-person use. National average can conceal exclusion.
- **Privacy / sensitivity:** aggregate, low privacy risk.
- **Freshness:** annual; verify revisions before release.
- **Fixture class:** **A**.

### DS-08 — ITU DataHub and Viet Nam digital-development dashboard

- **Publisher:** International Telecommunication Union (ITU).
- **Geography:** Viet Nam and global comparison.
- **Reference / publication:** rolling database; Viet Nam Internet-use view displayed 2024 data during review.
- **Retrieved:** 2026-07-25.
- **URLs:** https://datahub.itu.int/data/?e=VNM&i=11624&v=chart and https://beta.datahub.itu.int/about/
- **License / terms:** ITU DataHub states **CC BY-NC-SA 3.0 IGO**, with separate owner terms for third-party data. Non-commercial and share-alike constraints make direct product embedding unsuitable without legal review.
- **Intended use:** primary-source cross-check for WDI digital indicators and methodology.
- **Limitations:** national aggregates; third-party ownership may differ by indicator; continuously revised.
- **Privacy / sensitivity:** aggregate, low privacy risk.
- **Freshness:** rolling; record access date on every use.
- **Fixture class:** **C** for Phase 0; prefer DS-07 for an openly licensed demo aggregate.

### DS-09 — WHO GHO: long-term care for older people

- **Publisher:** World Health Organization.
- **Geography:** global; availability varies by indicator and Member State.
- **Reference / publication:** rolling indicators; no single reference year.
- **Retrieved:** 2026-07-25.
- **URLs:** https://www.who.int/data/gho/data/themes/topics/topic-details/mca/ageing---long-term-care-for-older-people and https://data.who.int/about/data/terms-and-conditions
- **License / terms:** WHO datasets on `data.who.int` are generally **CC BY 4.0** unless a dataset credits another owner; dataset-specific metadata controls.
- **Intended use:** common long-term-care indicator definitions and, if present, attributed Viet Nam aggregates.
- **Limitations:** Phase 0 did not verify which indicators have Viet Nam observations or comparable reference periods. Missing data must remain missing.
- **Privacy / sensitivity:** aggregate; underlying national sources may have different terms.
- **Freshness:** query at implementation time and pin the retrieved snapshot.
- **Fixture class:** **A conditional**; blocked until coverage and dataset-specific terms are verified.

### DS-10 — WHO Global report on health equity for persons with disabilities

- **Publisher:** World Health Organization.
- **Geography:** global.
- **Reference / publication:** 2022-12-02.
- **Retrieved:** 2026-07-25.
- **URL:** https://www.who.int/publications/i/item/9789240063600
- **License / terms:** **CC BY-NC-SA 3.0 IGO**; non-commercial, attribution and share-alike apply.
- **Intended use:** inclusive product principles, barrier taxonomy and risk review.
- **Limitations:** global evidence is not a Viet Nam prevalence estimate and cannot support individual classification.
- **Privacy / sensitivity:** published synthesis; low direct privacy risk.
- **Freshness:** strategic background; review for successor reports every phase boundary involving disability.
- **Fixture class:** **C**.

### DS-11 — Intergenerational Self-Help Clubs (ISHC) implementation evidence

- **Publisher:** UNFPA Viet Nam; collaboration described with HelpAge International Viet Nam and local partners.
- **Geography:** Viet Nam, with Thanh Hoa implementation detail.
- **Reference / publication:** programme facts reported in 2023.
- **Retrieved:** 2026-07-25.
- **URL:** https://vietnam.unfpa.org/en/news/friend-need-friend-deed
- **License / terms:** UNFPA terms allow cited non-commercial research extracts; substantial reuse needs authorization.
- **Intended use:** evidence that community-based, intergenerational support and referral are relevant concepts; inform synthetic roles and service categories.
- **Limitations:** programme story, not a complete audited national directory or evaluation dataset; counts can change.
- **Privacy / sensitivity:** article includes human stories; do not reproduce names, photos or personal narratives in fixtures.
- **Freshness:** recheck before making current programme-count claims.
- **Fixture class:** **C**.

### DS-12 — Ministry of Health list of telehealth facilities

- **Publisher:** Viet Nam Ministry of Health electronic medical-record portal.
- **Geography:** Viet Nam.
- **Reference / publication:** page dated 2024-07-19.
- **Retrieved:** 2026-07-25.
- **URL:** https://benhandientu.moh.gov.vn/tin-tuc/danh-sach-cac-csyt-kham-chua-benh-tu-xa
- **License / terms:** no explicit dataset license or machine-readable contract was found.
- **Intended use:** confirm service-directory fields and the need for source/date/status labels; not for navigation or referral.
- **Limitations:** unstructured list, update cadence and completeness unclear, no verified coordinates or service-level availability.
- **Privacy / sensitivity:** organizational names are public; operational contact/availability can still become safety-critical.
- **Freshness:** must be revalidated with the facility/source before any user-facing referral.
- **Fixture class:** **C**; synthetic facilities only.

### DS-13 — DMC disaster catalog and Vietnam Disaster Monitoring System (VNDMS)

- **Publisher:** Disaster Management Policy and Technology Center / Viet Nam disaster-management authority.
- **Geography:** Viet Nam, national and subnational events.
- **Reference / publication:** catalog contains records across 2016–2026 and is updated dynamically.
- **Retrieved:** 2026-07-25.
- **URLs:** https://dmc.gov.vn/thong-tin-thien-tai-pt32.html?lang=vi-VN and https://vndms.gov.vn/
- **License / terms:** DMC page states all rights reserved; no reusable data/API license was found. VNDMS privacy notice is not a data-reuse license.
- **Intended use:** emergency-context taxonomy, stale-data UX and synthetic alert scenarios.
- **Limitations:** dynamic pages showed changing totals across crawls; records may be duplicated, incomplete or retrospective. This is not a guaranteed emergency alert feed.
- **Privacy / sensitivity:** locations and active hazards are safety-critical. User location must never be joined without consent, necessity and strict retention.
- **Freshness:** live operational use would require a formal API/data agreement, source SLA, timestamp validation, outage handling and official escalation copy.
- **Fixture class:** **C**. **Never use this registry snapshot to route an emergency.**

### DS-14 — UNDRR DesInventar Viet Nam profile

- **Publisher:** United Nations Office for Disaster Risk Reduction (UNDRR) DesInventar.
- **Geography:** Viet Nam, subnational historical loss records.
- **Reference / publication:** profile covers 1989–2019; only 2016–2019 intersects this project's evidence window.
- **Retrieved:** 2026-07-25.
- **URL:** https://desinventar-api.undrr.org/DesInventar/profiletab.jsp?continue=y&countrycode=vnm
- **License / terms:** reuse terms were not clearly exposed on the profile page during review; do not redistribute extracts.
- **Intended use:** historical event/loss taxonomy and completeness comparison with national sources.
- **Limitations:** stale for current risk; historical collection practices vary; not an alert system.
- **Privacy / sensitivity:** aggregate/event level, but small-place events can be sensitive.
- **Freshness:** frozen historical comparator.
- **Fixture class:** **C**.

### DS-15 — Web Content Accessibility Guidelines (WCAG) 2.2

- **Publisher:** World Wide Web Consortium (W3C).
- **Geography:** global web standard.
- **Reference / publication:** W3C Recommendation 2023-10-05; republished with errata 2024-12-12.
- **Retrieved:** 2026-07-25.
- **URL:** https://www.w3.org/TR/WCAG22/
- **License / terms:** W3C document use and royalty-free implementation terms apply; this is a standard, not a dataset.
- **Intended use:** target **WCAG 2.2 AA** for LifeBridge flows, including keyboard/focus, target size, consistent help, error prevention and accessible authentication.
- **Limitations:** conformance does not cover every user need; test with people and assistive technologies.
- **Privacy / sensitivity:** no personal data.
- **Freshness:** check errata and successor status at phase/release validation.
- **Fixture class:** **C**, normative product requirement.

### DS-16 — Washington Group disability question sets and Vietnamese translations

- **Publisher:** Washington Group on Disability Statistics under the UN statistical system.
- **Geography:** cross-national; Vietnamese translations are available.
- **Reference / publication:** current online tools; WG Short Set Enhanced documentation available in the 2021–2022 period and maintained online.
- **Retrieved:** 2026-07-25.
- **URLs:** https://www.washingtongroup-disability.com/question-sets/ and https://www.washingtongroup-disability.com/resources/translations-of-wg-question-sets/
- **License / terms:** tools are downloadable, but no explicit repository-reuse license was confirmed in Phase 0. Link to originals; do not copy questionnaire text wholesale.
- **Intended use:** respectful functional-domain vocabulary and comparability review if research questions are ever designed.
- **Limitations:** survey measurement tools are not clinical screening, diagnosis, entitlement criteria or user-profile defaults.
- **Privacy / sensitivity:** responses about functioning are sensitive personal data.
- **Freshness:** verify exact version and translation before any study.
- **Fixture class:** **C**.

### DS-17 — OECD Health at a Glance 2025: informal carers

- **Publisher:** Organisation for Economic Co-operation and Development.
- **Geography:** OECD member/comparator countries; no Viet Nam estimate.
- **Reference / publication:** observations mainly 2021–2022; publication 2025.
- **Retrieved:** 2026-07-25.
- **URL:** https://www.oecd.org/en/publications/health-at-a-glance-2025_8f9e3f98-en/full-report/informal-carers_6f243c4d.html
- **License / terms:** OECD content published after 2024-07-01 is generally **CC BY 4.0**, subject to page-specific and third-party notices: https://www.oecd.org/en/about/oecd-open-by-default-policy.html
- **Intended use:** compare concepts such as informal carer, daily care and carers who also work.
- **Limitations:** different survey instruments and country systems; cannot be transferred numerically to Viet Nam.
- **Privacy / sensitivity:** aggregate.
- **Freshness:** recent comparator; check methodology before citing.
- **Fixture class:** **C**.

### DS-18 — WHO Geolocated Health Facilities Data initiative

- **Publisher:** World Health Organization.
- **Geography:** global initiative.
- **Reference / publication:** initiative Q&A 2022; current programme target extends to 2027.
- **Retrieved:** 2026-07-25.
- **URL:** https://www.who.int/data/GIS/GHFD
- **License / terms:** programme description is public; no Viet Nam master-list dataset or dataset-specific license was found in Phase 0.
- **Intended use:** service-directory contract fields: authoritative facility ID, official name, type, location, active/prior status, steward and `last_verified_at`.
- **Limitations:** initiative description is not evidence that a Viet Nam HFML is currently downloadable.
- **Privacy / sensitivity:** facility records are organizational, but routing and service availability are safety-critical.
- **Freshness:** verify country participation and official Ministry source before implementation.
- **Fixture class:** **C**.

### DS-19 — UNICEF GRASSP Viet Nam: gender-responsive social assistance

- **Publisher:** UNICEF Innocenti / UNICEF Viet Nam, in collaboration with Viet Nam social-policy stakeholders.
- **Geography:** Viet Nam.
- **Reference / publication:** reform period 2015–2021; report 2024.
- **Retrieved:** 2026-07-25.
- **URL:** https://www.unicef.org/innocenti/reports/grassp-viet-nam
- **License / terms:** UNICEF copyright applies; permission required for republication.
- **Intended use:** understand social-assistance pathways, gendered care burden and the need to avoid assuming one household member is the default caregiver.
- **Limitations:** policy research, not a current beneficiary registry or eligibility engine; policy rules may have changed after the study.
- **Privacy / sensitivity:** examples may involve vulnerable households; never copy cases into fixtures.
- **Freshness:** verify current law/program rules before any benefits-navigation feature.
- **Fixture class:** **C**.

## Governance sources

### GOV-01 — Luật Bảo vệ dữ liệu cá nhân / Personal Data Protection Law

- **Authority:** Quốc hội Việt Nam / National Assembly of Viet Nam.
- **Instrument:** Law 91/2025/QH15, issued 2025-06-26, effective 2026-01-01.
- **Retrieved:** 2026-07-25.
- **URL:** https://vanban.chinhphu.vn/?classid=1&docid=214590&pageid=27160&typegroup=
- **Use:** mandatory input to legal review for consent, purpose limitation, health data, children, processors and data-subject rights.
- **Caveat:** this register is not legal advice. Obtain qualified Vietnamese counsel before production processing.

### GOV-02 — Luật Dữ liệu / Data Law

- **Authority:** Quốc hội Việt Nam / National Assembly of Viet Nam.
- **Instrument:** Law 60/2024/QH15, issued 2024-11-30, effective 2025-07-01.
- **Retrieved:** 2026-07-25.
- **URL:** https://vanban.chinhphu.vn/?classid=1&docid=212488&pageid=27160
- **Use:** mandatory input to production data-governance, processing, sharing, transfer, security and public/open-data review.
- **Caveat:** implementing instruments and sector rules must be checked at the time of deployment.

## Snapshot facts / Sự kiện đã kiểm chứng

1. **FACT:** WDI shows Viet Nam's population age 65+ increasing from **6,212,245 in 2016** to **9,136,541 in 2024** in the currently published series. Source: DS-01.
2. **FACT:** The World Bank country portal displays **84%** of Viet Nam's population using the Internet for 2024; ITU's source view displays **84.2%**. The different precision must not be presented as disagreement. Sources: DS-07 and DS-08.
3. **FACT:** The 2021 GSO survey introduced a module on older persons' situation and care needs, published in 2022. Source: DS-03.
4. **FACT:** The 2022 Time-Use Survey explicitly covers unpaid work including care of children and older people and documents an anonymized public-use version. Source: DS-04.
5. **FACT:** Viet Nam's 2016–2017 national disability survey used Washington Group and UNICEF functioning tools. Source: DS-05.
6. **FACT:** WCAG 2.2 is a W3C Recommendation and adds requirements relevant to accessible authentication, focus, target size, consistent help and redundant entry. Source: DS-15.

## Inferences / Suy luận

1. **INFERENCE:** The DS-01 series implies an increase of about **47%** in the age-65+ total from 2016 to 2024. This is a project calculation, not a quoted World Bank conclusion, and does not estimate care demand.
2. **INFERENCE:** High national Internet use does not remove the need for offline-tolerant, low-bandwidth and assisted flows because DS-07 lacks age, ability, device, affordability and skills detail.
3. **INFERENCE:** Household coordination should model multiple caregivers and handoffs rather than assigning care work by gender; DS-04 and DS-19 support treating care burden as a product-risk dimension.
4. **INFERENCE:** Community service and disaster sources are not yet contract-safe for operational recommendations. The MVP should use clearly labelled synthetic directory/alert records.

## Missing evidence / Còn thiếu

- A recent, nationally representative Viet Nam disability survey after 2016–2017.
- A current, open, authoritative Viet Nam health/social-service master list with stable IDs, coordinates, update cadence and reuse license.
- A formal, documented emergency-alert API with availability/freshness SLA and explicit reuse terms.
- Verified Viet Nam observations in the WHO long-term-care indicator set.
- Recent nationally representative digital-inclusion data disaggregated jointly by age, disability, rurality, device access, affordability and digital skills.
- Dataset-specific authorization for any microdata analysis intended to influence production logic.
- Qualified legal interpretation of Laws 91/2025/QH15 and 60/2024/QH15 for the final architecture and hosting geography.

## Recommendations / Khuyến nghị

1. Freeze only DS-01 and DS-07 aggregate snapshots for a Phase 1 research fixture, preserving exact indicator code, year, value, unit, source URL, retrieval date and license.
2. Use DS-04 only in a separate approved research workstream; export disclosure-checked aggregates, never respondent rows.
3. Keep DS-05, DS-06 and DS-19 as background until a privacy/ethics review approves a specific research question.
4. Use synthetic community facilities and alerts until DS-12/DS-13/DS-18 have stable contracts and operational safety controls.
5. Treat WCAG 2.2 AA as an acceptance criterion for every UI slice, not a final-phase audit item.
6. Re-run the source review at every phase boundary that introduces a new data category, and record any phase change in both research and implementation documentation.
