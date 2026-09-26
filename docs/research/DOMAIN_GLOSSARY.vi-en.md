# Thuật ngữ miền Việt–Anh / Vietnamese–English domain glossary

**Version:** Phase 0, 2026-07-25

Ngôn ngữ ưu tiên con người, trung tính và không chẩn đoán. Khi một nguồn dùng ngưỡng tuổi hoặc định nghĩa khác, API/UI phải hiển thị định nghĩa của chính nguồn đó.

Use person-first, neutral and non-diagnostic language. When a source uses a different age threshold or definition, the API/UI must expose that source-specific definition.

## People and relationships / Con người và quan hệ

| Tiếng Việt                      | English                    | Định nghĩa dùng trong LifeBridge / LifeBridge definition                                                                                             |
| ------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thành viên hộ gia đình          | Household member           | A person participating in a household space. Membership does not grant access to every record.                                                       |
| Người được hỗ trợ               | Supported person           | A person who chooses or needs coordination support. Prefer this over “patient” outside a clinical context.                                           |
| Người hỗ trợ chăm sóc           | Care partner               | A person who coordinates or provides support with the supported person's knowledge/authority where required.                                         |
| Người chăm sóc không chính thức | Informal caregiver / carer | Family member, friend or community member providing unpaid or informally arranged care. This label says nothing about competence or legal authority. |
| Người chăm sóc chính thức       | Formal care worker         | A paid worker providing care within a professional or service arrangement. Credentials and scope must be verified externally.                        |
| Điều phối viên hộ gia đình      | Household coordinator      | A scoped application role that manages agreed schedules/tasks. It is not automatically the household head or a legal guardian.                       |
| Người giám hộ                   | Guardian                   | A legal status that must not be inferred from family relationship or app role.                                                                       |
| Tình nguyện viên cộng đồng      | Community volunteer        | A person offering scoped support through a community programme. Verification and safeguarding are required before real matching.                     |
| Người cao tuổi                  | Older person               | Source-dependent. Viet Nam sources often analyse age 60+, while DS-01 is specifically age 65+. Never mix thresholds silently.                        |
| Trẻ em                          | Child                      | A legally and ethically protected group. Exact legal age and guardian requirements require jurisdiction-specific review.                             |

## Care and coordination / Chăm sóc và điều phối

| Tiếng Việt                                       | English                                        | Định nghĩa dùng trong LifeBridge / LifeBridge definition                                                                                         |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nhiệm vụ chăm sóc                                | Care task                                      | A bounded, user-understood action with owner, due window, status and visibility scope. It is not a medical order.                                |
| Kế hoạch hỗ trợ                                  | Support plan                                   | A coordinated set of goals/tasks agreed by authorized participants. Avoid “treatment plan” unless integrated with a regulated clinical workflow. |
| Bàn giao                                         | Handoff                                        | Transfer of task responsibility with acknowledgement, context and audit trail.                                                                   |
| Nhu cầu hỗ trợ                                   | Support need                                   | A user-stated or authorized requirement; not a diagnosis inferred by the system.                                                                 |
| Sắp xếp chăm sóc                                 | Care arrangement                               | Who provides what support, where/when, under what authority and fallback.                                                                        |
| Chăm sóc dài hạn                                 | Long-term care (LTC)                           | Ongoing services/support that help a person maintain functional ability and dignity; not synonymous with institutional care.                     |
| Hoạt động sinh hoạt hằng ngày                    | Activities of daily living (ADL)               | A measurement concept for basic daily activities. Use only with a named instrument/definition; do not turn it into a diagnosis.                  |
| Hoạt động sinh hoạt hằng ngày có sử dụng công cụ | Instrumental activities of daily living (IADL) | A measurement concept for more complex daily activities. Source-specific definitions vary.                                                       |
| Chăm sóc thay thế tạm thời                       | Respite care                                   | Time-limited support intended to give a regular caregiver a break. Availability and eligibility must be verified.                                |
| Gánh nặng chăm sóc                               | Care burden                                    | Time, financial, physical or emotional load associated with caregiving. Do not use as a label for a person or family.                            |
| Công việc chăm sóc không lương                   | Unpaid care work                               | Care/domestic work performed without pay; measurement depends on survey definitions and time-use methods.                                        |

## Disability and accessibility / Khuyết tật và khả năng tiếp cận

| Tiếng Việt            | English                  | Định nghĩa dùng trong LifeBridge / LifeBridge definition                                                                                                                                 |
| --------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Người khuyết tật      | Person with disability   | A person who may experience participation barriers through the interaction of functional differences and an unaccommodating environment. Do not infer from appearance or a single field. |
| Khó khăn về chức năng | Functional difficulty    | Self/proxy-reported difficulty in a defined domain under a named measurement tool; not a clinical diagnosis.                                                                             |
| Lĩnh vực chức năng    | Functional domain        | A measured area such as seeing, hearing, mobility, cognition, self-care or communication, depending on the instrument.                                                                   |
| Điều chỉnh phù hợp    | Reasonable accommodation | A change that supports equal participation without imposing an unjustifiable burden; legal meaning requires review.                                                                      |
| Khả năng tiếp cận     | Accessibility            | Extent to which people with diverse abilities can perceive, understand, navigate and operate a product/service.                                                                          |
| Công nghệ hỗ trợ      | Assistive technology     | Hardware/software that supports functioning, such as a screen reader or alternative input. Never assume what a user uses.                                                                |
| Ngôn ngữ đơn giản     | Plain language           | Content designed to be understood on first reading; not childish or imprecise language.                                                                                                  |
| WCAG 2.2 AA           | WCAG 2.2 AA              | LifeBridge's web conformance target for every UI slice, with human and assistive-technology testing in addition to automation.                                                           |

## Services, community and emergencies / Dịch vụ, cộng đồng và khẩn cấp

| Tiếng Việt                    | English                      | Định nghĩa dùng trong LifeBridge / LifeBridge definition                                                                                                 |
| ----------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dịch vụ cộng đồng             | Community service            | A non-emergency public, nonprofit or local service. Listing is not endorsement or proof of current availability.                                         |
| Danh mục cơ sở dịch vụ chuẩn  | Service facility master list | Authoritative, stewarded list with stable ID, official name/type/location, active status and verification time.                                          |
| Giới thiệu/chuyển gửi dịch vụ | Referral                     | A documented suggestion or transfer to a verified service. It is not confirmation of eligibility, availability or clinical appropriateness.              |
| Trợ giúp xã hội               | Social assistance            | Public support governed by current policy/eligibility rules. LifeBridge must not determine entitlement from research reports.                            |
| Tình huống khẩn cấp           | Emergency                    | A situation requiring immediate action by appropriate official services. LifeBridge is not an emergency dispatch service.                                |
| Cảnh báo                      | Alert                        | Time-bound information from a named source with severity, area, timestamp and expiry.                                                                    |
| Dữ liệu an toàn trọng yếu     | Safety-critical data         | Data whose inaccuracy/staleness could cause harm, such as active hazards or service availability. It requires stricter gates than background statistics. |
| Hết hạn / cũ                  | Expired / stale              | Data that no longer satisfies its declared freshness policy. Stale data must not be presented as current.                                                |

## Evidence and data / Bằng chứng và dữ liệu

| Tiếng Việt             | English               | Định nghĩa dùng trong LifeBridge / LifeBridge definition                                                     |
| ---------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Sự kiện đã kiểm chứng  | Fact                  | A statement directly supported by a cited source within its method and reference period.                     |
| Suy luận               | Inference             | A project conclusion derived from facts; must be labelled and reproducible.                                  |
| Thông tin còn thiếu    | Missing information   | Information not found, not collected, unavailable or not authorized. Never fill it by guessing.              |
| Khuyến nghị            | Recommendation        | Proposed action based on evidence and constraints; not a fact or automated order.                            |
| Bằng chứng             | Evidence              | A source-bound observation or document excerpt described with provenance and limits.                         |
| Nguồn gốc dữ liệu      | Data provenance       | Publisher/custodian, source ID/URL, method, version, reference period, retrieval and transformation history. |
| Năm/kỳ tham chiếu      | Reference year/period | When the observed situation applies. Different from publication or retrieval date.                           |
| Ngày xuất bản          | Publication date      | When a publisher released the source.                                                                        |
| Ngày truy xuất         | Retrieval date        | When LifeBridge accessed the source.                                                                         |
| Độ mới                 | Freshness             | Whether data remains fit for a declared use at a given time. “Recent” is not a freshness policy.             |
| Người quản trị dữ liệu | Data steward          | Named role accountable for definition, quality, access, updates and correction.                              |
| Hợp đồng dữ liệu       | Data contract         | Versioned schema plus semantic, quality, ownership, privacy and change expectations.                         |

## Privacy and security / Quyền riêng tư và an toàn

| Tiếng Việt                   | English                 | Định nghĩa dùng trong LifeBridge / LifeBridge definition                                                                                              |
| ---------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dữ liệu cá nhân              | Personal data           | Information relating to an identifiable person, directly or through combination; legal definition follows applicable law.                             |
| Dữ liệu cá nhân nhạy cảm     | Sensitive personal data | Higher-risk data such as health/functioning, disability, children, precise location or other categories under applicable law.                         |
| Dữ liệu tổng hợp             | Aggregate data          | Statistics over groups. Aggregation reduces but does not always eliminate disclosure risk.                                                            |
| Dữ liệu vi mô                | Microdata               | Row-level observations about individuals/households/units, even if direct names were removed.                                                         |
| Dữ liệu tổng hợp ẩn danh     | Anonymized data         | Data processed so a person cannot reasonably be identified in the intended environment. A publisher's label does not remove the need for risk review. |
| Dữ liệu dùng bí danh         | Pseudonymized data      | Identifiers replaced while re-linkage remains possible with additional information; still personal data in many regimes.                              |
| Dữ liệu tổng hợp nhân tạo    | Synthetic data          | Artificial records generated without copying a real person/source row, designed to exercise a schema/scenario.                                        |
| Nhận dạng lại                | Re-identification       | Linking data to a person using direct or indirect information. Rare combinations can enable it.                                                       |
| Tối thiểu hóa dữ liệu        | Data minimization       | Collect/use the least data necessary for a documented purpose.                                                                                        |
| Giới hạn mục đích            | Purpose limitation      | Do not reuse data for an incompatible purpose without a new legal/ethical review and, when required, consent.                                         |
| Đồng ý                       | Consent                 | Specific, informed, freely given and revocable authorization where legally appropriate; not a universal lawful basis.                                 |
| Biên nhận đồng ý             | Consent receipt         | Versioned evidence of who authorized which purpose/data/actor and when, including expiry/revocation status.                                           |
| Quyền truy cập được ủy quyền | Delegated access        | Explicit, scoped and revocable access granted to another person; household membership alone is insufficient.                                          |

## Preferred product language / Ngôn ngữ sản phẩm ưu tiên

| Tránh / Avoid                             | Dùng / Prefer                                                         | Vì sao / Why                                 |
| ----------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------- |
| “bệnh nhân” for all users                 | “người được hỗ trợ”, person's chosen label                            | LifeBridge is broader than clinical care     |
| “người bình thường”                       | “người không báo cáo khó khăn X” when measurement requires comparison | avoids defining disability as abnormality    |
| “người phụ thuộc” as a permanent identity | “người được hỗ trợ” or a precise legal/financial term                 | preserves agency                             |
| “người chăm sóc mặc định là nữ”           | named/scoped care partner                                             | avoids gendered assumption                   |
| “dữ liệu mới nhất”                        | “kỳ tham chiếu 2024, truy xuất 2026-07-25”                            | makes freshness auditable                    |
| “đã xác minh” without actor/time          | “verified by [steward] at [time]”                                     | prevents false certainty                     |
| “gọi ngay số…” from fixture               | neutral synthetic emergency copy                                      | avoids unsafe hard-coded hotline information |
| “hệ thống chẩn đoán”                      | “hệ thống điều phối và hiển thị thông tin”                            | avoids medical claims                        |

## Change rule / Quy tắc thay đổi

New domain terms require:

1. a source or product-contract reason;
2. Vietnamese and English definitions;
3. migration impact on API/UI/fixtures;
4. accessibility and stigma review;
5. a dated note in the implementation and research logs when the term changes planned phases or slices.
