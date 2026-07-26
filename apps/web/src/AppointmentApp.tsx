"use client";

import {
  AppointmentProjectionSchema,
  AppointmentSeriesProjectionSchema,
  CalendarProjectionSchema,
  IdentitySessionProjectionSchema,
  type AppointmentProjection,
  type AppointmentSeriesProjection,
  type CalendarFilter,
  type CalendarProjection,
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

type Locale = "vi-VN" | "en";
type Mode = "calendar" | "create" | "detail";

interface AppointmentAppProps {
  mode: Mode;
  householdId: string;
  appointmentId?: string;
}

interface Failure {
  code: string;
  currentAppointment?: AppointmentProjection;
  conflict?: { startsAtUtc: string; endsAtUtc: string };
  recoveryAction?: string;
}

class ApiError extends Error {
  public constructor(
    public readonly failure: Failure,
    public readonly uncertain: boolean,
  ) {
    super(failure.code);
  }
}

const copy = {
  "vi-VN": {
    skip: "Bỏ qua đến nội dung chính",
    language: "Ngôn ngữ",
    calendar: "Lịch cuộc hẹn",
    calendarIntro:
      "Lịch trực quan và chương trình nghị sự tương đương dùng cùng một kết quả đã được máy chủ xác nhận.",
    create: "Tạo cuộc hẹn",
    detail: "Chi tiết cuộc hẹn",
    previous: "Ngày trước",
    today: "Hôm nay",
    next: "Ngày sau",
    date: "Ngày địa phương đã chọn",
    zone: "Múi giờ hiển thị IANA",
    filter: "Bộ lọc trạng thái",
    all: "Tất cả",
    scheduled: "Đã lên lịch",
    cancelled: "Đã hủy",
    boundary: "Ranh giới ngày UTC",
    snapshot: "Được xác nhận lúc",
    loading: "Đang tải trạng thái đã xác nhận…",
    empty: "Không có cuộc hẹn đã xác nhận cho ngày và bộ lọc này.",
    agenda: "Chương trình nghị sự đầy đủ",
    visualCalendar: "Lưới lịch tăng cường",
    visualHelp:
      "Dùng các điều khiển ngày ở trên. Chương trình nghị sự phía dưới là đường dẫn bàn phím đầy đủ.",
    kind: "Loại cuộc hẹn có cấu trúc",
    logistics: "Phương thức hậu cần",
    utc: "Thời điểm UTC",
    local: "Ngày và giờ nguồn",
    offset: "Độ lệch UTC nguồn",
    sourceZone: "Múi giờ IANA nguồn",
    duration: "Thời lượng",
    recurrence: "Ranh giới lặp lại",
    occurrence: "Lần",
    finalDate: "Ngày địa phương cuối",
    scope: "Phạm vi thay đổi/hủy",
    occurrenceOnly: "Chỉ lần này",
    reminder: "Ý định nhắc",
    reminderNotice: "Chỉ ghi nhận ý định; không tuyên bố đã gửi thông báo.",
    version: "Phiên bản",
    lastChange: "Thay đổi gần nhất",
    open: "Mở chi tiết",
    unavailable: "Dịch vụ hiện không khả dụng",
    unavailableBody: "Không suy diễn kết quả trống. Dữ liệu đã xác nhận được giữ lại nếu có.",
    denied: "Không thể mở nội dung này",
    deniedBody: "Nội dung có thể không tồn tại hoặc tài khoản hiện tại không có quyền theo đồng ý.",
    offline: "Đang ngoại tuyến. Thay đổi bị chặn, không xếp hàng và không tự gửi lại.",
    stale: "Dữ liệu giữ lại có thể đã cũ. Lần xác nhận gần nhất:",
    retry: "Tải lại trạng thái hiện tại",
    appointmentKind: "Loại cuộc hẹn",
    logisticsMode: "Phương thức hậu cần",
    localStart: "Ngày và giờ địa phương nguồn",
    sourceTimeZone: "Múi giờ IANA nguồn",
    sourceUtcOffset: "Độ lệch UTC nguồn",
    ambiguity: "Giờ lặp lại dùng thời điểm",
    earlier: "Sớm hơn",
    later: "Muộn hơn",
    durationMinutes: "Thời lượng (phút)",
    recurrenceFrequency: "Tần suất",
    none: "Không lặp lại",
    weekly: "Hàng tuần",
    intervalWeeks: "Khoảng cách tuần",
    occurrenceCount: "Số lần (tối đa 12)",
    reminderLead: "Nhắc trước",
    noReminder: "Không yêu cầu",
    minutes: "phút",
    review: "Xem lại trước khi gửi",
    reviewHeading: "Kiểm tra ý định chưa gửi",
    reviewNotice:
      "Máy chủ sẽ xác thực IANA/DST, giải quyết UTC, kiểm tra xung đột và chỉ xác nhận sau khi ghi bền vững.",
    back: "Quay lại chỉnh sửa",
    confirmCreate: "Xác nhận tạo",
    confirmChange: "Xác nhận thay đổi",
    saving: "Đang chờ máy chủ xác nhận…",
    created: "Cuộc hẹn đã được xác nhận",
    changed: "Thay đổi đã được xác nhận",
    cancelReview: "Xem lại việc hủy",
    cancelHeading: "Kiểm tra trước khi hủy lần này",
    cancelReason: "Lý do có cấu trúc",
    confirmCancel: "Xác nhận hủy",
    no_longer_needed: "Không còn cần",
    schedule_changed: "Lịch đã thay đổi",
    duplicate: "Trùng lặp",
    other_coordination: "Điều phối khác",
    cancelledConfirmed: "Việc hủy đã được xác nhận",
    uncertain: "Chưa biết kết quả yêu cầu",
    uncertainBody:
      "Không thử lại mù quáng. Kiểm tra trạng thái hiện tại với cùng tài nguyên trước.",
    checkCurrent: "Kiểm tra trạng thái hiện tại",
    conflict: "Thời gian đã xung đột",
    conflictBody: "Không tiết lộ chi tiết cuộc hẹn khác. Chọn thời gian khác rồi xem lại từ đầu.",
    staleWrite: "Cuộc hẹn đã thay đổi",
    staleWriteBody:
      "Lựa chọn của bạn vẫn chưa được gửi lại. Tải phiên bản hiện tại rồi tạo lượt xem lại mới.",
    stateConflict: "Cuộc hẹn đã bị hủy và không thể thay đổi lại.",
    status: "Trạng thái",
    confirmedFacts: "Sự thật đã được máy chủ xác nhận",
    household_coordination: "Điều phối hộ gia đình",
    transport: "Di chuyển",
    community_support: "Hỗ trợ cộng đồng",
    other_personal: "Điều phối cá nhân khác",
    unspecified: "Chưa chỉ định",
    in_person: "Trực tiếp",
    phone: "Điện thoại",
    online: "Trực tuyến",
    createdChange: "Đã tạo",
    changedChange: "Đã thay đổi",
    cancelledChange: "Đã hủy",
  },
  en: {
    skip: "Skip to main content",
    language: "Language",
    calendar: "Appointment calendar",
    calendarIntro:
      "The visual calendar and equivalent agenda use the same server-confirmed result.",
    create: "Create appointment",
    detail: "Appointment detail",
    previous: "Previous day",
    today: "Today",
    next: "Next day",
    date: "Selected local date",
    zone: "IANA display time zone",
    filter: "Status filter",
    all: "All",
    scheduled: "Scheduled",
    cancelled: "Cancelled",
    boundary: "UTC day boundary",
    snapshot: "Confirmed at",
    loading: "Loading confirmed state…",
    empty: "No confirmed appointments match this day and filter.",
    agenda: "Complete agenda",
    visualCalendar: "Calendar grid enhancement",
    visualHelp: "Use the date controls above. The agenda below is the complete keyboard path.",
    kind: "Structured appointment kind",
    logistics: "Logistics mode",
    utc: "UTC interval",
    local: "Source local date and time",
    offset: "Source UTC offset",
    sourceZone: "Source IANA time zone",
    duration: "Duration",
    recurrence: "Recurrence boundary",
    occurrence: "Occurrence",
    finalDate: "Final local date",
    scope: "Change/cancel scope",
    occurrenceOnly: "This occurrence only",
    reminder: "Reminder intent",
    reminderNotice: "Intent receipt only; notification delivery is not claimed.",
    version: "Version",
    lastChange: "Last change",
    open: "Open detail",
    unavailable: "The service is unavailable",
    unavailableBody: "No empty result is inferred. Confirmed data is retained when available.",
    denied: "This content cannot be opened",
    deniedBody: "It may not exist, or the current account may not have governed permission.",
    offline: "You are offline. Changes are blocked, never queued, and never auto-submitted.",
    stale: "Retained data may be stale. Last confirmed:",
    retry: "Load current state",
    appointmentKind: "Appointment kind",
    logisticsMode: "Logistics mode",
    localStart: "Source local date and time",
    sourceTimeZone: "Source IANA time zone",
    sourceUtcOffset: "Source UTC offset",
    ambiguity: "Repeated local time uses",
    earlier: "Earlier instant",
    later: "Later instant",
    durationMinutes: "Duration (minutes)",
    recurrenceFrequency: "Frequency",
    none: "Does not repeat",
    weekly: "Weekly",
    intervalWeeks: "Week interval",
    occurrenceCount: "Occurrences (maximum 12)",
    reminderLead: "Reminder lead",
    noReminder: "Not requested",
    minutes: "minutes",
    review: "Review before sending",
    reviewHeading: "Check the unsent intent",
    reviewNotice:
      "The server validates IANA/DST, resolves UTC, checks conflicts, and confirms only after durable storage.",
    back: "Back to editing",
    confirmCreate: "Confirm create",
    confirmChange: "Confirm change",
    saving: "Waiting for server confirmation…",
    created: "Appointment confirmed",
    changed: "Change confirmed",
    cancelReview: "Review cancellation",
    cancelHeading: "Check before cancelling this occurrence",
    cancelReason: "Structured reason",
    confirmCancel: "Confirm cancellation",
    no_longer_needed: "No longer needed",
    schedule_changed: "Schedule changed",
    duplicate: "Duplicate",
    other_coordination: "Other coordination",
    cancelledConfirmed: "Cancellation confirmed",
    uncertain: "The request result is uncertain",
    uncertainBody: "Do not retry blindly. Check current state for the same resource first.",
    checkCurrent: "Check current state",
    conflict: "The time conflicts",
    conflictBody:
      "No other appointment details are disclosed. Choose another time and review again.",
    staleWrite: "The appointment changed",
    staleWriteBody:
      "Your choices remain unsent. Load the current version and start a fresh review.",
    stateConflict: "The appointment is cancelled and cannot be changed again.",
    status: "Status",
    confirmedFacts: "Server-confirmed facts",
    household_coordination: "Household coordination",
    transport: "Transport",
    community_support: "Community support",
    other_personal: "Other personal coordination",
    unspecified: "Unspecified",
    in_person: "In person",
    phone: "Phone",
    online: "Online",
    createdChange: "Created",
    changedChange: "Changed",
    cancelledChange: "Cancelled",
  },
} as const;

type CopyKey = keyof (typeof copy)["en"];
const t = (locale: Locale, key: CopyKey) => copy[locale][key];

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
    throw new ApiError({ code: "NETWORK_UNAVAILABLE" }, Boolean(init?.method));
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError({ code: "SERVICE_UNAVAILABLE" }, Boolean(init?.method));
  }
  if (!response.ok) {
    throw new ApiError(
      (body as { error?: Failure } | null)?.error ?? { code: "SERVICE_UNAVAILABLE" },
      Boolean(init?.method) && response.status >= 500,
    );
  }
  return schema.parse((body as { data?: unknown }).data);
}

export function AppointmentApp({ mode, householdId, appointmentId }: AppointmentAppProps) {
  const [locale, setLocale] = useState<Locale>("vi-VN");
  useEffect(() => {
    const stored = localStorage.getItem("lifebridge.locale");
    if (stored === "vi-VN" || stored === "en") setLocale(stored);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("lifebridge.locale", locale);
  }, [locale]);
  return (
    <div className="appointment-app">
      <a className="skip-link" href="#appointment-main">
        {t(locale, "skip")}
      </a>
      <header className="appointment-header">
        <a href={`/households/${encodeURIComponent(householdId)}/calendar`}>LifeBridge</a>
        <label>
          <span>{t(locale, "language")}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      {mode === "calendar" ? (
        <CalendarView householdId={householdId} locale={locale} />
      ) : (
        <MutationView
          mode={mode}
          householdId={householdId}
          locale={locale}
          {...(appointmentId ? { appointmentId } : {})}
        />
      )}
    </div>
  );
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

function CalendarView({ householdId, locale }: { householdId: string; locale: Locale }) {
  const online = useOnline();
  const zone = useRef(browserZone());
  const [localDate, setLocalDate] = useState(() => localDateInZone(new Date(), zone.current));
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [calendar, setCalendar] = useState<CalendarProjection | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!online) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailure(null);
    try {
      const query = new URLSearchParams({
        localDate,
        displayTimeZone: zone.current,
        status: filter,
      });
      setCalendar(
        await api(
          `/api/v1/households/${encodeURIComponent(householdId)}/calendar?${query}`,
          CalendarProjectionSchema,
        ),
      );
    } catch (error) {
      setFailure(failureFrom(error));
    } finally {
      setLoading(false);
    }
  }, [filter, householdId, localDate, online]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main id="appointment-main" className="appointment-main" tabIndex={-1}>
      <h1>{t(locale, "calendar")}</h1>
      <p>{t(locale, "calendarIntro")}</p>
      <p>
        <a
          className="primary-link"
          href={`/households/${encodeURIComponent(householdId)}/appointments/new`}
        >
          {t(locale, "create")}
        </a>
      </p>
      {!online ? (
        <State heading={t(locale, "offline")} tone="warning">
          {calendar ? (
            <p>
              {t(locale, "stale")} <time dateTime={calendar.snapshotAt}>{calendar.snapshotAt}</time>
            </p>
          ) : null}
        </State>
      ) : null}
      <form className="appointment-controls" onSubmit={(event) => event.preventDefault()}>
        <div className="date-actions">
          <button
            type="button"
            disabled={!online}
            onClick={() => setLocalDate(addDays(localDate, -1))}
          >
            {t(locale, "previous")}
          </button>
          <button
            type="button"
            disabled={!online}
            onClick={() => setLocalDate(localDateInZone(new Date(), zone.current))}
          >
            {t(locale, "today")}
          </button>
          <button
            type="button"
            disabled={!online}
            onClick={() => setLocalDate(addDays(localDate, 1))}
          >
            {t(locale, "next")}
          </button>
        </div>
        <label>
          <span>{t(locale, "date")}</span>
          <input
            type="date"
            value={localDate}
            disabled={!online}
            onChange={(event) => setLocalDate(event.target.value)}
          />
        </label>
        <label>
          <span>{t(locale, "zone")}</span>
          <input value={zone.current} readOnly />
        </label>
        <label>
          <span>{t(locale, "filter")}</span>
          <select
            value={filter}
            disabled={!online}
            onChange={(event) => setFilter(event.target.value as CalendarFilter)}
          >
            {(["all", "scheduled", "cancelled"] as const).map((value) => (
              <option key={value} value={value}>
                {t(locale, value)}
              </option>
            ))}
          </select>
        </label>
      </form>
      {loading && !calendar ? <State heading={t(locale, "loading")} role="status" /> : null}
      {failure ? (
        <FailurePanel failure={failure} locale={locale} onRetry={() => void load()} />
      ) : null}
      {calendar ? (
        <>
          <section className="calendar-boundary" aria-label={t(locale, "boundary")}>
            <dl>
              <Fact
                label={t(locale, "boundary")}
                value={`${calendar.dayStartUtc} — ${calendar.dayEndUtc}`}
              />
              <Fact label={t(locale, "zone")} value={calendar.displayTimeZone} />
              <Fact label={t(locale, "filter")} value={t(locale, calendar.filter)} />
              <Fact label={t(locale, "snapshot")} value={calendar.snapshotAt} />
            </dl>
          </section>
          <section className="calendar-enhancement" aria-labelledby="calendar-grid-heading">
            <h2 id="calendar-grid-heading">{t(locale, "visualCalendar")}</h2>
            <p>{t(locale, "visualHelp")}</p>
            <div role="grid" aria-readonly="true" aria-label={`${t(locale, "date")}: ${localDate}`}>
              <div role="row">
                <button
                  role="gridcell"
                  type="button"
                  aria-selected="true"
                  onClick={() => document.querySelector<HTMLElement>("#agenda-heading")?.focus()}
                >
                  {localDate}
                </button>
              </div>
            </div>
          </section>
          <section aria-labelledby="agenda-heading">
            <h2 id="agenda-heading" tabIndex={-1}>
              {t(locale, "agenda")}
            </h2>
            {calendar.items.length === 0 ? (
              <State heading={t(locale, "empty")} />
            ) : (
              <ol className="appointment-agenda">
                {calendar.items.map((appointment) => (
                  <li key={appointment.appointmentId}>
                    <AppointmentFacts appointment={appointment} locale={locale} />
                    <p>
                      <a
                        href={`/appointments/${encodeURIComponent(appointment.appointmentId)}?householdId=${encodeURIComponent(householdId)}`}
                      >
                        {t(locale, "open")}
                      </a>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

type Phase =
  | "edit"
  | "review"
  | "saving"
  | "success"
  | "cancel_review"
  | "conflict"
  | "uncertain"
  | "recovery";

function MutationView({
  mode,
  householdId,
  appointmentId,
  locale,
}: {
  mode: "create" | "detail";
  householdId: string;
  appointmentId?: string;
  locale: Locale;
}) {
  const online = useOnline();
  const [csrf, setCsrf] = useState("");
  const [current, setCurrent] = useState<AppointmentProjection | null>(null);
  const [createdSeries, setCreatedSeries] = useState<AppointmentSeriesProjection | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [phase, setPhase] = useState<Phase>("edit");
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(() => `p3s2_${crypto.randomUUID()}`);
  const [cancelReason, setCancelReason] = useState<
    "no_longer_needed" | "schedule_changed" | "duplicate" | "other_coordination"
  >("no_longer_needed");
  const stateHeading = useRef<HTMLHeadingElement>(null);
  const [form, setForm] = useState(() => defaultForm());

  const load = useCallback(
    async (recovery = false) => {
      if (!online) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setFailure(null);
      try {
        const session = await api("/api/v1/account/session", IdentitySessionProjectionSchema);
        setCsrf(session.csrfToken);
        if (mode === "detail" && appointmentId) {
          const appointment = await api(
            `/api/v1/households/${encodeURIComponent(householdId)}/appointments/${encodeURIComponent(appointmentId)}`,
            AppointmentProjectionSchema,
          );
          setCurrent(appointment);
          setForm(formFromAppointment(appointment));
        }
        setKey(`p3s2_${crypto.randomUUID()}`);
        setPhase(recovery ? "recovery" : "edit");
        requestAnimationFrame(() => stateHeading.current?.focus());
      } catch (error) {
        setFailure(failureFrom(error));
      } finally {
        setLoading(false);
      }
    },
    [appointmentId, householdId, mode, online],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (
      ["review", "success", "cancel_review", "conflict", "uncertain", "recovery"].includes(phase)
    ) {
      requestAnimationFrame(() => stateHeading.current?.focus());
    }
  }, [phase]);

  function review(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    setKey(`p3s2_${crypto.randomUUID()}`);
    setPhase("review");
  }

  async function confirmChange() {
    if (!online) return;
    setPhase("saving");
    try {
      const headers = { "x-csrf-token": csrf, "idempotency-key": key };
      if (mode === "create") {
        const result = await api(
          `/api/v1/households/${encodeURIComponent(householdId)}/appointments`,
          AppointmentSeriesProjectionSchema,
          { method: "POST", headers, body: JSON.stringify(createBody(form)) },
        );
        setCreatedSeries(result);
        setCurrent(result.appointments[0] ?? null);
      } else if (appointmentId && current) {
        setCurrent(
          await api(
            `/api/v1/households/${encodeURIComponent(householdId)}/appointments/${encodeURIComponent(appointmentId)}`,
            AppointmentProjectionSchema,
            {
              method: "PATCH",
              headers,
              body: JSON.stringify(changeBody(form, current.version)),
            },
          ),
        );
      }
      setPhase("success");
    } catch (error) {
      handleMutationError(error, setFailure, setCurrent, setPhase);
    }
  }

  async function confirmCancel() {
    if (!online || !appointmentId || !current) return;
    setPhase("saving");
    try {
      setCurrent(
        await api(
          `/api/v1/households/${encodeURIComponent(householdId)}/appointments/${encodeURIComponent(appointmentId)}/cancel`,
          AppointmentProjectionSchema,
          {
            method: "POST",
            headers: { "x-csrf-token": csrf, "idempotency-key": key },
            body: JSON.stringify({
              operation: "cancel_appointment",
              scope: "occurrence_only",
              expectedVersion: current.version,
              reasonCode: cancelReason,
            }),
          },
        ),
      );
      setPhase("success");
    } catch (error) {
      handleMutationError(error, setFailure, setCurrent, setPhase);
    }
  }

  return (
    <main id="appointment-main" className="appointment-main" tabIndex={-1}>
      <h1>{t(locale, mode === "create" ? "create" : "detail")}</h1>
      {!online ? <State heading={t(locale, "offline")} tone="warning" /> : null}
      {loading ? <State heading={t(locale, "loading")} role="status" /> : null}
      {failure && (phase === "edit" || phase === "recovery") ? (
        <FailurePanel failure={failure} locale={locale} onRetry={() => void load(true)} />
      ) : null}
      {phase === "uncertain" ? (
        <State heading={t(locale, "uncertain")} tone="warning" headingRef={stateHeading}>
          <p>{t(locale, "uncertainBody")}</p>
          <button type="button" onClick={() => void load(true)}>
            {t(locale, "checkCurrent")}
          </button>
        </State>
      ) : null}
      {phase === "conflict" ? (
        <State
          heading={
            failure?.code === "APPOINTMENT_TIME_CONFLICT"
              ? t(locale, "conflict")
              : t(locale, "staleWrite")
          }
          tone="danger"
          headingRef={stateHeading}
        >
          <p>
            {failure?.code === "APPOINTMENT_TIME_CONFLICT"
              ? t(locale, "conflictBody")
              : t(locale, "staleWriteBody")}
          </p>
          {failure?.conflict ? (
            <p>
              <time dateTime={failure.conflict.startsAtUtc}>{failure.conflict.startsAtUtc}</time> —{" "}
              <time dateTime={failure.conflict.endsAtUtc}>{failure.conflict.endsAtUtc}</time>
            </p>
          ) : null}
          <button type="button" onClick={() => void load(true)}>
            {t(locale, "retry")}
          </button>
        </State>
      ) : null}
      {phase === "recovery" ? (
        <State heading={t(locale, "confirmedFacts")} headingRef={stateHeading} role="status" />
      ) : null}
      {(phase === "edit" || phase === "recovery") && current ? (
        <AppointmentFacts appointment={current} locale={locale} />
      ) : null}
      {(phase === "edit" || phase === "recovery") && current?.status === "cancelled" ? (
        <State heading={t(locale, "stateConflict")} tone="warning" />
      ) : null}
      {(phase === "edit" || phase === "recovery") &&
      (!current || current.status === "scheduled") ? (
        <AppointmentForm
          form={form}
          setForm={setForm}
          locale={locale}
          mode={mode}
          online={online}
          onSubmit={review}
        />
      ) : null}
      {phase === "review" ? (
        <section className="appointment-card" aria-labelledby="review-heading">
          <h2 id="review-heading" ref={stateHeading} tabIndex={-1}>
            {t(locale, "reviewHeading")}
          </h2>
          <p>{t(locale, "reviewNotice")}</p>
          <ReviewFacts form={form} locale={locale} />
          <div className="action-row">
            <button type="button" onClick={() => setPhase("edit")}>
              {t(locale, "back")}
            </button>
            <button type="button" disabled={!online} onClick={() => void confirmChange()}>
              {t(locale, mode === "create" ? "confirmCreate" : "confirmChange")}
            </button>
          </div>
        </section>
      ) : null}
      {mode === "detail" &&
      current?.status === "scheduled" &&
      (phase === "edit" || phase === "recovery") ? (
        <button
          type="button"
          className="danger-button"
          disabled={!online}
          onClick={() => {
            setKey(`p3s2_${crypto.randomUUID()}`);
            setPhase("cancel_review");
          }}
        >
          {t(locale, "cancelReview")}
        </button>
      ) : null}
      {phase === "cancel_review" && current ? (
        <section className="appointment-card danger" aria-labelledby="cancel-heading">
          <h2 id="cancel-heading" ref={stateHeading} tabIndex={-1}>
            {t(locale, "cancelHeading")}
          </h2>
          <AppointmentFacts appointment={current} locale={locale} />
          <p>{t(locale, "occurrenceOnly")}</p>
          <label>
            <span>{t(locale, "cancelReason")}</span>
            <select
              value={cancelReason}
              onChange={(event) =>
                setCancelReason(
                  event.target.value as
                    "no_longer_needed" | "schedule_changed" | "duplicate" | "other_coordination",
                )
              }
            >
              {(
                ["no_longer_needed", "schedule_changed", "duplicate", "other_coordination"] as const
              ).map((value) => (
                <option key={value} value={value}>
                  {t(locale, value)}
                </option>
              ))}
            </select>
          </label>
          <div className="action-row">
            <button type="button" onClick={() => setPhase("edit")}>
              {t(locale, "back")}
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={!online}
              onClick={() => void confirmCancel()}
            >
              {t(locale, "confirmCancel")}
            </button>
          </div>
        </section>
      ) : null}
      {phase === "saving" ? <State heading={t(locale, "saving")} role="status" /> : null}
      {phase === "success" && current ? (
        <State
          heading={t(
            locale,
            current.status === "cancelled"
              ? "cancelledConfirmed"
              : mode === "create"
                ? "created"
                : "changed",
          )}
          headingRef={stateHeading}
          role="status"
        >
          <AppointmentFacts appointment={current} locale={locale} />
          {createdSeries && createdSeries.appointments.length > 1 ? (
            <p>
              {createdSeries.appointments.length} {t(locale, "occurrence")}
            </p>
          ) : null}
          <p>{t(locale, "reminderNotice")}</p>
          <a href={`/households/${encodeURIComponent(householdId)}/calendar`}>
            {t(locale, "calendar")}
          </a>
        </State>
      ) : null}
    </main>
  );
}

interface FormState {
  appointmentKind: AppointmentProjection["kind"];
  logisticsMode: AppointmentProjection["logistics"];
  localStart: string;
  sourceTimeZone: string;
  sourceUtcOffset: string;
  ambiguousTimePolicy: "earlier" | "later";
  durationMinutes: number;
  frequency: "none" | "weekly";
  intervalWeeks: number;
  occurrenceCount: number;
  reminderLead: "" | "15" | "60" | "1440";
}

function AppointmentForm({
  form,
  setForm,
  locale,
  mode,
  online,
  onSubmit,
}: {
  form: FormState;
  setForm: (value: FormState) => void;
  locale: Locale;
  mode: "create" | "detail";
  online: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value });
  return (
    <form className="appointment-card appointment-form" onSubmit={onSubmit}>
      <label>
        <span>{t(locale, "appointmentKind")}</span>
        <select
          value={form.appointmentKind}
          onChange={(event) =>
            update("appointmentKind", event.target.value as FormState["appointmentKind"])
          }
        >
          {(
            ["household_coordination", "transport", "community_support", "other_personal"] as const
          ).map((value) => (
            <option key={value} value={value}>
              {t(locale, value)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t(locale, "logisticsMode")}</span>
        <select
          value={form.logisticsMode}
          onChange={(event) =>
            update("logisticsMode", event.target.value as FormState["logisticsMode"])
          }
        >
          {(["unspecified", "in_person", "phone", "online"] as const).map((value) => (
            <option key={value} value={value}>
              {t(locale, value)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t(locale, "localStart")}</span>
        <input
          required
          type="datetime-local"
          value={form.localStart}
          onChange={(event) => update("localStart", event.target.value)}
        />
      </label>
      <label>
        <span>{t(locale, "sourceTimeZone")}</span>
        <input
          required
          value={form.sourceTimeZone}
          onChange={(event) => update("sourceTimeZone", event.target.value)}
        />
      </label>
      <label>
        <span>{t(locale, "sourceUtcOffset")}</span>
        <input
          required
          pattern="[+-](0[0-9]|1[0-4]):[0-5][0-9]"
          value={form.sourceUtcOffset}
          onChange={(event) => update("sourceUtcOffset", event.target.value)}
        />
      </label>
      <fieldset>
        <legend>{t(locale, "ambiguity")}</legend>
        {(["earlier", "later"] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="ambiguity"
              value={value}
              checked={form.ambiguousTimePolicy === value}
              onChange={() => update("ambiguousTimePolicy", value)}
            />{" "}
            {t(locale, value)}
          </label>
        ))}
      </fieldset>
      <label>
        <span>{t(locale, "durationMinutes")}</span>
        <input
          required
          type="number"
          min={15}
          max={480}
          step={15}
          value={form.durationMinutes}
          onChange={(event) => update("durationMinutes", Number(event.target.value))}
        />
      </label>
      {mode === "create" ? (
        <>
          <label>
            <span>{t(locale, "recurrenceFrequency")}</span>
            <select
              value={form.frequency}
              onChange={(event) => update("frequency", event.target.value as "none" | "weekly")}
            >
              <option value="none">{t(locale, "none")}</option>
              <option value="weekly">{t(locale, "weekly")}</option>
            </select>
          </label>
          {form.frequency === "weekly" ? (
            <>
              <label>
                <span>{t(locale, "intervalWeeks")}</span>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={form.intervalWeeks}
                  onChange={(event) => update("intervalWeeks", Number(event.target.value))}
                />
              </label>
              <label>
                <span>{t(locale, "occurrenceCount")}</span>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={form.occurrenceCount}
                  onChange={(event) => update("occurrenceCount", Number(event.target.value))}
                />
              </label>
            </>
          ) : null}
        </>
      ) : null}
      <label>
        <span>{t(locale, "reminderLead")}</span>
        <select
          value={form.reminderLead}
          onChange={(event) =>
            update("reminderLead", event.target.value as FormState["reminderLead"])
          }
        >
          <option value="">{t(locale, "noReminder")}</option>
          <option value="15">15 {t(locale, "minutes")}</option>
          <option value="60">60 {t(locale, "minutes")}</option>
          <option value="1440">1440 {t(locale, "minutes")}</option>
        </select>
      </label>
      <p>{t(locale, "reminderNotice")}</p>
      <button type="submit" disabled={!online}>
        {t(locale, "review")}
      </button>
    </form>
  );
}

function ReviewFacts({ form, locale }: { form: FormState; locale: Locale }) {
  return (
    <dl className="appointment-facts">
      <Fact label={t(locale, "kind")} value={t(locale, form.appointmentKind)} />
      <Fact label={t(locale, "logistics")} value={t(locale, form.logisticsMode)} />
      <Fact label={t(locale, "local")} value={form.localStart} />
      <Fact label={t(locale, "offset")} value={form.sourceUtcOffset} />
      <Fact label={t(locale, "sourceZone")} value={form.sourceTimeZone} />
      <Fact
        label={t(locale, "duration")}
        value={`${form.durationMinutes} ${t(locale, "minutes")}`}
      />
      <Fact
        label={t(locale, "recurrence")}
        value={
          form.frequency === "weekly"
            ? `${t(locale, "weekly")}; ${form.intervalWeeks}; ${form.occurrenceCount}`
            : t(locale, "none")
        }
      />
      <Fact label={t(locale, "scope")} value={t(locale, "occurrenceOnly")} />
      <Fact label={t(locale, "reminder")} value={form.reminderLead || t(locale, "noReminder")} />
    </dl>
  );
}

function AppointmentFacts({
  appointment,
  locale,
}: {
  appointment: AppointmentProjection;
  locale: Locale;
}) {
  return (
    <article className="appointment-card">
      <h3>{t(locale, "confirmedFacts")}</h3>
      <dl className="appointment-facts">
        <Fact label={t(locale, "status")} value={t(locale, appointment.status)} />
        <Fact label={t(locale, "kind")} value={t(locale, appointment.kind)} />
        <Fact label={t(locale, "logistics")} value={t(locale, appointment.logistics)} />
        <Fact
          label={t(locale, "utc")}
          value={`${appointment.startsAtUtc} — ${appointment.endsAtUtc}`}
        />
        <Fact label={t(locale, "local")} value={appointment.sourceLocalStart} />
        <Fact label={t(locale, "offset")} value={appointment.sourceUtcOffset} />
        <Fact label={t(locale, "sourceZone")} value={appointment.sourceTimeZone} />
        <Fact
          label={t(locale, "duration")}
          value={`${appointment.durationMinutes} ${t(locale, "minutes")}`}
        />
        <Fact
          label={t(locale, "occurrence")}
          value={`${appointment.occurrenceNumber}/${appointment.occurrenceCount}`}
        />
        <Fact label={t(locale, "finalDate")} value={appointment.recurrenceFinalLocalDate} />
        <Fact label={t(locale, "scope")} value={t(locale, "occurrenceOnly")} />
        <Fact label={t(locale, "reminder")} value={appointment.reminderIntent} />
        <Fact label={t(locale, "version")} value={String(appointment.version)} />
        <Fact
          label={t(locale, "lastChange")}
          value={t(
            locale,
            `${appointment.lastChange}Change` as
              "createdChange" | "changedChange" | "cancelledChange",
          )}
        />
        <Fact label={t(locale, "snapshot")} value={appointment.confirmedAt} />
      </dl>
      <p>{t(locale, "reminderNotice")}</p>
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function State({
  heading,
  children,
  tone = "",
  role,
  headingRef,
}: {
  heading: string;
  children?: ReactNode;
  tone?: "warning" | "danger" | "";
  role?: "status" | "alert";
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section className={`appointment-state ${tone}`} role={role}>
      <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

function FailurePanel({
  failure,
  locale,
  onRetry,
}: {
  failure: Failure;
  locale: Locale;
  onRetry: () => void;
}) {
  const denied = ["COORDINATION_RESOURCE_NOT_FOUND", "SESSION_REQUIRED"].includes(failure.code);
  return (
    <State heading={t(locale, denied ? "denied" : "unavailable")} tone="danger" role="alert">
      <p>{t(locale, denied ? "deniedBody" : "unavailableBody")}</p>
      <button type="button" onClick={onRetry}>
        {t(locale, "retry")}
      </button>
    </State>
  );
}

function handleMutationError(
  error: unknown,
  setFailure: (failure: Failure) => void,
  setCurrent: (appointment: AppointmentProjection) => void,
  setPhase: (phase: Phase) => void,
) {
  if (error instanceof ApiError) {
    setFailure(error.failure);
    if (error.failure.currentAppointment) setCurrent(error.failure.currentAppointment);
    if (error.uncertain) setPhase("uncertain");
    else if (
      [
        "APPOINTMENT_VERSION_CONFLICT",
        "APPOINTMENT_STATE_CONFLICT",
        "APPOINTMENT_TIME_CONFLICT",
      ].includes(error.failure.code)
    )
      setPhase("conflict");
    else setPhase("edit");
  } else {
    setFailure({ code: "SERVICE_UNAVAILABLE" });
    setPhase("uncertain");
  }
}

function failureFrom(error: unknown): Failure {
  return error instanceof ApiError ? error.failure : { code: "SERVICE_UNAVAILABLE" };
}

function defaultForm(): FormState {
  const zone = browserZone();
  const local = new Date(Date.now() + 60 * 60_000);
  local.setMinutes(0, 0, 0);
  return {
    appointmentKind: "household_coordination",
    logisticsMode: "unspecified",
    localStart:
      localDateInZone(local, zone) +
      "T" +
      local.toLocaleTimeString("en-CA", {
        timeZone: zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    sourceTimeZone: zone,
    sourceUtcOffset: offsetInZone(local, zone),
    ambiguousTimePolicy: "earlier",
    durationMinutes: 60,
    frequency: "none",
    intervalWeeks: 1,
    occurrenceCount: 2,
    reminderLead: "",
  };
}

function formFromAppointment(value: AppointmentProjection): FormState {
  return {
    appointmentKind: value.kind,
    logisticsMode: value.logistics,
    localStart: value.sourceLocalStart,
    sourceTimeZone: value.sourceTimeZone,
    sourceUtcOffset: value.sourceUtcOffset,
    ambiguousTimePolicy: "earlier",
    durationMinutes: value.durationMinutes,
    frequency: "none",
    intervalWeeks: 1,
    occurrenceCount: 2,
    reminderLead:
      value.reminderLeadMinutes === null
        ? ""
        : (String(value.reminderLeadMinutes) as FormState["reminderLead"]),
  };
}

function scheduleBody(form: FormState, recurring: boolean) {
  return {
    localStart: form.localStart,
    sourceTimeZone: form.sourceTimeZone,
    sourceUtcOffset: form.sourceUtcOffset,
    ambiguousTimePolicy: form.ambiguousTimePolicy,
    durationMinutes: form.durationMinutes,
    recurrence:
      recurring && form.frequency === "weekly"
        ? {
            frequency: "weekly",
            intervalWeeks: form.intervalWeeks,
            occurrenceCount: form.occurrenceCount,
          }
        : { frequency: "none" },
  };
}

function createBody(form: FormState) {
  return {
    operation: "create_appointment",
    appointmentKind: form.appointmentKind,
    logisticsMode: form.logisticsMode,
    schedule: scheduleBody(form, true),
    reminder: { leadMinutes: form.reminderLead ? Number(form.reminderLead) : null },
  };
}

function changeBody(form: FormState, version: number) {
  return {
    operation: "change_appointment",
    scope: "occurrence_only",
    expectedVersion: version,
    appointmentKind: form.appointmentKind,
    logisticsMode: form.logisticsMode,
    schedule: scheduleBody(form, false),
    reminder: { leadMinutes: form.reminderLead ? Number(form.reminderLead) : null },
  };
}

function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Bangkok";
}

function localDateInZone(date: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

function offsetInZone(date: Date, zone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const localAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  const minutes = Math.round((localAsUtc - date.getTime()) / 60_000);
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
