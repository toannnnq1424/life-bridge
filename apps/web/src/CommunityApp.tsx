"use client";

import {
  CommunityDirectorySuccessSchema,
  CommunityHelpRequestDeleteSuccessSchema,
  CommunityHelpRequestListSuccessSchema,
  CommunityHelpRequestMutationSuccessSchema,
  IdentitySessionProjectionSchema,
  type CommunityHelpRequestProjection,
  type CommunityPublicDirectoryResult,
} from "@lifebridge/contracts";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

type Locale = "vi-VN" | "en";
type HelpPhase =
  | "loading"
  | "draft"
  | "validation"
  | "submitting"
  | "submitted"
  | "duplicate"
  | "closed"
  | "deleted"
  | "denied"
  | "revoked"
  | "conflict"
  | "uncertain"
  | "unavailable"
  | "offline";
type DirectoryPhase =
  | "loading"
  | "ready"
  | "empty"
  | "stale"
  | "unavailable"
  | "offline-cache"
  | "offline-empty"
  | "location-denied"
  | "location-unavailable";

interface FailureBody {
  error?: { code?: string };
}

const categories = [
  "daily_living_support",
  "transport_coordination",
  "household_errand",
  "social_connection",
  "digital_access",
  "accessibility_support",
] as const;
const categoryLabels = {
  en: {
    daily_living_support: "Daily living support",
    transport_coordination: "Transport coordination",
    household_errand: "Household errand",
    social_connection: "Social connection",
    digital_access: "Digital access",
    accessibility_support: "Accessibility support",
  },
  "vi-VN": {
    daily_living_support: "Hỗ trợ sinh hoạt hằng ngày",
    transport_coordination: "Điều phối đi lại",
    household_errand: "Việc vặt trong gia đình",
    social_connection: "Kết nối xã hội",
    digital_access: "Tiếp cận kỹ thuật số",
    accessibility_support: "Hỗ trợ tiếp cận",
  },
} as const;

const copy = {
  en: {
    skip: "Skip to main content",
    language: "Language",
    helpTitle: "Request bounded community help",
    helpIntro:
      "Describe only one bounded category, a province/city, and an optional broad time of day. Do not include diagnosis, treatment, urgency, exact address, or a personal story.",
    purposeTitle: "Purpose, visibility, and consent",
    purpose:
      "Purpose: community support. This request is visible only to the care recipient and accounts with a current community-help grant. It is not public or sent to directory organizations in P5-S1.",
    authority:
      "Organizer, caregiver, or household-member status alone is not consent or subject authority. Identity & Consent checks current authority again for every action.",
    truth:
      "Submitting can confirm only that Community durably owns a pending request. It does not mean queued for matching, reviewed, eligible, safe, available, matched, accepted, delivered, or completed. Matching is unavailable in P5-S1.",
    retention:
      "Pending requests auto-close after 30 days. Closed fields are purged within 30 more days. Explicit deletion removes active fields immediately; no claim is made about production backups.",
    category: "Bounded category",
    location: "Province/city",
    locationHelp: "Manual province/city selection only. LifeBridge does not request GPS.",
    dayPart: "Broad time of day (optional)",
    flexible: "Flexible",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    noPreference: "No preference",
    consent: "I understand this purpose and visibility and consent to submit these bounded fields.",
    submit: "Submit bounded request",
    refresh: "Check current authoritative state",
    reconcile: "Reconcile uncertain submission",
    close: "Close request",
    remove: "Delete active request fields",
    validation: "Review the highlighted fields before submitting.",
    loading: "Loading fresh authority and current requests…",
    submitted:
      "Submission confirmed. The authoritative request is pending only; matching remains unavailable.",
    duplicate:
      "No second request was created. Community returned the existing authoritative request.",
    closed: "Closure confirmed. No completion, delivery, or outcome is inferred.",
    deleted: "Deletion confirmed. Active protected request fields are no longer available.",
    denied: "The request does not exist or this account lacks current purpose-scoped authority.",
    revoked: "Current consent is no longer available. No protected request action was performed.",
    conflict: "The request changed. Reload current state and review before another action.",
    uncertain:
      "The result is uncertain. Do not submit again. Reconcile using the same submission reference and a fresh authority decision.",
    unavailable:
      "Community or Identity & Consent is unavailable. No submission, queue, or persistence is claimed.",
    offline:
      "Offline: protected requests are blocked, not queued, and will not be submitted automatically.",
    current: "Current authoritative requests",
    empty: "No authorized active request is currently returned.",
    pending: "Pending",
    statusClosed: "Closed",
    version: "Version",
    directoryTitle: "Public community support directory",
    directoryIntro:
      "Public reviewed listings are informational. LifeBridge does not determine eligibility, availability, safety, endorsement, match quality, or outcome.",
    publicBoundary:
      "This public search does not use household, consent, care-recipient, or help-request data. Matching is unavailable in P5-S1.",
    orgType: "Organization type",
    all: "All",
    publicService: "Public service",
    nonprofit: "Nonprofit",
    communityGroup: "Community group",
    search: "Search reviewed listings",
    directoryLoading: "Loading public reviewed listings…",
    noResults:
      "No reviewed listing matched these filters. This does not mean support is unavailable.",
    searchUnavailable:
      "Directory search is unavailable. This is not an empty result and no eligibility conclusion is made.",
    stale:
      "Provenance is stale. Verify the organization’s public source before relying on this listing.",
    offlineCache:
      "Offline, stale cached public listing. Review and cache times are shown; availability is not verified.",
    offlineEmpty: "Offline and no trusted public cache is available.",
    locationDenied:
      "Device location permission is denied. LifeBridge did not request or send GPS; choose a province/city manually.",
    locationUnavailable:
      "Device location permission is not denied, but automatic province/city lookup is unavailable in P5-S1. LifeBridge did not request or send GPS; choose manually.",
    useLocation: "Check location permission",
    provenance: "Public provenance",
    reviewed: "Last reviewed",
    nextReview: "Next review",
    availability: "Availability not verified",
    eligibility: "Eligibility not determined",
    endorsement: "No LifeBridge endorsement",
    contact: "Organization-published contact",
    cached: "Cached",
  },
  "vi-VN": {
    skip: "Bỏ qua đến nội dung chính",
    language: "Ngôn ngữ",
    helpTitle: "Yêu cầu hỗ trợ cộng đồng có giới hạn",
    helpIntro:
      "Chỉ chọn một nhóm hỗ trợ có giới hạn, tỉnh/thành phố và tùy chọn buổi trong ngày. Không nhập chẩn đoán, điều trị, mức khẩn cấp, địa chỉ chính xác hoặc câu chuyện cá nhân.",
    purposeTitle: "Mục đích, phạm vi hiển thị và đồng thuận",
    purpose:
      "Mục đích: hỗ trợ cộng đồng. Yêu cầu chỉ hiển thị cho người nhận chăm sóc và tài khoản có cấp quyền hỗ trợ cộng đồng hiện hành. Yêu cầu không công khai và chưa được gửi cho tổ chức trong danh bạ ở P5-S1.",
    authority:
      "Chỉ vai trò người tổ chức, người chăm sóc hoặc thành viên gia đình không phải là đồng thuận hay thẩm quyền của chủ thể. Dịch vụ Danh tính & Đồng thuận kiểm tra lại thẩm quyền hiện hành cho từng thao tác.",
    truth:
      "Gửi chỉ có thể xác nhận rằng dịch vụ Cộng đồng đã lưu bền vững một yêu cầu đang chờ. Điều này không có nghĩa là đã xếp hàng ghép nối, rà soát, đủ điều kiện, an toàn, có sẵn, ghép nối, chấp nhận, bàn giao hoặc hoàn tất. Ghép nối chưa có trong P5-S1.",
    retention:
      "Yêu cầu đang chờ tự đóng sau 30 ngày. Trường đã đóng được xóa trong tối đa 30 ngày tiếp theo. Xóa rõ ràng loại bỏ ngay trường đang hoạt động; không tuyên bố về bản sao lưu sản xuất.",
    category: "Nhóm hỗ trợ có giới hạn",
    location: "Tỉnh/thành phố",
    locationHelp: "Chỉ chọn tỉnh/thành phố thủ công. LifeBridge không yêu cầu GPS.",
    dayPart: "Buổi trong ngày (tùy chọn)",
    flexible: "Linh hoạt",
    morning: "Buổi sáng",
    afternoon: "Buổi chiều",
    evening: "Buổi tối",
    noPreference: "Không ưu tiên",
    consent: "Tôi hiểu mục đích và phạm vi hiển thị này, và đồng thuận gửi các trường có giới hạn.",
    submit: "Gửi yêu cầu có giới hạn",
    refresh: "Kiểm tra trạng thái có thẩm quyền hiện tại",
    reconcile: "Đối soát lần gửi chưa chắc chắn",
    close: "Đóng yêu cầu",
    remove: "Xóa trường yêu cầu đang hoạt động",
    validation: "Hãy xem lại các trường được đánh dấu trước khi gửi.",
    loading: "Đang tải thẩm quyền mới và yêu cầu hiện tại…",
    submitted: "Đã xác nhận gửi. Trạng thái có thẩm quyền chỉ là đang chờ; ghép nối vẫn chưa có.",
    duplicate: "Không tạo yêu cầu thứ hai. Dịch vụ Cộng đồng trả về yêu cầu có thẩm quyền hiện có.",
    closed: "Đã xác nhận đóng. Không suy diễn là hoàn tất, bàn giao hoặc có kết quả.",
    deleted: "Đã xác nhận xóa. Trường yêu cầu được bảo vệ đang hoạt động không còn khả dụng.",
    denied: "Yêu cầu không tồn tại hoặc tài khoản này thiếu thẩm quyền hiện hành theo mục đích.",
    revoked:
      "Đồng thuận hiện hành không còn khả dụng. Không thực hiện thao tác yêu cầu được bảo vệ.",
    conflict: "Yêu cầu đã thay đổi. Hãy tải trạng thái hiện tại và xem lại trước khi thao tác.",
    uncertain:
      "Kết quả chưa chắc chắn. Không gửi lại. Hãy đối soát bằng cùng mã lần gửi và một quyết định thẩm quyền mới.",
    unavailable:
      "Dịch vụ Cộng đồng hoặc Danh tính & Đồng thuận không khả dụng. Không tuyên bố đã gửi, xếp hàng hoặc lưu.",
    offline: "Ngoại tuyến: yêu cầu được bảo vệ bị chặn, không xếp hàng và sẽ không tự động gửi.",
    current: "Yêu cầu có thẩm quyền hiện tại",
    empty: "Hiện không trả về yêu cầu đang hoạt động được cấp quyền.",
    pending: "Đang chờ",
    statusClosed: "Đã đóng",
    version: "Phiên bản",
    directoryTitle: "Danh bạ hỗ trợ cộng đồng công khai",
    directoryIntro:
      "Danh sách công khai đã rà soát chỉ mang tính thông tin. LifeBridge không xác định điều kiện, tính sẵn có, an toàn, chứng thực, chất lượng ghép nối hoặc kết quả.",
    publicBoundary:
      "Tìm kiếm công khai này không dùng dữ liệu gia đình, đồng thuận, người nhận chăm sóc hoặc yêu cầu hỗ trợ. Ghép nối chưa có trong P5-S1.",
    orgType: "Loại tổ chức",
    all: "Tất cả",
    publicService: "Dịch vụ công",
    nonprofit: "Phi lợi nhuận",
    communityGroup: "Nhóm cộng đồng",
    search: "Tìm danh sách đã rà soát",
    directoryLoading: "Đang tải danh sách công khai đã rà soát…",
    noResults:
      "Không có danh sách đã rà soát khớp bộ lọc. Điều này không có nghĩa là hỗ trợ không có sẵn.",
    searchUnavailable:
      "Tìm kiếm danh bạ không khả dụng. Đây không phải là kết quả trống và không có kết luận về điều kiện.",
    stale:
      "Nguồn gốc đã cũ. Hãy xác minh nguồn công khai của tổ chức trước khi sử dụng danh sách này.",
    offlineCache:
      "Ngoại tuyến, danh sách công khai lưu đệm đã cũ. Thời gian rà soát và lưu đệm được hiển thị; tính sẵn có chưa được xác minh.",
    offlineEmpty: "Ngoại tuyến và không có bộ đệm công khai đáng tin cậy.",
    locationDenied:
      "Quyền vị trí thiết bị đang bị từ chối. LifeBridge không yêu cầu hoặc gửi GPS; hãy chọn tỉnh/thành phố thủ công.",
    locationUnavailable:
      "Quyền vị trí thiết bị không bị từ chối, nhưng P5-S1 chưa có tra cứu tỉnh/thành phố tự động. LifeBridge không yêu cầu hoặc gửi GPS; hãy chọn thủ công.",
    useLocation: "Kiểm tra quyền vị trí",
    provenance: "Nguồn gốc công khai",
    reviewed: "Rà soát lần cuối",
    nextReview: "Rà soát tiếp theo",
    availability: "Chưa xác minh tính sẵn có",
    eligibility: "Chưa xác định điều kiện",
    endorsement: "LifeBridge không chứng thực",
    contact: "Liên hệ do tổ chức công bố",
    cached: "Đã lưu đệm",
  },
} as const;

export function HelpRequestApp({ householdId }: { householdId: string }) {
  const [locale, setLocale] = useState<Locale>("vi-VN");
  const [phase, setPhase] = useState<HelpPhase>("loading");
  const [csrf, setCsrf] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("daily_living_support");
  const [provinceCityCode, setProvinceCityCode] = useState("SYN-PC-001");
  const [dayPart, setDayPart] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [requests, setRequests] = useState<CommunityHelpRequestProjection[]>([]);
  const [pendingReference, setPendingReference] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLHeadingElement>(null);
  const text = copy[locale];

  const load = useCallback(async () => {
    if (!householdId) {
      setPhase("denied");
      return;
    }
    if (!navigator.onLine) {
      setPhase("offline");
      return;
    }
    setPhase("loading");
    try {
      const sessionResponse = await fetch("/api/v1/account/session", {
        credentials: "same-origin",
        headers: { "x-correlation-id": correlation() },
      });
      const sessionBody = await sessionResponse.json();
      if (!sessionResponse.ok) throw new ApiError(failureCode(sessionBody));
      const session = IdentitySessionProjectionSchema.parse(sessionBody.data);
      setCsrf(session.csrfToken);
      const list = await protectedFetch(
        `/api/v1/households/${encodeURIComponent(householdId)}/community/help-requests/query`,
        "POST",
        {},
        session.csrfToken,
      );
      if (!list.ok) throw new ApiError(failureCode(list.body));
      const parsed = CommunityHelpRequestListSuccessSchema.parse(list.body);
      setRequests(parsed.data.requests);
      setPhase("draft");
    } catch (error) {
      setPhase(helpFailurePhase(error));
    }
  }, [householdId]);

  useEffect(() => {
    void load();
    const offline = () => setPhase("offline");
    window.addEventListener("offline", offline);
    return () => window.removeEventListener("offline", offline);
  }, [load]);

  useEffect(() => {
    if (phase === "validation") errorRef.current?.focus();
    if (
      [
        "submitted",
        "duplicate",
        "closed",
        "deleted",
        "denied",
        "revoked",
        "conflict",
        "uncertain",
        "unavailable",
        "offline",
      ].includes(phase)
    ) {
      headingRef.current?.focus();
    }
  }, [phase]);

  const submit = async () => {
    if (!navigator.onLine) {
      setPhase("offline");
      return;
    }
    if (!confirmed || !provinceCityCode) {
      setPhase("validation");
      return;
    }
    const submissionReference = `submission_${crypto.randomUUID().replaceAll("-", "")}`;
    setPendingReference(submissionReference);
    setPhase("submitting");
    try {
      const result = await protectedFetch(
        `/api/v1/households/${encodeURIComponent(householdId)}/community/help-requests`,
        "POST",
        {
          submissionReference,
          category,
          location: { granularity: "province_city", provinceCityCode },
          dayPart: dayPart || null,
          disclosure: {
            purpose: "community_support",
            visibility: "current_request_collaborators",
            policyVersion: "P5-S1-v1",
            confirmed: true,
          },
        },
        csrf,
        crypto.randomUUID(),
      );
      if (!result.ok) throw new ApiError(failureCode(result.body));
      const parsed = CommunityHelpRequestMutationSuccessSchema.parse(result.body);
      setRequests((current) => [
        parsed.data.request,
        ...current.filter((item) => item.requestId !== parsed.data.request.requestId),
      ]);
      setPhase(parsed.data.duplicate ? "duplicate" : "submitted");
    } catch (error) {
      setPhase(helpFailurePhase(error));
    }
  };

  const reconcile = async () => {
    if (!pendingReference || !navigator.onLine) {
      setPhase("offline");
      return;
    }
    setPhase("loading");
    try {
      const result = await protectedFetch(
        `/api/v1/households/${encodeURIComponent(householdId)}/community/help-requests/reconcile`,
        "POST",
        { submissionReference: pendingReference },
        csrf,
      );
      if (!result.ok) throw new ApiError(failureCode(result.body));
      const parsed = CommunityHelpRequestMutationSuccessSchema.parse(result.body);
      setRequests((current) => [
        parsed.data.request,
        ...current.filter((item) => item.requestId !== parsed.data.request.requestId),
      ]);
      setPhase(parsed.data.request.status === "closed" ? "closed" : "submitted");
    } catch (error) {
      setPhase(helpFailurePhase(error));
    }
  };

  const mutate = async (request: CommunityHelpRequestProjection, operation: "close" | "delete") => {
    if (!navigator.onLine) {
      setPhase("offline");
      return;
    }
    setPhase("loading");
    const path =
      operation === "close"
        ? `/api/v1/households/${encodeURIComponent(householdId)}/community/help-requests/${encodeURIComponent(request.requestId)}/close`
        : `/api/v1/households/${encodeURIComponent(householdId)}/community/help-requests/${encodeURIComponent(request.requestId)}`;
    try {
      const result = await protectedFetch(
        path,
        operation === "close" ? "POST" : "DELETE",
        { expectedVersion: request.version },
        csrf,
        crypto.randomUUID(),
      );
      if (!result.ok) throw new ApiError(failureCode(result.body));
      if (operation === "close") {
        const parsed = CommunityHelpRequestMutationSuccessSchema.parse(result.body);
        setRequests((current) =>
          current.map((item) =>
            item.requestId === parsed.data.request.requestId ? parsed.data.request : item,
          ),
        );
        setPhase("closed");
      } else {
        const parsed = CommunityHelpRequestDeleteSuccessSchema.parse(result.body);
        setRequests((current) =>
          current.filter((item) => item.requestId !== parsed.data.deletedRequestId),
        );
        setPhase("deleted");
      }
    } catch (error) {
      setPhase(helpFailurePhase(error));
    }
  };

  return (
    <div className="community-app">
      <a className="skip-link" href="#community-main">
        {text.skip}
      </a>
      <header className="community-header">
        <strong>LifeBridge</strong>
        <label>
          {text.language}
          <select
            aria-label={text.language}
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <main id="community-main" className="community-main">
        <h1>{text.helpTitle}</h1>
        <p>{text.helpIntro}</p>
        <section className="community-boundary" aria-labelledby="purpose-heading">
          <h2 id="purpose-heading">{text.purposeTitle}</h2>
          <p>{text.purpose}</p>
          <p>{text.authority}</p>
          <p>{text.truth}</p>
          <p>{text.retention}</p>
        </section>
        <HelpStatus phase={phase} text={text} headingRef={headingRef} errorRef={errorRef} />
        <form
          className="community-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          <label>
            {text.category}
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as typeof category)}
            >
              {categories.map((value) => (
                <option key={value} value={value}>
                  {categoryLabels[locale][value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {text.location}
            <select
              value={provinceCityCode}
              aria-describedby="location-help"
              onChange={(event) => setProvinceCityCode(event.target.value)}
            >
              <option value="SYN-PC-001">Synthetic Province/City 001</option>
              <option value="SYN-PC-002">Synthetic Province/City 002</option>
            </select>
          </label>
          <p id="location-help">{text.locationHelp}</p>
          <label>
            {text.dayPart}
            <select value={dayPart} onChange={(event) => setDayPart(event.target.value)}>
              <option value="">{text.noPreference}</option>
              <option value="flexible">{text.flexible}</option>
              <option value="morning">{text.morning}</option>
              <option value="afternoon">{text.afternoon}</option>
              <option value="evening">{text.evening}</option>
            </select>
          </label>
          <label className="community-check">
            <input
              type="checkbox"
              checked={confirmed}
              aria-invalid={phase === "validation" && !confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>{text.consent}</span>
          </label>
          <button type="submit" disabled={phase === "submitting" || phase === "loading"}>
            {text.submit}
          </button>
        </form>
        <div className="action-row">
          <button type="button" className="secondary-action" onClick={() => void load()}>
            {text.refresh}
          </button>
          {phase === "uncertain" && pendingReference ? (
            <button type="button" onClick={() => void reconcile()}>
              {text.reconcile}
            </button>
          ) : null}
        </div>
        <section aria-labelledby="current-heading">
          <h2 id="current-heading">{text.current}</h2>
          {requests.length === 0 ? <p>{text.empty}</p> : null}
          <ul className="community-list">
            {requests.map((request) => (
              <li key={request.requestId}>
                <h3>{categoryLabels[locale][request.category]}</h3>
                <dl>
                  <div>
                    <dt>{text.location}</dt>
                    <dd>{request.provinceCityCode}</dd>
                  </div>
                  <div>
                    <dt>{text.version}</dt>
                    <dd>{request.version}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{request.status === "pending" ? text.pending : text.statusClosed}</dd>
                  </div>
                </dl>
                <p>{text.truth}</p>
                <div className="action-row">
                  {request.status === "pending" ? (
                    <button type="button" onClick={() => void mutate(request, "close")}>
                      {text.close}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void mutate(request, "delete")}
                  >
                    {text.remove}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

export function PublicDirectoryApp() {
  const [locale, setLocale] = useState<Locale>("vi-VN");
  const [phase, setPhase] = useState<DirectoryPhase>("loading");
  const [category, setCategory] = useState("");
  const [provinceCityCode, setProvinceCityCode] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [result, setResult] = useState<CommunityPublicDirectoryResult | null>(null);
  const [cachedAt, setCachedAt] = useState("");
  const text = copy[locale];

  const search = useCallback(async () => {
    if (!navigator.onLine) {
      const cached = readDirectoryCache();
      if (cached) {
        setResult(cached.result);
        setCachedAt(cached.savedAt);
        setPhase("offline-cache");
      } else {
        setResult(null);
        setPhase("offline-empty");
      }
      return;
    }
    setPhase("loading");
    const query = new URLSearchParams();
    if (category) query.set("category", category);
    if (provinceCityCode) query.set("provinceCityCode", provinceCityCode);
    if (organizationType) query.set("organizationType", organizationType);
    try {
      const response = await fetch(`/api/v1/community?${query}`, {
        headers: { "x-correlation-id": correlation() },
      });
      const body = await response.json();
      if (!response.ok) throw new ApiError(failureCode(body));
      const parsed = CommunityDirectorySuccessSchema.parse(body);
      setResult(parsed.data);
      const savedAt = new Date().toISOString();
      setCachedAt(savedAt);
      sessionStorage.setItem(
        "lifebridge:p5-s1:public-directory",
        JSON.stringify({ savedAt, result: parsed.data }),
      );
      setPhase(
        parsed.data.items.length === 0
          ? "empty"
          : parsed.data.items.some((item) => item.provenance.state === "stale")
            ? "stale"
            : "ready",
      );
    } catch {
      setResult(null);
      setPhase("unavailable");
    }
  }, [category, organizationType, provinceCityCode]);

  useEffect(() => {
    void search();
    const offline = () => void search();
    window.addEventListener("offline", offline);
    return () => window.removeEventListener("offline", offline);
  }, [search]);

  const checkLocationPermission = async () => {
    if (!navigator.permissions) {
      setPhase("location-unavailable");
      return;
    }
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      setPhase(permission.state === "denied" ? "location-denied" : "location-unavailable");
    } catch {
      setPhase("location-unavailable");
    }
  };

  return (
    <div className="community-app directory-app">
      <a className="skip-link" href="#directory-main">
        {text.skip}
      </a>
      <header className="community-header">
        <strong>LifeBridge</strong>
        <label>
          {text.language}
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <main id="directory-main" className="community-main">
        <h1>{text.directoryTitle}</h1>
        <p>{text.directoryIntro}</p>
        <aside className="community-boundary">
          <p>{text.publicBoundary}</p>
        </aside>
        <form
          className="directory-filters"
          onSubmit={(event) => {
            event.preventDefault();
            void search();
          }}
        >
          <label>
            {text.category}
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">{text.all}</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {categoryLabels[locale][value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {text.location}
            <select
              value={provinceCityCode}
              onChange={(event) => setProvinceCityCode(event.target.value)}
            >
              <option value="">{text.all}</option>
              <option value="SYN-PC-001">Synthetic Province/City 001</option>
              <option value="SYN-PC-002">Synthetic Province/City 002</option>
            </select>
          </label>
          <label>
            {text.orgType}
            <select
              value={organizationType}
              onChange={(event) => setOrganizationType(event.target.value)}
            >
              <option value="">{text.all}</option>
              <option value="public_service">{text.publicService}</option>
              <option value="nonprofit">{text.nonprofit}</option>
              <option value="community_group">{text.communityGroup}</option>
            </select>
          </label>
          <div className="action-row">
            <button type="submit">{text.search}</button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => void checkLocationPermission()}
            >
              {text.useLocation}
            </button>
          </div>
        </form>
        <DirectoryStatus phase={phase} text={text} cachedAt={cachedAt} />
        <ul className="directory-list">
          {result?.items.map((item) => (
            <li key={item.listingId}>
              <h2>{item.publicName}</h2>
              <p>{item.provinceCityLabel}</p>
              <ul>
                {item.categories.map((value) => (
                  <li key={value}>{categoryLabels[locale][value]}</li>
                ))}
              </ul>
              <dl>
                <div>
                  <dt>{text.contact}</dt>
                  <dd>
                    {item.contactChannel.label}: {item.contactChannel.value}
                  </dd>
                </div>
                <div>
                  <dt>{text.provenance}</dt>
                  <dd>
                    <PublicSourceLink
                      url={item.provenance.sourceUrl}
                      label={item.provenance.sourceLabel}
                    />
                  </dd>
                </div>
                <div>
                  <dt>{text.reviewed}</dt>
                  <dd>{item.provenance.lastReviewedAt}</dd>
                </div>
                <div>
                  <dt>{text.nextReview}</dt>
                  <dd>{item.provenance.nextReviewAt}</dd>
                </div>
              </dl>
              {item.provenance.state === "stale" ? <p className="warning">{text.stale}</p> : null}
              <p>
                {text.availability}. {text.eligibility}. {text.endorsement}.
              </p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function HelpStatus({
  phase,
  text,
  headingRef,
  errorRef,
}: {
  phase: HelpPhase;
  text: (typeof copy)[Locale];
  headingRef: RefObject<HTMLHeadingElement | null>;
  errorRef: RefObject<HTMLHeadingElement | null>;
}) {
  const messages: Partial<Record<HelpPhase, string>> = {
    loading: text.loading,
    validation: text.validation,
    submitted: text.submitted,
    duplicate: text.duplicate,
    closed: text.closed,
    deleted: text.deleted,
    denied: text.denied,
    revoked: text.revoked,
    conflict: text.conflict,
    uncertain: text.uncertain,
    unavailable: text.unavailable,
    offline: text.offline,
  };
  const message = messages[phase];
  if (!message) return null;
  const ref = phase === "validation" ? errorRef : headingRef;
  return (
    <section className={`community-state state-${phase}`} role="status" aria-live="polite">
      <h2 ref={ref} tabIndex={-1}>
        {message}
      </h2>
    </section>
  );
}

function DirectoryStatus({
  phase,
  text,
  cachedAt,
}: {
  phase: DirectoryPhase;
  text: (typeof copy)[Locale];
  cachedAt: string;
}) {
  const messages: Record<DirectoryPhase, string> = {
    loading: text.directoryLoading,
    ready: "",
    empty: text.noResults,
    stale: text.stale,
    unavailable: text.searchUnavailable,
    "offline-cache": `${text.offlineCache} ${text.cached}: ${cachedAt}.`,
    "offline-empty": text.offlineEmpty,
    "location-denied": text.locationDenied,
    "location-unavailable": text.locationUnavailable,
  };
  const message = messages[phase];
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (message) headingRef.current?.focus();
  }, [message]);
  return message ? (
    <section
      className={`community-state directory-state-${phase}`}
      role="status"
      aria-live="polite"
    >
      <h2 ref={headingRef} tabIndex={-1}>
        {message}
      </h2>
    </section>
  ) : null;
}

async function protectedFetch(
  path: string,
  method: "POST" | "DELETE",
  body: unknown,
  csrf: string,
  idempotencyKey?: string,
) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf,
      "x-correlation-id": correlation(),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, status: response.status, body: await response.json() };
}

function failureCode(body: unknown): string {
  return String((body as FailureBody | null)?.error?.code ?? "COMMUNITY_SERVICE_UNAVAILABLE");
}

class ApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function helpFailurePhase(error: unknown): HelpPhase {
  const code = error instanceof ApiError ? error.code : "";
  if (code === "COMMUNITY_REQUEST_RESULT_UNKNOWN") return "uncertain";
  if (code === "COMMUNITY_CONSENT_REVOKED") return "revoked";
  if (
    code === "COMMUNITY_REQUEST_VERSION_CONFLICT" ||
    code === "COMMUNITY_REQUEST_STATE_CONFLICT" ||
    code === "IDEMPOTENCY_CONFLICT"
  )
    return "conflict";
  if (
    code === "COMMUNITY_RESOURCE_NOT_FOUND" ||
    code === "COMMUNITY_AUTHORITY_REQUIRED" ||
    code === "CONSENT_RESOURCE_NOT_FOUND"
  )
    return "denied";
  return navigator.onLine ? "unavailable" : "offline";
}

function correlation() {
  return `web_${crypto.randomUUID().replaceAll("-", "")}`;
}

function PublicSourceLink({ url, label }: { url: string; label: string }) {
  const href = publicHttpUrl(url);
  return href ? (
    <a href={href} rel="external noreferrer">
      {label}
    </a>
  ) : (
    <span>{label}</span>
  );
}

function publicHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readDirectoryCache(): {
  savedAt: string;
  result: CommunityPublicDirectoryResult;
} | null {
  try {
    const raw = sessionStorage.getItem("lifebridge:p5-s1:public-directory");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; result?: unknown };
    if (typeof parsed.savedAt !== "string") return null;
    if (Date.now() - Date.parse(parsed.savedAt) > 24 * 60 * 60_000) return null;
    const result = CommunityDirectorySuccessSchema.shape.data.parse(parsed.result);
    return { savedAt: parsed.savedAt, result };
  } catch {
    return null;
  }
}
