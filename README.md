# LifeBridge

> Điều phối chăm sóc gia đình an toàn, rõ trách nhiệm và tôn trọng quyền riêng tư.
>
> Safe, accountable family-care coordination with privacy and dignity by default.

## Tiếng Việt

### LifeBridge là gì?

LifeBridge giúp người nhận chăm sóc, thành viên gia đình và người chăm sóc phối hợp công việc hằng ngày trong một hộ gia đình. Luồng MVP đầu tiên cho phép tạo, giao và hoàn tất một nhiệm vụ chăm sóc; phát thông báo từ sự kiện đã xác nhận; và cập nhật dashboard để mọi người thấy đúng trạng thái.

LifeBridge là công cụ điều phối. Sản phẩm **không** chẩn đoán, kê đơn, thay thế chuyên gia y tế hay tự động gọi dịch vụ khẩn cấp.

### Trạng thái dự án

- **Phase 0 — Foundation** đã được tích hợp; `P1-S1` đang triển khai và kiểm chứng trên nhánh `phase/1-accountable-task-loop`.
- Kế hoạch hiện hành là lộ trình production tích lũy **P0–P12**; đây là kế hoạch, không phải tuyên bố các phase tương lai đã được triển khai.
- Contract và Stitch handoff của `P1-S1 — Accountable care-task loop` đã frozen; slice chỉ được hoàn tất sau Level C và CI exact-head xanh.
- Chưa có bản sản phẩm dùng cho dữ liệu chăm sóc thật.
- `docs/design/SCREEN_INVENTORY.md` ghi 35 màn hình/trạng thái như **backlog có kiểm soát**, không phải cam kết triển khai đồng thời.
- UI chỉ được triển khai sau khi luồng liên quan đã được thiết kế/review qua Google Stitch MCP và có handoff trong Git.

### Lộ trình production P0–P12

- `P0`: foundation, governance và research.
- `P1–P5`: các vertical slice về task, trust/household, care planning, safety/records và community.
- `P6–P10`: contract microservice, độ bền dữ liệu/sự kiện, security/privacy, observability/SLO/DR và performance/capacity/cost.
- `P11`: production deployment, staged rollout, pilot và release.
- `P12`: vận hành sau phát hành, bảo trì và lập roadmap kế tiếp từ bằng chứng thực tế.

Chất lượng production được bổ sung ngay trong từng slice phù hợp; P6–P12 xác minh các kiểm soát đó trên toàn release scope, không phải nơi trì hoãn chúng đến cuối dự án.

### MVP theo vertical slice

Vertical slice đầu tiên (`P1-S1`) phải hoàn chỉnh từ đầu đến cuối:

1. Một thành viên hộ gia đình tạo nhiệm vụ chăm sóc bằng dữ liệu synthetic.
2. Dịch vụ coordination kiểm tra quyền, lưu nhiệm vụ và người được giao.
3. Người được giao hoàn tất nhiệm vụ an toàn, chống gửi trùng.
4. Transactional outbox phát sự kiện; dịch vụ notification tạo thông báo.
5. Dashboard và task board hiển thị trạng thái đã xác nhận.
6. Có trạng thái loading, empty, denied, validation, conflict và service error.
7. Contract, unit, integration và browser smoke test xác nhận luồng.

### Môi trường được hỗ trợ

- Windows 10/11, PowerShell 5.1 hoặc mới hơn.
- Codex trong ứng dụng ChatGPT desktop.
- Node.js 22.x và pnpm 11.9.0.
- Docker Desktop là bắt buộc cho demo/validation P1-S1 cục bộ; doctor chỉ chẩn đoán, không tự sửa service, Registry, firewall hay cấu hình hệ thống.

PowerShell trên máy có thể chặn shim `*.ps1`. Dùng executable Windows:

```powershell
pnpm.cmd bootstrap
pnpm.cmd doctor
pnpm.cmd validate:phase0
pnpm.cmd run demo:p1
pnpm.cmd run validate:p1-s1
```

Không thay đổi Execution Policy toàn máy. Không chạy với quyền Administrator chỉ để làm bootstrap.

### Cách làm việc

- Mỗi Codex conversation chỉ xử lý **một phase hoặc một vertical slice**.
- Đọc `CODEX.md`, repository map, implementation plan và session log trước khi sửa.
- Làm theo contract và test của slice; không quét lại toàn repository nếu bản đồ vẫn chính xác.
- Ghi mọi thay đổi roadmap theo cấu trúc: kế hoạch gốc, thực tế, lý do, ảnh hưởng, validation và follow-up.
- Khi đóng phase/slice, ghi định hướng chính xác cho phase/slice tiếp theo từ code, contract và kết quả test thực tế; chỉ handoff, không triển khai tiếp trong cùng conversation.
- Không commit secret, dữ liệu nhận dạng cá nhân (PII), hồ sơ chăm sóc thật hay file môi trường cục bộ.

Luồng nhánh:

```text
init/research -> data -> dev -> test -> main
                         ^
                         |
                      phase/*
```

Mọi promotion vào nhánh dài hạn phải qua pull request. `phase/*` là nhánh ngắn hạn từ `dev` và quay lại `dev`; research đi `init/research -> data -> dev`; release đi `dev -> test -> main`. GitHub Network phải thể hiện đúng sự hội tụ này, không có nhánh trang trí hoặc phân kỳ vĩnh viễn. `init/research` là tên hợp lệ; `/init` không hợp lệ trong Git. Không dùng nhánh `codex/*`. Chi tiết ở `CONTRIBUTING.md`.

### Nghiên cứu và dữ liệu

Baseline nghiên cứu xem xét giai đoạn **2016–2026**, ưu tiên nguồn công bố/tham chiếu **2021–2026**. Nguồn cũ hơn chỉ dùng khi là baseline hoặc tiêu chuẩn chưa có bản thay thế và phải ghi lý do. Mỗi nguồn phải có provenance, năm, phạm vi địa lý, giấy phép/điều khoản, độ mới, giới hạn và mục đích sử dụng.

Chỉ fixture synthetic hoặc de-identified được đưa vào repository. Xem:

- `docs/research/README.md`
- `docs/research/DATA_SOURCE_REGISTER.md`
- `docs/research/DOMAIN_GLOSSARY.vi-en.md`
- `docs/research/DATA_GOVERNANCE.md`
- `data/fixtures/README.md`

### Bản đồ tài liệu

| Tài liệu                      | Mục đích                                     |
| ----------------------------- | -------------------------------------------- |
| `CODEX.md`                    | Luật vận hành cho Codex                      |
| `AGENTS.md`                   | Chỉ dẫn ngắn áp dụng toàn repository         |
| `docs/PRODUCT_SPEC.md`        | Phạm vi sản phẩm, MVP và non-goals           |
| `docs/ARCHITECTURE.md`        | Ranh giới service, dữ liệu và integration    |
| `docs/REPOSITORY_MAP.md`      | Bản đồ file, entry point, dependency và lệnh |
| `docs/IMPLEMENTATION_PLAN.md` | Phase, slice, acceptance và change-control   |
| `docs/WORKSTREAM_BOARD.md`    | Trạng thái, dependency, blocker và handoff   |
| `docs/SESSION_LOG.md`         | Bộ nhớ tiếp nối giữa các conversation        |
| `docs/DECISIONS.md`           | ADR cho quyết định quan trọng                |

## English

### What is LifeBridge?

LifeBridge helps care recipients, relatives, and caregivers coordinate daily work within a household. The first MVP flow creates, assigns, and completes a care task, emits a notification from confirmed state, and refreshes the dashboard so everyone sees an accountable result.

LifeBridge is a coordination tool. It does **not** diagnose, prescribe, replace professional care, or automatically dispatch emergency services.

### Project status

- **Phase 0 — Foundation** is integrated; `P1-S1` is being implemented and validated on `phase/1-accountable-task-loop`.
- The active plan is the cumulative production roadmap **P0–P12**; future phases are plans, not implementation claims.
- The `P1-S1 — Accountable care-task loop` contract and Stitch handoff are frozen; the slice completes only after Level C and exact-head CI pass.
- It is not ready for real care data.
- The 35 entries in `docs/design/SCREEN_INVENTORY.md` are a controlled **backlog**, not a promise to build everything at once.
- UI implementation starts only after the relevant flow is designed/reviewed through Google Stitch MCP and handed off in Git.

### P0–P12 production roadmap

- `P0`: foundation, governance, and research.
- `P1–P5`: task, trust/household, care-planning, safety/records, and community vertical slices.
- `P6–P10`: microservice contracts, data/event durability, security/privacy, observability/SLO/DR, and performance/capacity/cost.
- `P11`: production deployment, staged rollout, pilot, and release.
- `P12`: post-launch operations, maintenance, and evidence-driven successor planning.

Production controls are implemented in each applicable slice. P6–P12 prove them across the accepted release scope; they are not a reason to defer quality.

### First vertical slice

The first MVP slice (`P1-S1`) delivers one complete path:

1. A household member creates a care task using synthetic data.
2. The coordination service validates access and stores the task and assignee.
3. The assignee completes it with duplicate-submit protection.
4. A transactional outbox emits an event and the notification service creates a notification.
5. The dashboard and task board display confirmed state.
6. Loading, empty, denied, validation, conflict, and service-error states are usable.
7. Contract, unit, integration, and browser smoke tests prove the flow.

### Supported environment

- Windows 10/11 with PowerShell 5.1 or later.
- Codex in the ChatGPT desktop app.
- Node.js 22.x and pnpm 11.9.0.
- Docker Desktop is required for the local P1-S1 demo/validation. The doctor reports issues; it never modifies services, Registry, firewall, or system policy.

Use Windows executables when PowerShell blocks `*.ps1` shims:

```powershell
pnpm.cmd bootstrap
pnpm.cmd doctor
pnpm.cmd validate:phase0
pnpm.cmd run demo:p1
pnpm.cmd run validate:p1-s1
```

Do not change the machine-wide Execution Policy or elevate merely to bootstrap.

### Working agreement

- One Codex conversation owns exactly **one phase or one vertical slice**.
- Read `CODEX.md`, the repository map, implementation plan, and session log before editing.
- Work from the slice contract and focused tests; do not repeatedly rescan the repository.
- Record every roadmap deviation as planned versus actual, reason, impact, validation, and follow-up.
- At phase/slice close, derive the next orientation from actual code, contracts, and test evidence; hand it off without implementing it in the same conversation.
- Never commit secrets, PII, real care records, or local environment files.

Branch promotion is:

```text
init/research -> data -> dev -> test -> main
                         ^
                         |
                      phase/*
```

Every promotion into a long-lived branch is pull-request-only. Short-lived `phase/*` branches start from and return to `dev`; research promotes `init/research -> data -> dev`; releases promote `dev -> test -> main`. GitHub Network must show that real convergence without decorative or permanently divergent branches. `init/research` is valid; `/init` is not. New work must not use `codex/*`. See `CONTRIBUTING.md`.

### Research and data

The evidence baseline covers **2016–2026** and prioritizes material published or referenced in **2021–2026**. Older sources require an explicit baseline/standard rationale. Every source records provenance, year, geography, terms, freshness, limitations, and intended use.

Only synthetic or properly de-identified fixtures belong in Git. The research register and the Vietnamese/English glossary are under `docs/research/`.

### Start here

Read `CODEX.md`, then use `docs/REPOSITORY_MAP.md` and `docs/IMPLEMENTATION_PLAN.md` to locate the current slice. Environment and validation details are maintained in `docs/orchestration/WINDOWS_ENVIRONMENT.md` and `docs/TEST_STRATEGY.md`.
