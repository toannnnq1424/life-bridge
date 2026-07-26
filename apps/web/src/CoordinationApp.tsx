"use client";

import {
  DailyTimelineProjectionSchema,
  HandoffResultProjectionSchema,
  HandoffReviewProjectionSchema,
  IdentitySessionProjectionSchema,
  type DailyTimelineProjection,
  type HandoffReasonCode,
  type HandoffResultProjection,
  type HandoffReviewProjection,
  type TimelineFilter,
} from "@lifebridge/contracts";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";

type CoordinationLocale = "vi-VN" | "en";
type CoordinationMode = "timeline" | "handoff";

interface CoordinationAppProps {
  mode: CoordinationMode;
  householdId: string;
  taskId?: string;
}

interface ApiFailure {
  code: string;
  retryable?: boolean;
}

class CoordinationApiError extends Error {
  public constructor(
    public readonly failure: ApiFailure,
    public readonly uncertain = false,
  ) {
    super(failure.code);
  }
}

const text = {
  "vi-VN": {
    skip: "Bỏ qua đến nội dung chính",
    brand: "LifeBridge",
    language: "Ngôn ngữ",
    timeline: "Dòng thời gian hằng ngày",
    timelineIntro:
      "Lịch sử công việc đã được máy chủ xác nhận cho ngày địa phương, múi giờ và bộ lọc đã chọn.",
    handoff: "Bàn giao công việc",
    handoffIntro:
      "Xem lại người đang chịu trách nhiệm, người được đề xuất, lý do và phiên bản trước khi xác nhận.",
    loading: "Đang tải trạng thái đã xác nhận…",
    retry: "Thử tải lại",
    offline:
      "Đang ngoại tuyến. Chỉ dữ liệu đã xác nhận đang hiển thị mới có thể đọc; bàn giao bị chặn và không được xếp hàng.",
    offlineUnavailable: "Không có bản đã xác nhận an toàn để hiển thị khi ngoại tuyến.",
    stale: "Bản đọc này có thể đã cũ. Lần xác nhận gần nhất:",
    date: "Ngày địa phương đã chọn",
    zone: "Múi giờ hiển thị IANA",
    previous: "Ngày trước",
    today: "Hôm nay",
    next: "Ngày sau",
    filter: "Bộ lọc sự kiện",
    all: "Tất cả",
    task_created: "Đã tạo",
    task_completed: "Đã hoàn tất",
    task_handoff: "Đã bàn giao",
    boundary: "Ranh giới ngày UTC",
    boundaryThrough: "đến trước",
    snapshot: "Ảnh chụp đã xác nhận lúc",
    historyUnavailable:
      "Lịch sử trước thời điểm bắt đầu phạm vi P3 không được điền ngược; ngày này có thể chưa đầy đủ.",
    emptyDay: "Không có sự kiện đã xác nhận trong ngày đã chọn.",
    emptyFilter: "Không có sự kiện khớp bộ lọc hiện tại trong ngày đã chọn.",
    eventActor: "Người thực hiện",
    fromActor: "Người bàn giao",
    toActor: "Người nhận",
    outcome: "Kết quả",
    confirmed: "Đã xác nhận",
    loadLater: "Tải các sự kiện tiếp theo",
    loadedLater: "Đã tải thêm sự kiện đã xác nhận.",
    deniedTitle: "Không thể mở nội dung này",
    deniedBody:
      "Nội dung không tồn tại hoặc tài khoản hiện tại không có quyền đã được quản trị đồng ý.",
    unavailableTitle: "Dịch vụ hiện không khả dụng",
    unavailableBody:
      "Không có kết quả trống nào được suy diễn. Giữ nguyên dữ liệu đã xác nhận nếu có và thử lại sau.",
    staleCursorTitle: "Trang tiếp theo đã cũ",
    staleCursorBody:
      "Các mục đã xác nhận vẫn được giữ. Tải lại ngày và bộ lọc hiện tại để bắt đầu ảnh chụp mới.",
    reloadCurrent: "Tải trạng thái hiện tại",
    task: "Công việc",
    currentActor: "Người đang chịu trách nhiệm",
    proposedActor: "Người được đề xuất",
    householdMember: "Thành viên hộ gia đình được phép",
    you: "Tài khoản của bạn",
    version: "Phiên bản dự kiến",
    reason: "Lý do có cấu trúc",
    availability_changed: "Thay đổi khả dụng",
    schedule_conflict: "Xung đột lịch",
    coverage_update: "Cập nhật phân công đã lên kế hoạch",
    other_coordination: "Điều phối khác",
    review: "Xem lại bàn giao",
    reviewHeading: "Kiểm tra trước khi xác nhận",
    immediate:
      "Bàn giao chỉ có hiệu lực khi máy chủ xác nhận; thời gian xảy ra và hiệu lực do máy chủ đặt.",
    cancel: "Hủy xem lại",
    confirm: "Xác nhận bàn giao",
    confirming: "Đang chờ máy chủ xác nhận…",
    completedBlocked: "Công việc đã hoàn tất nên không thể bàn giao.",
    noTarget: "Không có người nhận nào đang đủ điều kiện theo quyền hiện tại.",
    validation: "Chọn một người nhận khác và một lý do trước khi xem lại.",
    conflictHeading: "Công việc đã thay đổi",
    conflictBody:
      "Đề xuất của bạn chưa được gửi lại. Tải trạng thái đã xác nhận mới nhất rồi xem lại từ đầu.",
    uncertainHeading: "Chưa biết kết quả yêu cầu",
    uncertainBody:
      "Không gửi lại mù quáng. Kiểm tra trạng thái hiện tại để biết máy chủ đã xác nhận điều gì.",
    checkCurrent: "Kiểm tra trạng thái hiện tại",
    recovered:
      "Đã tải trạng thái hiện tại. Kiểm tra người chịu trách nhiệm và phiên bản trước khi tạo lượt xem lại mới.",
    successHeading: "Bàn giao đã được xác nhận",
    accepted: "Đã chấp nhận",
    effectiveAt: "Có hiệu lực lúc",
    occurredAt: "Được ghi nhận lúc",
    notification: "Trạng thái thông báo",
    pending: "Đang chờ giao riêng; bàn giao đã bền vững",
    suppressed: "Không tạo thông báo riêng",
  },
  en: {
    skip: "Skip to main content",
    brand: "LifeBridge",
    language: "Language",
    timeline: "Daily timeline",
    timelineIntro:
      "Server-confirmed work history for the selected local date, display zone, and filter.",
    handoff: "Task handoff",
    handoffIntro:
      "Review the current accountable person, proposed person, reason, and task version before confirmation.",
    loading: "Loading confirmed state…",
    retry: "Try loading again",
    offline:
      "You are offline. Only the confirmed data already shown is readable; handoff is blocked and never queued.",
    offlineUnavailable: "No safe confirmed view is available while offline.",
    stale: "This read may be stale. Last confirmed:",
    date: "Selected local date",
    zone: "IANA display time zone",
    previous: "Previous day",
    today: "Today",
    next: "Next day",
    filter: "Event filter",
    all: "All",
    task_created: "Created",
    task_completed: "Completed",
    task_handoff: "Handoff",
    boundary: "UTC day boundary",
    boundaryThrough: "through but excluding",
    snapshot: "Confirmed snapshot at",
    historyUnavailable:
      "History before P3 coverage began was not backfilled; this date may be incomplete.",
    emptyDay: "No confirmed events occurred on the selected day.",
    emptyFilter: "No events match the current filter on the selected day.",
    eventActor: "Actor",
    fromActor: "From",
    toActor: "To",
    outcome: "Outcome",
    confirmed: "Confirmed",
    loadLater: "Load later events",
    loadedLater: "More confirmed events loaded.",
    deniedTitle: "This content cannot be opened",
    deniedBody:
      "It may not exist, or the current account may not have governed permission to access it.",
    unavailableTitle: "The service is unavailable",
    unavailableBody:
      "No authoritative empty result was inferred. Confirmed data is retained when available; try again later.",
    staleCursorTitle: "The continuation is stale",
    staleCursorBody:
      "Already confirmed items are retained. Reload the current date and filter for a fresh snapshot.",
    reloadCurrent: "Load current state",
    task: "Task",
    currentActor: "Current accountable person",
    proposedActor: "Proposed person",
    householdMember: "Authorized household member",
    you: "Your account",
    version: "Expected version",
    reason: "Structured reason",
    availability_changed: "Availability changed",
    schedule_conflict: "Schedule conflict",
    coverage_update: "Planned coverage update",
    other_coordination: "Other coordination",
    review: "Review handoff",
    reviewHeading: "Check before confirmation",
    immediate:
      "The handoff becomes effective only when the server confirms it; occurrence and effective time are server-set.",
    cancel: "Cancel review",
    confirm: "Confirm handoff",
    confirming: "Waiting for server confirmation…",
    completedBlocked: "A completed task cannot be handed off.",
    noTarget: "No recipient is currently eligible under the governed permission.",
    validation: "Select a different recipient and reason before review.",
    conflictHeading: "The task has changed",
    conflictBody:
      "Your proposal has not been resubmitted. Load confirmed current state and review again.",
    uncertainHeading: "The request result is uncertain",
    uncertainBody: "Do not retry blindly. Check current state to learn what the server confirmed.",
    checkCurrent: "Check current state",
    recovered:
      "Current state loaded. Check the accountable person and version before starting a new review.",
    successHeading: "Handoff confirmed",
    accepted: "Accepted",
    effectiveAt: "Effective at",
    occurredAt: "Recorded at",
    notification: "Notification state",
    pending: "Pending separate delivery; the handoff is durable",
    suppressed: "No separate notification created",
  },
} as const;

type CopyKey = keyof (typeof text)["en"];

function copy(locale: CoordinationLocale, key: CopyKey): string {
  return text[locale][key];
}

function newIdempotencyKey(): string {
  return `p3_${crypto.randomUUID()}`;
}

async function api<T>(
  url: string,
  schema: { parse: (value: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-correlation-id": `web_${crypto.randomUUID().replaceAll("-", "")}`,
        ...init?.headers,
      },
    });
  } catch {
    throw new CoordinationApiError({ code: "NETWORK_UNAVAILABLE" }, Boolean(init?.method));
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CoordinationApiError({ code: "SERVICE_UNAVAILABLE" }, Boolean(init?.method));
  }
  if (!response.ok) {
    const failure = (body as { error?: ApiFailure } | null)?.error ?? {
      code: "SERVICE_UNAVAILABLE",
    };
    throw new CoordinationApiError(failure, Boolean(init?.method) && response.status >= 500);
  }
  return schema.parse((body as { data?: unknown }).data);
}

export function CoordinationApp({ mode, householdId, taskId }: CoordinationAppProps) {
  const [locale, setLocale] = useState<CoordinationLocale>("vi-VN");

  useEffect(() => {
    const stored = localStorage.getItem("lifebridge.locale");
    if (stored === "vi-VN" || stored === "en") setLocale(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("lifebridge.locale", locale);
  }, [locale]);

  return (
    <div className="coordination-app">
      <a className="skip-link" href="#coordination-main">
        {copy(locale, "skip")}
      </a>
      <header className="coordination-header">
        <a className="brand" href={`/households/${encodeURIComponent(householdId)}`}>
          {copy(locale, "brand")}
        </a>
        <label>
          <span>{copy(locale, "language")}</span>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as CoordinationLocale)}
          >
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      {mode === "timeline" ? (
        <TimelineView householdId={householdId} locale={locale} />
      ) : taskId ? (
        <HandoffView householdId={householdId} taskId={taskId} locale={locale} />
      ) : null}
    </div>
  );
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function TimelineView({
  householdId,
  locale,
}: {
  householdId: string;
  locale: CoordinationLocale;
}) {
  const online = useOnline();
  const zone = useRef(browserZone());
  const [localDate, setLocalDate] = useState(() => localDateInZone(new Date(), zone.current));
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [timeline, setTimeline] = useState<DailyTimelineProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(
    async (append = false) => {
      if (!online) {
        setLoading(false);
        return;
      }
      if (!append && timeline && (timeline.localDate !== localDate || timeline.filter !== filter)) {
        setTimeline(null);
      }
      setLoading(true);
      setFailure(null);
      try {
        const cursor = append ? timeline?.nextCursor : null;
        const query = new URLSearchParams({
          localDate,
          displayTimeZone: zone.current,
          filter,
          limit: "25",
        });
        if (cursor) query.set("cursor", cursor);
        const next = await api(
          `/api/v1/households/${encodeURIComponent(householdId)}/timeline?${query}`,
          DailyTimelineProjectionSchema,
        );
        setTimeline((current) =>
          append && current ? { ...next, items: [...current.items, ...next.items] } : next,
        );
        if (append) setAnnouncement(copy(locale, "loadedLater"));
      } catch (caught) {
        const nextFailure = failureFrom(caught);
        if (
          [
            "COORDINATION_RESOURCE_NOT_FOUND",
            "CONSENT_RESOURCE_NOT_FOUND",
            "SESSION_REQUIRED",
          ].includes(nextFailure.code)
        ) {
          setTimeline(null);
        }
        setFailure(nextFailure);
      } finally {
        setLoading(false);
      }
    },
    [filter, householdId, localDate, locale, online, timeline?.nextCursor],
  );

  useEffect(() => {
    void load(false);
  }, [filter, localDate, online]);

  return (
    <main id="coordination-main" className="coordination-main" tabIndex={-1}>
      <h1 ref={headingRef} tabIndex={-1}>
        {copy(locale, "timeline")}
      </h1>
      <p>{copy(locale, "timelineIntro")}</p>
      {!online ? (
        <StatePanel tone="warning" role="status" heading={copy(locale, "offline")}>
          {timeline ? (
            <p>
              {copy(locale, "stale")}{" "}
              <time dateTime={timeline.snapshotAt}>
                {formatInstant(timeline.snapshotAt, locale, timeline.displayTimeZone)}
              </time>
            </p>
          ) : (
            <p>{copy(locale, "offlineUnavailable")}</p>
          )}
        </StatePanel>
      ) : null}
      <div className="sr-status" aria-live="polite">
        {announcement}
      </div>
      <form
        className="timeline-controls"
        aria-label={copy(locale, "timeline")}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="date-actions">
          <button
            type="button"
            disabled={!online}
            onClick={() => setLocalDate(addDays(localDate, -1))}
          >
            {copy(locale, "previous")}
          </button>
          <button
            type="button"
            disabled={!online}
            onClick={() => setLocalDate(localDateInZone(new Date(), zone.current))}
          >
            {copy(locale, "today")}
          </button>
          <button
            type="button"
            disabled={!online}
            onClick={() => setLocalDate(addDays(localDate, 1))}
          >
            {copy(locale, "next")}
          </button>
        </div>
        <label>
          <span>{copy(locale, "date")}</span>
          <input
            type="date"
            disabled={!online}
            value={localDate}
            onChange={(event) => setLocalDate(event.target.value)}
          />
        </label>
        <label>
          <span>{copy(locale, "zone")}</span>
          <input value={zone.current} readOnly />
        </label>
        <label>
          <span>{copy(locale, "filter")}</span>
          <select
            disabled={!online}
            value={filter}
            onChange={(event) => setFilter(event.target.value as TimelineFilter)}
          >
            {(["all", "task_created", "task_completed", "task_handoff"] as const).map((value) => (
              <option key={value} value={value}>
                {copy(locale, value)}
              </option>
            ))}
          </select>
        </label>
      </form>
      {loading && !timeline && !failure ? (
        <StatePanel role="status" heading={copy(locale, "loading")} />
      ) : null}
      {failure ? (
        <CoordinationFailure
          failure={failure}
          locale={locale}
          retained={Boolean(timeline)}
          onRetry={() => void load(false)}
        />
      ) : null}
      {timeline ? (
        <>
          <section className="timeline-scope" aria-label={copy(locale, "boundary")}>
            <dl>
              <div>
                <dt>{copy(locale, "boundary")}</dt>
                <dd>
                  <time dateTime={timeline.dayStartUtc}>{timeline.dayStartUtc}</time>{" "}
                  {copy(locale, "boundaryThrough")}{" "}
                  <time dateTime={timeline.dayEndUtc}>{timeline.dayEndUtc}</time>
                </dd>
              </div>
              <div>
                <dt>{copy(locale, "filter")}</dt>
                <dd>{copy(locale, timeline.filter)}</dd>
              </div>
              <div>
                <dt>{copy(locale, "snapshot")}</dt>
                <dd>
                  <time dateTime={timeline.snapshotAt}>
                    {formatInstant(timeline.snapshotAt, locale, timeline.displayTimeZone)}
                  </time>
                </dd>
              </div>
            </dl>
          </section>
          {timeline.coverage === "history_unavailable" ? (
            <StatePanel tone="warning" role="status" heading={copy(locale, "historyUnavailable")} />
          ) : null}
          {timeline.items.length === 0 ? (
            <StatePanel heading={copy(locale, filter === "all" ? "emptyDay" : "emptyFilter")} />
          ) : (
            <ol className="timeline-list">
              {timeline.items.map((item) => (
                <li key={item.eventRef}>
                  <article>
                    <div className="timeline-time">
                      <time dateTime={item.occurredAt}>
                        {formatInstant(item.occurredAt, locale, timeline.displayTimeZone)}
                      </time>
                    </div>
                    <h2>
                      <a
                        href={`/households/${encodeURIComponent(householdId)}/tasks/${encodeURIComponent(item.taskId)}`}
                      >
                        {item.taskTitle}
                      </a>
                    </h2>
                    <p className="event-kind">{copy(locale, item.kind)}</p>
                    <dl>
                      {item.actor ? (
                        <ActorFact
                          label={copy(locale, "eventActor")}
                          actor={item.actor}
                          locale={locale}
                        />
                      ) : null}
                      {item.fromActor ? (
                        <ActorFact
                          label={copy(locale, "fromActor")}
                          actor={item.fromActor}
                          locale={locale}
                        />
                      ) : null}
                      {item.toActor ? (
                        <ActorFact
                          label={copy(locale, "toActor")}
                          actor={item.toActor}
                          locale={locale}
                        />
                      ) : null}
                      <div>
                        <dt>{copy(locale, "outcome")}</dt>
                        <dd>{copy(locale, "confirmed")}</dd>
                      </div>
                    </dl>
                  </article>
                </li>
              ))}
            </ol>
          )}
          {timeline.nextCursor && online ? (
            <button
              type="button"
              className="load-later"
              disabled={loading}
              onClick={() => void load(true)}
            >
              {copy(locale, "loadLater")}
            </button>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function HandoffView({
  householdId,
  taskId,
  locale,
}: {
  householdId: string;
  taskId: string;
  locale: CoordinationLocale;
}) {
  const online = useOnline();
  const zone = useRef(browserZone());
  const [csrf, setCsrf] = useState("");
  const [review, setReview] = useState<HandoffReviewProjection | null>(null);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState<HandoffReasonCode>("availability_changed");
  const [phase, setPhase] = useState<
    "edit" | "review" | "saving" | "success" | "conflict" | "uncertain" | "recovery"
  >("edit");
  const [result, setResult] = useState<HandoffResultProjection | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [loading, setLoading] = useState(true);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const stateHeadingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(
    async (recovery = false) => {
      if (!online) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setFailure(null);
      try {
        const [session, handoff] = await Promise.all([
          api("/api/v1/account/session", IdentitySessionProjectionSchema),
          api(
            `/api/v1/households/${encodeURIComponent(householdId)}/tasks/${encodeURIComponent(taskId)}/handoff?displayTimeZone=${encodeURIComponent(zone.current)}`,
            HandoffReviewProjectionSchema,
          ),
        ]);
        setCsrf(session.csrfToken);
        setReview(handoff);
        setTarget("");
        setIdempotencyKey(newIdempotencyKey());
        setPhase(recovery ? "recovery" : "edit");
        requestAnimationFrame(() => stateHeadingRef.current?.focus());
      } catch (caught) {
        setFailure(failureFrom(caught));
      } finally {
        setLoading(false);
      }
    },
    [householdId, online, taskId],
  );

  useEffect(() => {
    void load(false);
  }, [online]);

  useEffect(() => {
    const shouldFocus =
      (phase === "edit" && failure !== null) ||
      ["review", "success", "conflict", "uncertain", "recovery"].includes(phase);
    if (!shouldFocus) return;
    const frame = requestAnimationFrame(() => stateHeadingRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [failure, phase]);

  function beginReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || !review?.eligibleTargets.some((actor) => actor.actorRef === target)) {
      setFailure({ code: "HANDOFF_VALIDATION_FAILED" });
      requestAnimationFrame(() => stateHeadingRef.current?.focus());
      return;
    }
    setFailure(null);
    setPhase("review");
    setIdempotencyKey(newIdempotencyKey());
    requestAnimationFrame(() => stateHeadingRef.current?.focus());
  }

  async function confirm() {
    if (!review || !target || !online) return;
    setPhase("saving");
    setFailure(null);
    try {
      const accepted = await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/tasks/${encodeURIComponent(taskId)}/handoffs`,
        HandoffResultProjectionSchema,
        {
          method: "POST",
          headers: {
            "x-csrf-token": csrf,
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({
            operation: "handoff",
            expectedTaskVersion: review.taskVersion,
            expectedFromActorRef: review.currentActor.actorRef,
            toActorRef: target,
            reasonCode: reason,
            effectiveTime: { mode: "immediate", displayTimeZone: zone.current },
          }),
        },
      );
      setResult(accepted);
      setPhase("success");
    } catch (caught) {
      const error =
        caught instanceof CoordinationApiError
          ? caught
          : new CoordinationApiError({ code: "SERVICE_UNAVAILABLE" }, true);
      setFailure(error.failure);
      setPhase(
        error.uncertain
          ? "uncertain"
          : error.failure.code.includes("CONFLICT")
            ? "conflict"
            : "edit",
      );
    } finally {
      requestAnimationFrame(() => stateHeadingRef.current?.focus());
    }
  }

  return (
    <main id="coordination-main" className="coordination-main" tabIndex={-1}>
      <h1>{copy(locale, "handoff")}</h1>
      <p>{copy(locale, "handoffIntro")}</p>
      {!online ? (
        <StatePanel tone="warning" role="status" heading={copy(locale, "offline")} />
      ) : null}
      {loading && !review ? (
        <StatePanel role="status" heading={copy(locale, "loading")} />
      ) : failure && !review ? (
        <CoordinationFailure
          failure={failure}
          locale={locale}
          retained={false}
          onRetry={() => void load(false)}
        />
      ) : review ? (
        <article className="handoff-card">
          <h2>{review.taskTitle}</h2>
          <dl className="handoff-facts">
            <ActorFact
              label={copy(locale, "currentActor")}
              actor={review.currentActor}
              locale={locale}
            />
            <div>
              <dt>{copy(locale, "version")}</dt>
              <dd>{review.taskVersion}</dd>
            </div>
            <div>
              <dt>{copy(locale, "zone")}</dt>
              <dd>{review.displayTimeZone}</dd>
            </div>
          </dl>
          {phase === "recovery" ? (
            <StatePanel
              role="status"
              heading={copy(locale, "recovered")}
              headingRef={stateHeadingRef}
            />
          ) : null}
          {review.taskStatus === "completed" ? (
            <StatePanel heading={copy(locale, "completedBlocked")} />
          ) : review.eligibleTargets.length === 0 ? (
            <StatePanel heading={copy(locale, "noTarget")} />
          ) : phase === "edit" || phase === "recovery" ? (
            <form onSubmit={beginReview} noValidate>
              {failure ? (
                <div className="error-summary" role="alert" tabIndex={-1} ref={stateHeadingRef}>
                  <h2>{copy(locale, "validation")}</h2>
                </div>
              ) : null}
              <label>
                <span>{copy(locale, "proposedActor")}</span>
                <select value={target} onChange={(event) => setTarget(event.target.value)}>
                  <option value="">—</option>
                  {review.eligibleTargets.map((actor) => (
                    <option key={actor.actorRef} value={actor.actorRef}>
                      {actorLabel(actor, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{copy(locale, "reason")}</span>
                <select
                  value={reason}
                  onChange={(event) => setReason(event.target.value as HandoffReasonCode)}
                >
                  {(
                    [
                      "availability_changed",
                      "schedule_conflict",
                      "coverage_update",
                      "other_coordination",
                    ] as const
                  ).map((value) => (
                    <option key={value} value={value}>
                      {copy(locale, value)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={!online}>
                {copy(locale, "review")}
              </button>
            </form>
          ) : phase === "review" || phase === "saving" ? (
            <section className="review-panel" aria-labelledby="handoff-review-heading">
              <h2 id="handoff-review-heading" tabIndex={-1} ref={stateHeadingRef}>
                {copy(locale, "reviewHeading")}
              </h2>
              <dl className="handoff-facts">
                <div>
                  <dt>{copy(locale, "task")}</dt>
                  <dd>{review.taskTitle}</dd>
                </div>
                <ActorFact
                  label={copy(locale, "currentActor")}
                  actor={review.currentActor}
                  locale={locale}
                />
                <ActorFact
                  label={copy(locale, "proposedActor")}
                  actor={review.eligibleTargets.find((actor) => actor.actorRef === target)!}
                  locale={locale}
                />
                <div>
                  <dt>{copy(locale, "reason")}</dt>
                  <dd>{copy(locale, reason)}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "version")}</dt>
                  <dd>{review.taskVersion}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "zone")}</dt>
                  <dd>{review.displayTimeZone}</dd>
                </div>
              </dl>
              <p>{copy(locale, "immediate")}</p>
              <div className="action-row">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={phase === "saving"}
                  onClick={() => {
                    setPhase("edit");
                    requestAnimationFrame(() => stateHeadingRef.current?.focus());
                  }}
                >
                  {copy(locale, "cancel")}
                </button>
                <button type="button" disabled={!online || phase === "saving"} onClick={confirm}>
                  {phase === "saving" ? copy(locale, "confirming") : copy(locale, "confirm")}
                </button>
              </div>
            </section>
          ) : phase === "conflict" ? (
            <StatePanel
              tone="danger"
              role="alert"
              heading={copy(locale, "conflictHeading")}
              headingRef={stateHeadingRef}
            >
              <p>{copy(locale, "conflictBody")}</p>
              <button type="button" onClick={() => void load(true)}>
                {copy(locale, "reloadCurrent")}
              </button>
            </StatePanel>
          ) : phase === "uncertain" ? (
            <StatePanel
              tone="warning"
              role="alert"
              heading={copy(locale, "uncertainHeading")}
              headingRef={stateHeadingRef}
            >
              <p>{copy(locale, "uncertainBody")}</p>
              <button type="button" onClick={() => void load(true)}>
                {copy(locale, "checkCurrent")}
              </button>
            </StatePanel>
          ) : phase === "success" && result ? (
            <StatePanel
              role="status"
              heading={copy(locale, "successHeading")}
              headingRef={stateHeadingRef}
            >
              <dl className="handoff-facts">
                <ActorFact
                  label={copy(locale, "currentActor")}
                  actor={result.currentActor}
                  locale={locale}
                />
                <div>
                  <dt>{copy(locale, "version")}</dt>
                  <dd>{result.taskVersion}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "outcome")}</dt>
                  <dd>{copy(locale, "accepted")}</dd>
                </div>
                <div>
                  <dt>{copy(locale, "occurredAt")}</dt>
                  <dd>
                    <time dateTime={result.occurredAt}>
                      {formatInstant(result.occurredAt, locale, zone.current)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>{copy(locale, "effectiveAt")}</dt>
                  <dd>
                    <time dateTime={result.effectiveAt}>
                      {formatInstant(result.effectiveAt, locale, zone.current)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>{copy(locale, "notification")}</dt>
                  <dd>{copy(locale, result.notificationDelivery)}</dd>
                </div>
              </dl>
              <a href={`/households/${encodeURIComponent(householdId)}/timeline`}>
                {copy(locale, "timeline")}
              </a>
            </StatePanel>
          ) : null}
        </article>
      ) : null}
    </main>
  );
}

function CoordinationFailure({
  failure,
  locale,
  retained,
  onRetry,
}: {
  failure: ApiFailure;
  locale: CoordinationLocale;
  retained: boolean;
  onRetry: () => void;
}) {
  const denied = [
    "COORDINATION_RESOURCE_NOT_FOUND",
    "CONSENT_RESOURCE_NOT_FOUND",
    "SESSION_REQUIRED",
  ].includes(failure.code);
  const staleCursor = failure.code === "TIMELINE_CURSOR_INVALID";
  return (
    <StatePanel
      tone={denied ? "danger" : "warning"}
      role={denied ? "alert" : "status"}
      heading={copy(
        locale,
        denied ? "deniedTitle" : staleCursor ? "staleCursorTitle" : "unavailableTitle",
      )}
    >
      <p>
        {copy(locale, denied ? "deniedBody" : staleCursor ? "staleCursorBody" : "unavailableBody")}
      </p>
      {!denied ? (
        <button type="button" onClick={onRetry}>
          {copy(locale, staleCursor || retained ? "reloadCurrent" : "retry")}
        </button>
      ) : null}
    </StatePanel>
  );
}

function StatePanel({
  heading,
  headingRef,
  tone,
  role,
  children,
}: {
  heading: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  tone?: "warning" | "danger";
  role?: "status" | "alert";
  children?: ReactNode;
}) {
  return (
    <section className={`coordination-state ${tone ?? ""}`} role={role}>
      <h2 tabIndex={headingRef ? -1 : undefined} ref={headingRef}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

function ActorFact({
  label,
  actor,
  locale,
}: {
  label: string;
  actor: { displayKey: string; subject: boolean };
  locale: CoordinationLocale;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{actorLabel(actor, locale)}</dd>
    </div>
  );
}

function actorLabel(
  actor: { displayKey: string; subject: boolean },
  locale: CoordinationLocale,
): string {
  return copy(locale, actor.displayKey === "coordination.actor.you" ? "you" : "householdMember");
}

function failureFrom(value: unknown): ApiFailure {
  return value instanceof CoordinationApiError ? value.failure : { code: "SERVICE_UNAVAILABLE" };
}

function browserZone(): string {
  const candidate = Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return "Asia/Bangkok";
  }
}

function localDateInZone(date: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(localDate: string, amount: number): string {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatInstant(value: string, locale: CoordinationLocale, zone: string): string {
  return `${new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "longOffset",
  }).format(new Date(value))} (${zone})`;
}
