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

If evidence changes the roadmap, the plan delta must be explicit and dated; do not rewrite history.
