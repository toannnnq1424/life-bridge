"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Locale = "vi-VN" | "en";
type Phase =
  | "loading"
  | "ready"
  | "empty"
  | "denied"
  | "withdrawn"
  | "expired"
  | "resolved"
  | "conflict"
  | "policy"
  | "redaction"
  | "retention"
  | "uncertain"
  | "offline"
  | "identity-unavailable"
  | "community-unavailable"
  | "audit-failed"
  | "outbox-failed"
  | "invalid"
  | "failed";
type Outcome = "no_change" | "content_visibility_restricted" | "community_participation_restricted";
type Reason =
  | "insufficient_authoritative_evidence"
  | "duplicate_report"
  | "outside_moderation_scope"
  | "policy_content_boundary"
  | "policy_privacy_boundary"
  | "policy_contact_boundary";

interface QueueCase {
  caseId: string;
  category: string;
  state: string;
  version: number;
  submittedAt: string;
  retentionDeadline: string;
  minimumDisclosure?: boolean;
}
interface Evidence {
  evidenceId: string;
  kind: string;
  value: string;
  provenance: string;
  observedAt: string;
  redacted: boolean;
}
interface CaseDetail extends QueueCase {
  affectedReference: string;
  moderationPolicyVersion: string;
  redactionPolicyVersion: string;
  retentionPolicyVersion: string;
  evidenceCutoffAt: string;
  evidence: Evidence[];
  allowedOutcomes?: Outcome[];
  allowedReasons?: Reason[];
  outcome?: Outcome;
  reason?: Reason;
}

const copy = {
  en: {
    skip: "Skip to moderation content",
    title: "Moderation resolution",
    language: "Language",
    purpose:
      "Review one authorized Community report using only minimum redacted evidence and record one auditable decision.",
    authority:
      "A moderator or administrator label is not consent or authority. Every queue, detail, decision, and reconciliation request needs a fresh exact-purpose Identity & Consent decision.",
    loading: "Checking fresh authority and authoritative Community state…",
    empty: "No reports are available in this authorized scope.",
    denied: "This moderation view is unavailable.",
    withdrawn: "The report was withdrawn. It cannot be resolved.",
    expired: "The report expired. It cannot be resolved.",
    resolved: "This report already has an authoritative resolution.",
    conflict:
      "The case changed or another decision completed. Load current state before deciding again.",
    policy: "The moderation policy changed or is unknown. No decision was recorded.",
    redaction:
      "Current redaction policy cannot produce this projection. Protected evidence is hidden.",
    retention: "Evidence is expired or retention rules prevent this action.",
    uncertain:
      "The result is uncertain after dispatch. Do not repeat the decision; check current state.",
    offline: "Offline: this protected action is blocked and is not queued.",
    identityUnavailable:
      "Identity & Consent is unavailable; fresh authority could not be established.",
    communityUnavailable: "Authoritative Community state is unavailable.",
    auditFailed: "Audit recording failed. The decision and restrictive effect were rolled back.",
    outboxFailed: "Outbox recording failed. The decision and restrictive effect were rolled back.",
    invalid: "Choose a permitted outcome and matching structured reason.",
    failed: "The decision was not recorded. Review the error and load current state.",
    refresh: "Load current state",
    reconcile: "Check current state",
    queue: "Authorized report queue",
    detail: "Minimum redacted case detail",
    evidence: "Redacted authoritative evidence",
    decision: "Bounded decision",
    category: "Report category",
    state: "Authoritative state",
    submitted: "Submitted",
    retentionLabel: "Retention deadline",
    version: "Case version",
    provenance: "Provenance",
    policyVersion: "Moderation policy",
    redactionVersion: "Redaction policy",
    retentionVersion: "Retention policy",
    outcome: "Outcome",
    reason: "Structured reason",
    choose: "Choose…",
    noChange: "No Community change",
    restrictContent: "Restrict exact item visibility",
    restrictParticipation: "Restrict exact Community participation",
    insufficient: "Insufficient authoritative evidence",
    duplicate: "Duplicate report",
    outside: "Outside moderation scope",
    contentBoundary: "Content policy boundary",
    privacyBoundary: "Privacy policy boundary",
    contactBoundary: "Contact policy boundary",
    review: "Review decision",
    confirmTitle: "Confirm restrictive Community action",
    consequence:
      "This effect is limited to LifeBridge Community. It does not establish guilt, danger, abuse validity, safety, or an external-enforcement outcome.",
    cancel: "Cancel",
    confirm: "Confirm decision",
    result: "Decision result",
    success: "Community confirmed the decision and its audit record.",
    next: "Select next report",
    noAppeal: "P5-S3 does not provide an in-product appeal or reopen workflow.",
    minimum:
      "Only authoritative Community evidence may support a resolution. No automatic resolution, escalation, suspension, or external enforcement occurs.",
  },
  "vi-VN": {
    skip: "Chuyển đến nội dung kiểm duyệt",
    title: "Xử lý kiểm duyệt",
    language: "Ngôn ngữ",
    purpose:
      "Xem xét một báo cáo Cộng đồng được cho phép bằng bằng chứng đã ẩn tối thiểu và ghi một quyết định có thể kiểm toán.",
    authority:
      "Nhãn kiểm duyệt viên hoặc quản trị viên không phải là đồng thuận hay thẩm quyền. Mỗi lần đọc hàng đợi, chi tiết, quyết định và đối soát đều cần quyết định Danh tính & Đồng thuận mới, đúng mục đích.",
    loading: "Đang kiểm tra thẩm quyền mới và trạng thái Cộng đồng có thẩm quyền…",
    empty: "Không có báo cáo trong phạm vi được phép này.",
    denied: "Không thể mở chế độ kiểm duyệt này.",
    withdrawn: "Báo cáo đã được rút và không thể xử lý.",
    expired: "Báo cáo đã hết hạn và không thể xử lý.",
    resolved: "Báo cáo này đã có quyết định có thẩm quyền.",
    conflict:
      "Hồ sơ đã thay đổi hoặc có quyết định đồng thời. Tải trạng thái hiện tại trước khi quyết định lại.",
    policy: "Chính sách kiểm duyệt đã đổi hoặc không xác định. Không có quyết định nào được ghi.",
    redaction:
      "Chính sách ẩn dữ liệu hiện tại không cho phép phép chiếu này. Bằng chứng được bảo vệ đã bị ẩn.",
    retention: "Bằng chứng đã hết hạn hoặc quy tắc lưu giữ ngăn hành động này.",
    uncertain:
      "Kết quả chưa chắc chắn sau khi gửi. Không lặp lại quyết định; hãy kiểm tra trạng thái hiện tại.",
    offline: "Ngoại tuyến: hành động được bảo vệ bị chặn và không được xếp hàng.",
    identityUnavailable: "Danh tính & Đồng thuận không khả dụng; không thể xác lập thẩm quyền mới.",
    communityUnavailable: "Trạng thái Cộng đồng có thẩm quyền không khả dụng.",
    auditFailed: "Ghi kiểm toán thất bại. Quyết định và tác động hạn chế đã được hoàn tác.",
    outboxFailed: "Ghi hộp thư sự kiện thất bại. Quyết định và tác động hạn chế đã được hoàn tác.",
    invalid: "Chọn kết quả được phép và lý do có cấu trúc phù hợp.",
    failed: "Quyết định chưa được ghi. Xem lỗi và tải trạng thái hiện tại.",
    refresh: "Tải trạng thái hiện tại",
    reconcile: "Kiểm tra trạng thái hiện tại",
    queue: "Hàng đợi báo cáo được phép",
    detail: "Chi tiết hồ sơ đã ẩn tối thiểu",
    evidence: "Bằng chứng có thẩm quyền đã ẩn",
    decision: "Quyết định có giới hạn",
    category: "Loại báo cáo",
    state: "Trạng thái có thẩm quyền",
    submitted: "Thời điểm gửi",
    retentionLabel: "Hạn lưu giữ",
    version: "Phiên bản hồ sơ",
    provenance: "Nguồn gốc",
    policyVersion: "Chính sách kiểm duyệt",
    redactionVersion: "Chính sách ẩn dữ liệu",
    retentionVersion: "Chính sách lưu giữ",
    outcome: "Kết quả",
    reason: "Lý do có cấu trúc",
    choose: "Chọn…",
    noChange: "Không thay đổi Cộng đồng",
    restrictContent: "Hạn chế hiển thị đúng nội dung",
    restrictParticipation: "Hạn chế đúng quyền tham gia Cộng đồng",
    insufficient: "Không đủ bằng chứng có thẩm quyền",
    duplicate: "Báo cáo trùng",
    outside: "Ngoài phạm vi kiểm duyệt",
    contentBoundary: "Ranh giới chính sách nội dung",
    privacyBoundary: "Ranh giới chính sách riêng tư",
    contactBoundary: "Ranh giới chính sách liên hệ",
    review: "Xem lại quyết định",
    confirmTitle: "Xác nhận hành động hạn chế trong Cộng đồng",
    consequence:
      "Tác động chỉ giới hạn trong Cộng đồng LifeBridge. Đây không phải kết luận về lỗi, nguy hiểm, tính xác thực của lạm dụng, an toàn hay kết quả thực thi bên ngoài.",
    cancel: "Hủy",
    confirm: "Xác nhận quyết định",
    result: "Kết quả quyết định",
    success: "Cộng đồng đã xác nhận quyết định và bản ghi kiểm toán.",
    next: "Chọn báo cáo tiếp theo",
    noAppeal: "P5-S3 không cung cấp quy trình kháng nghị hoặc mở lại trong sản phẩm.",
    minimum:
      "Chỉ bằng chứng Cộng đồng có thẩm quyền mới hỗ trợ quyết định. Không tự động xử lý, nâng cấp, đình chỉ hay thực thi bên ngoài.",
  },
} as const;

const noChangeReasons: Reason[] = [
  "insufficient_authoritative_evidence",
  "duplicate_report",
  "outside_moderation_scope",
];
const restrictiveReasons: Reason[] = [
  "policy_content_boundary",
  "policy_privacy_boundary",
  "policy_contact_boundary",
];

function phaseFor(status: number, code?: string): Phase {
  if (
    status === 401 ||
    status === 403 ||
    code?.includes("NOT_FOUND") ||
    code?.includes("AUTHORITY_REQUIRED")
  )
    return "denied";
  if (code?.includes("WITHDRAWN")) return "withdrawn";
  if (code?.includes("EXPIRED")) return "expired";
  if (code?.includes("ALREADY_RESOLVED")) return "resolved";
  if (code?.includes("VERSION_CONFLICT") || code === "IDEMPOTENCY_CONFLICT") return "conflict";
  if (code?.includes("POLICY_CONFLICT")) return "policy";
  if (code?.includes("REDACTION_CONFLICT")) return "redaction";
  if (code?.includes("RETENTION_CONFLICT")) return "retention";
  if (code?.includes("RESULT_UNKNOWN")) return "uncertain";
  if (code === "IDENTITY_SERVICE_UNAVAILABLE") return "identity-unavailable";
  if (code === "COMMUNITY_SERVICE_UNAVAILABLE" || code === "INTERNAL_CONTRACT_INVALID")
    return "community-unavailable";
  if (code?.includes("AUDIT_FAILED")) return "audit-failed";
  if (code?.includes("OUTBOX_FAILED")) return "outbox-failed";
  if (code?.includes("VALIDATION_FAILED") || code === "IDEMPOTENCY_KEY_REQUIRED") return "invalid";
  return "failed";
}

export function ModerationResolutionApp({
  householdId,
  moderatorEnrollmentId,
}: {
  householdId: string;
  moderatorEnrollmentId: string;
}) {
  const [locale, setLocale] = useState<Locale>("vi-VN");
  const [phase, setPhase] = useState<Phase>("loading");
  const [cases, setCases] = useState<QueueCase[]>([]);
  const [selected, setSelected] = useState<CaseDetail | null>(null);
  const [csrf, setCsrf] = useState("");
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [reason, setReason] = useState<Reason | "">("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<CaseDetail | null>(null);
  const [submissionReference, setSubmissionReference] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reviewRef = useRef<HTMLButtonElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const text = copy[locale];

  const headers = useCallback(
    (token: string) => ({ "content-type": "application/json", "x-csrf-token": token }),
    [],
  );
  const loadDetail = useCallback(
    async (item: QueueCase, token = csrf) => {
      const response = await fetch(
        `/api/v1/community/moderation/cases/${encodeURIComponent(item.caseId)}/query`,
        {
          method: "POST",
          headers: headers(token),
          body: JSON.stringify({
            householdId,
            moderatorEnrollmentId,
            expectedVersion: item.version,
          }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        case?: CaseDetail;
        error?: { code?: string };
      };
      if (!response.ok || !body.case?.minimumDisclosure) {
        setSelected(null);
        setPhase(phaseFor(response.status, body.error?.code));
        return;
      }
      setSelected(body.case);
      setOutcome("");
      setReason("");
      setPhase("ready");
    },
    [csrf, headers, householdId, moderatorEnrollmentId],
  );

  const load = useCallback(async () => {
    if (!householdId || !moderatorEnrollmentId) {
      setPhase("denied");
      return;
    }
    if (!navigator.onLine) {
      setPhase("offline");
      return;
    }
    setPhase("loading");
    setResult(null);
    try {
      const session = await fetch("/api/v1/session", { cache: "no-store" });
      const sessionBody = (await session.json()) as { data?: { csrfToken?: string } };
      const token = sessionBody.data?.csrfToken ?? "";
      if (!session.ok || !token) {
        setPhase("denied");
        return;
      }
      setCsrf(token);
      const response = await fetch("/api/v1/community/moderation/cases/query", {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ householdId, moderatorEnrollmentId, state: "open" }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        cases?: QueueCase[];
        error?: { code?: string };
      };
      if (!response.ok) {
        setCases([]);
        setSelected(null);
        setPhase(phaseFor(response.status, body.error?.code));
        return;
      }
      const visible = (body.cases ?? [])
        .filter((item) => item.minimumDisclosure !== false)
        .slice(0, 25);
      setCases(visible);
      if (!visible.length) {
        setSelected(null);
        setPhase("empty");
        return;
      }
      const first = visible[0];
      if (first) await loadDetail(first, token);
    } catch {
      setCases([]);
      setSelected(null);
      setPhase("community-unavailable");
    }
  }, [headers, householdId, loadDetail, moderatorEnrollmentId]);

  const valid =
    outcome &&
    reason &&
    (outcome === "no_change" ? noChangeReasons : restrictiveReasons).includes(reason as Reason);
  const openConfirmation = () => {
    if (!valid) {
      setPhase("invalid");
      return;
    }
    setConfirming(true);
    queueMicrotask(() => cancelRef.current?.focus());
  };
  const cancelConfirmation = () => {
    setConfirming(false);
    queueMicrotask(() => reviewRef.current?.focus());
  };
  const resolve = async () => {
    if (!selected || !csrf || !valid || !navigator.onLine) {
      setConfirming(false);
      setPhase(navigator.onLine ? "invalid" : "offline");
      return;
    }
    const reference = `moderation_${crypto.randomUUID().replaceAll("-", "")}`;
    setSubmissionReference(reference);
    setConfirming(false);
    try {
      const response = await fetch(
        `/api/v1/community/moderation/cases/${encodeURIComponent(selected.caseId)}/resolution`,
        {
          method: "POST",
          headers: { ...headers(csrf), "idempotency-key": reference },
          body: JSON.stringify({
            householdId,
            moderatorEnrollmentId,
            submissionReference: reference,
            expectedVersion: selected.version,
            outcome,
            reason,
            affectedReference: selected.affectedReference,
            moderationPolicyVersion: selected.moderationPolicyVersion,
            redactionPolicyVersion: selected.redactionPolicyVersion,
            retentionPolicyVersion: selected.retentionPolicyVersion,
            confirmed: true,
          }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        case?: CaseDetail;
        error?: { code?: string };
      };
      if (!response.ok || !body.case?.minimumDisclosure) {
        setPhase(phaseFor(response.status, body.error?.code));
        return;
      }
      setResult(body.case);
      setSelected(body.case);
      setPhase("ready");
    } catch {
      setPhase("uncertain");
    }
  };
  const reconcile = async () => {
    if (!csrf || !submissionReference || !navigator.onLine) {
      setPhase("offline");
      return;
    }
    try {
      const response = await fetch("/api/v1/community/moderation/cases/reconcile", {
        method: "POST",
        headers: headers(csrf),
        body: JSON.stringify({
          householdId,
          moderatorEnrollmentId,
          submissionReference,
          operation: "resolve",
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        case?: CaseDetail;
        error?: { code?: string };
      };
      if (!response.ok || !body.case?.minimumDisclosure) {
        setPhase(phaseFor(response.status, body.error?.code));
        return;
      }
      setResult(body.case);
      setSelected(body.case);
      setPhase("ready");
    } catch {
      setPhase("uncertain");
    }
  };

  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);
  useEffect(() => {
    const off = () => setPhase("offline");
    const on = () => void load();
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, [load]);

  const messages: Record<Exclude<Phase, "ready">, string> = {
    loading: text.loading,
    empty: text.empty,
    denied: text.denied,
    withdrawn: text.withdrawn,
    expired: text.expired,
    resolved: text.resolved,
    conflict: text.conflict,
    policy: text.policy,
    redaction: text.redaction,
    retention: text.retention,
    uncertain: text.uncertain,
    offline: text.offline,
    "identity-unavailable": text.identityUnavailable,
    "community-unavailable": text.communityUnavailable,
    "audit-failed": text.auditFailed,
    "outbox-failed": text.outboxFailed,
    invalid: text.invalid,
    failed: text.failed,
  };
  const reasonLabels: Record<Reason, string> = {
    insufficient_authoritative_evidence: text.insufficient,
    duplicate_report: text.duplicate,
    outside_moderation_scope: text.outside,
    policy_content_boundary: text.contentBoundary,
    policy_privacy_boundary: text.privacyBoundary,
    policy_contact_boundary: text.contactBoundary,
  };
  const outcomeLabels: Record<Outcome, string> = {
    no_change: text.noChange,
    content_visibility_restricted: text.restrictContent,
    community_participation_restricted: text.restrictParticipation,
  };
  const permittedReasons =
    outcome === "no_change" ? noChangeReasons : outcome ? restrictiveReasons : [];

  return (
    <div className="moderation-app">
      <a className="skip-link" href="#moderation-main">
        {text.skip}
      </a>
      <header className="moderation-header">
        <div>
          <p className="moderation-kicker">LB-027</p>
          <h1>{text.title}</h1>
        </div>
        <label>
          {text.language}
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <main id="moderation-main" className="moderation-main">
        <section className="moderation-boundary" aria-labelledby="moderation-purpose">
          <h2 id="moderation-purpose">{text.purpose}</h2>
          <p>{text.authority}</p>
          <p>{text.minimum}</p>
          <button type="button" onClick={() => void load()}>
            {text.refresh}
          </button>
        </section>
        {phase !== "ready" && (
          <section
            className={`moderation-state state-${phase}`}
            role={phase === "invalid" ? "alert" : "status"}
            aria-live={phase === "loading" ? "polite" : "assertive"}
          >
            <h2>{messages[phase]}</h2>
            {phase !== "loading" && (
              <button
                type="button"
                onClick={() => (phase === "uncertain" ? void reconcile() : void load())}
              >
                {phase === "uncertain" ? text.reconcile : text.refresh}
              </button>
            )}
          </section>
        )}
        {(phase === "ready" || selected) && (
          <div className="moderation-workspace">
            <section aria-labelledby="moderation-queue">
              <h2 id="moderation-queue">{text.queue}</h2>
              <ul className="moderation-list">
                {cases.map((item) => (
                  <li key={item.caseId}>
                    <button
                      type="button"
                      aria-pressed={selected?.caseId === item.caseId}
                      onClick={() => void loadDetail(item)}
                    >
                      <strong>{item.caseId}</strong>
                      <span>{item.category}</span>
                      <span>{item.state}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            {selected && (
              <section className="moderation-detail" aria-labelledby="moderation-detail">
                <h2 id="moderation-detail">{text.detail}</h2>
                <dl>
                  <dt>{text.category}</dt>
                  <dd>{selected.category}</dd>
                  <dt>{text.state}</dt>
                  <dd>{selected.state}</dd>
                  <dt>{text.submitted}</dt>
                  <dd>{selected.submittedAt}</dd>
                  <dt>{text.retentionLabel}</dt>
                  <dd>{selected.retentionDeadline}</dd>
                  <dt>{text.version}</dt>
                  <dd>{selected.version}</dd>
                  <dt>{text.policyVersion}</dt>
                  <dd>{selected.moderationPolicyVersion}</dd>
                  <dt>{text.redactionVersion}</dt>
                  <dd>{selected.redactionPolicyVersion}</dd>
                  <dt>{text.retentionVersion}</dt>
                  <dd>{selected.retentionPolicyVersion}</dd>
                </dl>
                <section className="moderation-evidence" aria-labelledby="moderation-evidence">
                  <h3 id="moderation-evidence">{text.evidence}</h3>
                  <ul>
                    {selected.evidence.map((item) => (
                      <li key={item.evidenceId}>
                        <strong>{item.kind}</strong>
                        <span>{item.value}</span>
                        <span>
                          {text.provenance}: {item.provenance}
                        </span>
                        <time>{item.observedAt}</time>
                      </li>
                    ))}
                  </ul>
                </section>
                {!result && (
                  <section aria-labelledby="moderation-decision">
                    <h3 id="moderation-decision">{text.decision}</h3>
                    <div className="moderation-fields">
                      <label>
                        {text.outcome}
                        <select
                          value={outcome}
                          onChange={(event) => {
                            setOutcome(event.target.value as Outcome | "");
                            setReason("");
                          }}
                        >
                          <option value="">{text.choose}</option>
                          {(
                            selected.allowedOutcomes ?? (Object.keys(outcomeLabels) as Outcome[])
                          ).map((value) => (
                            <option key={value} value={value}>
                              {outcomeLabels[value]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {text.reason}
                        <select
                          value={reason}
                          onChange={(event) => setReason(event.target.value as Reason | "")}
                        >
                          <option value="">{text.choose}</option>
                          {permittedReasons
                            .filter(
                              (value) =>
                                !selected.allowedReasons || selected.allowedReasons.includes(value),
                            )
                            .map((value) => (
                              <option key={value} value={value}>
                                {reasonLabels[value]}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                    <button ref={reviewRef} type="button" onClick={openConfirmation}>
                      {text.review}
                    </button>
                    <p>{text.noAppeal}</p>
                  </section>
                )}
                {result && (
                  <section className="moderation-result" role="status" aria-live="polite">
                    <h3 ref={resultRef} tabIndex={-1}>
                      {text.result}
                    </h3>
                    <p>{text.success}</p>
                    <dl>
                      <dt>{text.outcome}</dt>
                      <dd>{outcomeLabels[result.outcome as Outcome] ?? result.outcome}</dd>
                      <dt>{text.reason}</dt>
                      <dd>{reasonLabels[result.reason as Reason] ?? result.reason}</dd>
                    </dl>
                    <button type="button" onClick={() => void load()}>
                      {text.next}
                    </button>
                  </section>
                )}
              </section>
            )}
          </div>
        )}
        {confirming && selected && outcome && reason && (
          <section
            className="moderation-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="moderation-confirm-title"
          >
            <h2 id="moderation-confirm-title">{text.confirmTitle}</h2>
            <dl>
              <dt>Case</dt>
              <dd>{selected.caseId}</dd>
              <dt>{text.outcome}</dt>
              <dd>{outcomeLabels[outcome]}</dd>
              <dt>{text.reason}</dt>
              <dd>{reasonLabels[reason]}</dd>
              <dt>{text.version}</dt>
              <dd>{selected.version}</dd>
            </dl>
            <p>{text.consequence}</p>
            <div className="moderation-actions">
              <button ref={cancelRef} type="button" onClick={cancelConfirmation}>
                {text.cancel}
              </button>
              <button type="button" onClick={() => void resolve()}>
                {text.confirm}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
