# Nghiên cứu dữ liệu LifeBridge / LifeBridge data research

Thư mục này là sổ đăng ký bằng chứng của dự án. Nó **không** phải kho dữ liệu cá nhân, hồ sơ y tế hay danh bạ cứu hộ đang hoạt động.

This directory is the project's evidence register. It is **not** a store for personal data, medical records, or a live emergency directory.

## Phạm vi thời gian / Evidence window

- Cửa sổ mặc định / Default window: **2016–2026**.
- Ưu tiên / Preferred evidence: reference year or publication year **2021–2026**.
- Nguồn trước 2021 chỉ được giữ khi là baseline trong cửa sổ 10 năm, chuẩn đo lường còn hiệu lực, hoặc chưa có bản Việt Nam mới hơn. Lý do phải được ghi trong registry.
- Sources before 2021 are retained only as a ten-year baseline, a still-current measurement standard, or where no newer Viet Nam source was found. The reason must be recorded.
- `publication year` và `reference year` không được dùng thay nhau. Một báo cáo xuất bản năm 2022 có thể mô tả khảo sát năm 2021.
- Retrieval date for this Phase 0 review: **2026-07-25**.

## Bản đồ tài liệu / Document map

| File                                                             | Mục đích / Purpose                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`DATA_SOURCE_REGISTER.md`](./DATA_SOURCE_REGISTER.md)           | Source cards, direct URLs, ownership, time/geography, terms, privacy and intended use |
| [`DATASET_EVALUATION_MATRIX.md`](./DATASET_EVALUATION_MATRIX.md) | Scoring, fixture eligibility and blockers                                             |
| [`DATA_GOVERNANCE.md`](./DATA_GOVERNANCE.md)                     | Collection, minimization, retention, legal and safety gates                           |
| [`DOMAIN_GLOSSARY.vi-en.md`](./DOMAIN_GLOSSARY.vi-en.md)         | Shared Vietnamese/English domain language                                             |
| [`RESEARCH_LOG.md`](./RESEARCH_LOG.md)                           | Search record, facts, inferences, missing evidence and decisions                      |
| [`../../data/README.md`](../../data/README.md)                   | Data-directory boundary                                                               |
| [`../../data/fixtures/README.md`](../../data/fixtures/README.md) | Deterministic synthetic-fixture contract                                              |

## Nhãn bằng chứng / Evidence labels

- **FACT / SỰ KIỆN ĐÃ KIỂM CHỨNG**: nội dung được nguồn được dẫn trực tiếp hỗ trợ.
- **INFERENCE / SUY LUẬN**: kết luận của nhóm dự án từ một hoặc nhiều fact; không được trình bày như phát biểu của publisher.
- **MISSING / CÒN THIẾU**: chưa tìm thấy, chưa xác minh hoặc chưa được cấp quyền.
- **RECOMMENDATION / KHUYẾN NGHỊ**: hành động đề xuất, chưa phải quyết định sản phẩm đã triển khai.

Mọi dashboard hoặc API sử dụng số liệu ngoài fixture phải giữ `source_id`, `reference_period`, `retrieved_at`, `license_status` và nhãn bằng chứng.

Every dashboard or API response that uses non-fixture evidence must preserve `source_id`, `reference_period`, `retrieved_at`, `license_status`, and the evidence label.

## Quy tắc thay đổi / Change protocol

Khi một phase hoặc vertical slice thay đổi kế hoạch dữ liệu:

1. cập nhật source card hoặc thêm source ID mới;
2. chấm lại matrix nếu quyền sử dụng, độ mới, phạm vi hay sensitivity thay đổi;
3. ghi fact/inference/missing/recommendation mới trong `RESEARCH_LOG.md`;
4. cập nhật kế hoạch triển khai và session log của repository;
5. nêu rõ phase/slice bị ảnh hưởng, migration/backfill cần thiết, validation sẽ chạy và phương án rollback;
6. không âm thầm thay nguồn hoặc trộn series có phương pháp khác nhau.

When a later phase or vertical slice changes the data plan, update the register, score, research log, implementation plan and session log together. A changed source is a contract change, not an invisible content refresh.

## Cảnh báo / Safety notice

- Tài liệu này không cung cấp tư vấn y khoa, chẩn đoán hay chỉ dẫn cấp cứu.
- This material does not provide medical advice, diagnosis, or emergency instructions.
- Dữ liệu thiên tai và danh bạ dịch vụ trong registry chỉ phục vụ nghiên cứu. Không dùng chúng để điều phối cứu hộ hoặc định tuyến người dùng trong tình huống khẩn cấp.
- Emergency and service-directory entries are research-only until an operational source contract, freshness SLA, fail-safe UX and legal review are complete.
- Không suy diễn nhu cầu của một cá nhân từ thống kê dân số.
- Population statistics must never be used to infer an individual's needs.
