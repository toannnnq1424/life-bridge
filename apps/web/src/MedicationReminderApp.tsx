"use client";

import {
  AcknowledgeMedicationReminderRequestSchema,
  ChangeMedicationReminderRequestSchema,
  CreateMedicationReminderRequestSchema,
  IdentitySessionProjectionSchema,
  MedicationReminderAcknowledgementResultSchema,
  MedicationReminderListProjectionSchema,
  MedicationReminderNotificationListSchema,
  MedicationReminderProjectionSchema,
  type MedicationReminderNotificationProjection,
  type MedicationReminderProjection,
  type MedicationReminderUnit,
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
type Mode = "schedule" | "detail" | "notifications";
type Phase = "loading" | "edit" | "review" | "saving" | "success" | "uncertain";

interface Props {
  mode: Mode;
  householdId: string;
  reminderId?: string;
}

interface Failure {
  code: string;
  fieldErrors?: Record<string, string>;
}

interface FormState {
  medicationLabel: string;
  amount: string;
  unit: MedicationReminderUnit;
  otherUnitLabel: string;
  localStart: string;
  sourceTimeZone: string;
  sourceUtcOffset: string;
  ambiguousTimePolicy: "" | "earlier" | "later";
  frequency: "none" | "daily" | "weekly";
  interval: string;
  occurrenceCount: string;
}

class ApiFailure extends Error {
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
    schedules: "Lịch nhắc dùng thuốc",
    scheduleIntro:
      "Chỉ lưu các dữ kiện lịch do bạn nhập. LifeBridge không khuyến nghị liều, điều trị, mức độ khẩn cấp hay đánh giá tuân thủ.",
    notifications: "Thông báo nhắc dùng thuốc",
    notificationsIntro:
      "Trạng thái ý định, chuyển thông báo và xác nhận đã xem được hiển thị riêng biệt.",
    synthetic: "Minh họa cục bộ — chỉ dữ liệu tổng hợp",
    authority:
      "Vai trò người tổ chức hoặc thành viên không thay thế sự đồng ý của người nhận chăm sóc. Quyền được kiểm tra lại cho từng lần xem, thay đổi và xác nhận.",
    empty: "Chưa có lịch nhắc nào được máy chủ xác nhận.",
    emptyNotifications: "Chưa có thông báo nhắc nào được máy chủ xác nhận.",
    create: "Tạo lịch nhắc",
    edit: "Chỉnh sửa lịch nhắc",
    confirmed: "Lịch đã được máy chủ xác nhận",
    changed: "Thay đổi đã được máy chủ xác nhận",
    disabled: "Lịch đã được vô hiệu hóa",
    medicationLabel: "Tên thuốc do bạn nhập",
    amount: "Số lượng do bạn nhập",
    unit: "Đơn vị rõ ràng",
    otherUnit: "Tên đơn vị khác",
    localStart: "Ngày và giờ địa phương",
    timeZone: "Múi giờ IANA",
    utcOffset: "Độ lệch UTC tại thời điểm đó",
    ambiguity: "Cách xử lý giờ địa phương",
    ordinary: "Giờ thông thường (không trùng)",
    earlier: "Thời điểm sớm hơn khi giờ trùng",
    later: "Thời điểm muộn hơn khi giờ trùng",
    frequency: "Lặp lại",
    none: "Không lặp lại",
    daily: "Hàng ngày",
    weekly: "Hàng tuần",
    interval: "Khoảng cách",
    occurrenceCount: "Số lần hữu hạn",
    review: "Xem lại lịch chưa gửi",
    reviewNotice:
      "Kiểm tra chính xác tên, số lượng, đơn vị, giờ địa phương, múi giờ IANA, độ lệch và quy tắc lặp. Đây không phải khuyến nghị dùng thuốc.",
    back: "Quay lại chỉnh sửa",
    confirmCreate: "Xác nhận tạo lịch",
    confirmChange: "Xác nhận thay đổi",
    disable: "Vô hiệu hóa lịch",
    version: "Phiên bản",
    intent: "Ý định thông báo",
    delivery: "Chuyển thông báo",
    acknowledgement: "Xác nhận",
    seenOnly:
      "Xác nhận này chỉ ghi nhận rằng nhắc nhở đã được xem. Việc này không xác nhận thuốc đã được dùng và không đánh giá mức độ tuân thủ.",
    acknowledge: "Xác nhận đã xem",
    duplicate: "Nhắc nhở này đã được xác nhận trước đó. Không tạo xác nhận thứ hai.",
    pending: "Đã ghi nhận ý định; chưa có bằng chứng chuyển thông báo.",
    delivered: "Thông báo trong ứng dụng đã được lưu bền vững.",
    failed: "Chuyển nhắc nhở không thành công. Lịch vẫn được xác nhận; chưa ghi nhận đã xem.",
    missed:
      "Đã qua thời điểm đã đặt nhưng việc chuyển chưa được xác nhận. Chưa ghi nhận xác nhận đã xem.",
    uncertainDelivery: "Kết quả chuyển chưa chắc chắn; không tuyên bố thành công.",
    cancelled: "Ý định chuyển đã bị hủy.",
    unacknowledged: "Chưa xác nhận đã xem",
    seen: "Đã xác nhận xem",
    offline:
      "Bạn đang ngoại tuyến. Thay đổi lịch và xác nhận bị chặn, không xếp hàng và không tự gửi lại.",
    loading: "Đang tải trạng thái đã xác nhận…",
    denied: "Nội dung không tồn tại hoặc tài khoản hiện tại không có quyền theo đồng ý.",
    unavailable: "Dịch vụ không khả dụng; không suy diễn thành kết quả trống hay thành công.",
    invalid: "Một hoặc nhiều dữ kiện lịch không hợp lệ. Hãy kiểm tra các trường được đánh dấu.",
    conflict:
      "Trạng thái đã thay đổi. Dữ liệu của bạn chưa được tự gửi lại; hãy tải phiên bản hiện tại và xem lại.",
    uncertain:
      "Chưa biết kết quả yêu cầu. Không thử lại mù quáng; hãy đọc trạng thái hiện tại trước.",
    check: "Kiểm tra trạng thái hiện tại",
    open: "Mở lịch đã xác nhận",
    retry: "Tải lại",
    tablet: "viên nén",
    capsule: "viên nang",
    millilitre: "mililít",
    drop: "giọt",
    puff: "nhát",
    patch: "miếng dán",
    application: "lần bôi",
    unitValue: "đơn vị",
    other: "khác",
  },
  en: {
    skip: "Skip to main content",
    language: "Language",
    schedules: "Medication reminder schedules",
    scheduleIntro:
      "Only facts you enter are stored. LifeBridge does not recommend dosage, treatment, urgency, or assess adherence.",
    notifications: "Medication reminder notifications",
    notificationsIntro: "Intent, delivery, and seen acknowledgement are shown as separate states.",
    synthetic: "Local demonstration — synthetic data only",
    authority:
      "Organizer or member status never replaces care-recipient consent. Permission is checked again for every view, change, and acknowledgement.",
    empty: "No server-confirmed reminder schedules.",
    emptyNotifications: "No server-confirmed reminder notifications.",
    create: "Create reminder schedule",
    edit: "Edit reminder schedule",
    confirmed: "Schedule confirmed by the server",
    changed: "Change confirmed by the server",
    disabled: "Schedule disabled",
    medicationLabel: "Medication name you enter",
    amount: "Quantity you enter",
    unit: "Explicit unit",
    otherUnit: "Other unit name",
    localStart: "Local date and time",
    timeZone: "IANA time zone",
    utcOffset: "UTC offset at that time",
    ambiguity: "Local-time interpretation",
    ordinary: "Ordinary time (not repeated)",
    earlier: "Earlier instant during a repeated time",
    later: "Later instant during a repeated time",
    frequency: "Recurrence",
    none: "Does not repeat",
    daily: "Daily",
    weekly: "Weekly",
    interval: "Interval",
    occurrenceCount: "Finite occurrence count",
    review: "Review unsent schedule",
    reviewNotice:
      "Check the exact name, quantity, unit, local time, IANA zone, offset, and recurrence. This is not medication advice.",
    back: "Back to edit",
    confirmCreate: "Confirm schedule",
    confirmChange: "Confirm change",
    disable: "Disable schedule",
    version: "Version",
    intent: "Notification intent",
    delivery: "Delivery",
    acknowledgement: "Acknowledgement",
    seenOnly:
      "This acknowledges only that the reminder was seen. It does not confirm medication was taken or assess adherence.",
    acknowledge: "Acknowledge as seen",
    duplicate: "This reminder was already acknowledged. No second acknowledgement was created.",
    pending: "Intent recorded; there is no delivery evidence yet.",
    delivered: "The in-app notification was durably persisted.",
    failed: "Reminder delivery failed. The schedule remains confirmed; seen was not recorded.",
    missed:
      "The scheduled time passed without confirmed delivery. Seen acknowledgement was not recorded.",
    uncertainDelivery: "Delivery outcome is uncertain; success is not claimed.",
    cancelled: "The delivery intent was cancelled.",
    unacknowledged: "Not acknowledged as seen",
    seen: "Acknowledged as seen",
    offline:
      "You are offline. Schedule changes and acknowledgements are blocked, never queued, and never auto-submitted.",
    loading: "Loading server-confirmed state…",
    denied: "The resource does not exist or the current account lacks consent-based authority.",
    unavailable: "The service is unavailable; no empty result or success is inferred.",
    invalid: "One or more schedule facts are invalid. Check the marked fields.",
    conflict:
      "State changed. Your input was not resubmitted; load the current version and review again.",
    uncertain:
      "The request outcome is unknown. Do not retry blindly; read the current state first.",
    check: "Check current state",
    open: "Open confirmed schedule",
    retry: "Reload",
    tablet: "tablet",
    capsule: "capsule",
    millilitre: "millilitre",
    drop: "drop",
    puff: "puff",
    patch: "patch",
    application: "application",
    unitValue: "unit",
    other: "other",
  },
} as const;

type CopyKey = keyof (typeof copy)["en"];
const t = (locale: Locale, key: CopyKey) => copy[locale][key];

export function MedicationReminderApp({ mode, householdId, reminderId }: Props) {
  const [locale, setLocale] = useState<Locale>("vi-VN");
  useEffect(() => {
    const saved = localStorage.getItem("lifebridge.locale");
    if (saved === "vi-VN" || saved === "en") setLocale(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("lifebridge.locale", locale);
  }, [locale]);
  return (
    <div className="medication-app">
      <a className="skip-link" href="#medication-main">
        {t(locale, "skip")}
      </a>
      <header className="medication-header">
        <div>
          <a
            className="brand"
            href={`/households/${encodeURIComponent(householdId)}/medication-reminders`}
          >
            LifeBridge
          </a>
          <p>{t(locale, "synthetic")}</p>
        </div>
        <label>
          <span>{t(locale, "language")}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      {mode === "notifications" ? (
        <NotificationCenter householdId={householdId} locale={locale} />
      ) : (
        <ScheduleCenter
          householdId={householdId}
          locale={locale}
          {...(reminderId ? { reminderId } : {})}
        />
      )}
    </div>
  );
}

function ScheduleCenter({
  householdId,
  reminderId,
  locale,
}: {
  householdId: string;
  reminderId?: string;
  locale: Locale;
}) {
  const online = useOnline();
  const [phase, setPhase] = useState<Phase>("loading");
  const [csrf, setCsrf] = useState("");
  const [items, setItems] = useState<MedicationReminderProjection[]>([]);
  const [current, setCurrent] = useState<MedicationReminderProjection | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const stateHeading = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    if (!online) {
      setPhase("edit");
      return;
    }
    setFailure(null);
    setPhase("loading");
    try {
      const session = await api("/api/v1/account/session", IdentitySessionProjectionSchema);
      setCsrf(session.csrfToken);
      if (reminderId) {
        const reminder = await api(
          `/api/v1/households/${encodeURIComponent(householdId)}/medication-reminders/${encodeURIComponent(reminderId)}`,
          MedicationReminderProjectionSchema,
        );
        setCurrent(reminder);
        setForm(formFromReminder(reminder));
      } else {
        const list = await api(
          `/api/v1/households/${encodeURIComponent(householdId)}/medication-reminders`,
          MedicationReminderListProjectionSchema,
        );
        setItems(list.items);
      }
      setIdempotencyKey(newKey());
      setPhase("edit");
    } catch (error) {
      setFailure(failureFrom(error));
      setPhase("edit");
    }
  }, [householdId, online, reminderId]);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (failure || phase === "review" || phase === "success" || phase === "uncertain") {
      requestAnimationFrame(() => stateHeading.current?.focus());
    }
  }, [failure, phase]);

  function review(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    try {
      requestFor(form, current?.version);
      setIdempotencyKey(newKey());
      setPhase("review");
    } catch {
      setFailure({ code: "MEDICATION_REMINDER_VALIDATION_FAILED" });
      requestAnimationFrame(() => stateHeading.current?.focus());
    }
  }

  async function confirm() {
    if (!online) return;
    setPhase("saving");
    try {
      const request = requestFor(form, current?.version);
      const result = await api(
        current && reminderId
          ? `/api/v1/households/${encodeURIComponent(householdId)}/medication-reminders/${encodeURIComponent(reminderId)}`
          : `/api/v1/households/${encodeURIComponent(householdId)}/medication-reminders`,
        MedicationReminderProjectionSchema,
        {
          method: current && reminderId ? "PUT" : "POST",
          headers: {
            "x-csrf-token": csrf,
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify(request),
        },
      );
      setCurrent(result);
      setForm(formFromReminder(result));
      setPhase("success");
    } catch (error) {
      const caught = asApiFailure(error);
      setFailure(caught.failure);
      setPhase(caught.uncertain ? "uncertain" : "edit");
    }
  }

  async function disable() {
    if (!online || !current || !reminderId) return;
    setPhase("saving");
    try {
      const result = await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/medication-reminders/${encodeURIComponent(reminderId)}/disable`,
        MedicationReminderProjectionSchema,
        {
          method: "POST",
          headers: { "x-csrf-token": csrf, "idempotency-key": newKey() },
          body: JSON.stringify({
            operation: "disable_medication_reminder",
            expectedVersion: current.version,
          }),
        },
      );
      setCurrent(result);
      setPhase("success");
    } catch (error) {
      const caught = asApiFailure(error);
      setFailure(caught.failure);
      setPhase(caught.uncertain ? "uncertain" : "edit");
    }
  }

  return (
    <main id="medication-main" className="medication-main" tabIndex={-1}>
      <h1>{t(locale, "schedules")}</h1>
      <p className="medication-intro">{t(locale, "scheduleIntro")}</p>
      <State tone="warning" heading={t(locale, "authority")}>
        <a
          href={`/notifications/medication-reminders?householdId=${encodeURIComponent(householdId)}`}
        >
          {t(locale, "notifications")}
        </a>
      </State>
      {!online ? <State tone="warning" role="status" heading={t(locale, "offline")} /> : null}
      {phase === "loading" ? <State role="status" heading={t(locale, "loading")} /> : null}
      {failure ? (
        <FailurePanel
          failure={failure}
          locale={locale}
          headingRef={stateHeading}
          onReload={() => void load()}
        />
      ) : null}
      {phase === "uncertain" ? (
        <State tone="warning" heading={t(locale, "uncertain")} headingRef={stateHeading}>
          <button type="button" onClick={() => void load()}>
            {t(locale, "check")}
          </button>
        </State>
      ) : null}
      {!reminderId && phase !== "loading" ? (
        <>
          <ReminderList items={items} householdId={householdId} locale={locale} />
          <h2>{t(locale, "create")}</h2>
        </>
      ) : reminderId && current ? (
        <ReminderFacts reminder={current} locale={locale} />
      ) : null}
      {phase === "review" ? (
        <State heading={t(locale, "review")} headingRef={stateHeading}>
          <p>{t(locale, "reviewNotice")}</p>
          <ReviewFacts form={form} locale={locale} />
          <div className="action-row">
            <button type="button" className="secondary-button" onClick={() => setPhase("edit")}>
              {t(locale, "back")}
            </button>
            <button type="button" onClick={() => void confirm()}>
              {t(locale, current ? "confirmChange" : "confirmCreate")}
            </button>
          </div>
        </State>
      ) : phase === "success" && current ? (
        <State
          role="status"
          heading={t(
            locale,
            current.status === "disabled" ? "disabled" : reminderId ? "changed" : "confirmed",
          )}
          headingRef={stateHeading}
        >
          <ReminderFacts reminder={current} locale={locale} />
          {!reminderId ? (
            <a
              href={`/medication-reminders/${encodeURIComponent(current.reminderId)}?householdId=${encodeURIComponent(householdId)}`}
            >
              {t(locale, "open")}
            </a>
          ) : (
            <button type="button" onClick={() => setPhase("edit")}>
              {t(locale, "edit")}
            </button>
          )}
        </State>
      ) : phase !== "loading" && phase !== "saving" && phase !== "uncertain" ? (
        <ReminderForm
          form={form}
          setForm={setForm}
          locale={locale}
          disabled={!online || current?.status === "disabled"}
          onSubmit={review}
        />
      ) : null}
      {phase === "saving" ? <State role="status" heading={t(locale, "loading")} /> : null}
      {reminderId && current?.status === "active" && phase === "edit" ? (
        <button
          type="button"
          className="danger-button"
          disabled={!online}
          onClick={() => void disable()}
        >
          {t(locale, "disable")}
        </button>
      ) : null}
    </main>
  );
}

function NotificationCenter({ householdId, locale }: { householdId: string; locale: Locale }) {
  const online = useOnline();
  const [items, setItems] = useState<MedicationReminderNotificationProjection[]>([]);
  const [csrf, setCsrf] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);
  const [uncertainOccurrence, setUncertainOccurrence] = useState<string | null>(null);
  const [duplicateOccurrence, setDuplicateOccurrence] = useState<string | null>(null);
  const stateHeading = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    if (!online) {
      setLoading(false);
      return;
    }
    setFailure(null);
    setLoading(true);
    try {
      const [session, list] = await Promise.all([
        api("/api/v1/account/session", IdentitySessionProjectionSchema),
        api(
          `/api/v1/notifications/medication-reminders?householdId=${encodeURIComponent(householdId)}`,
          MedicationReminderNotificationListSchema,
        ),
      ]);
      setCsrf(session.csrfToken);
      setItems(list.items);
      setUncertainOccurrence(null);
    } catch (error) {
      setFailure(failureFrom(error));
    } finally {
      setLoading(false);
    }
  }, [householdId, online]);

  useEffect(() => void load(), [load]);

  async function acknowledge(item: MedicationReminderNotificationProjection) {
    if (!online) return;
    setFailure(null);
    try {
      const request = AcknowledgeMedicationReminderRequestSchema.parse({
        operation: "acknowledge_medication_reminder",
        expectedVersion: item.version,
      });
      const result = await api(
        `/api/v1/notifications/medication-reminders/${encodeURIComponent(item.occurrenceId)}/acknowledgements?householdId=${encodeURIComponent(householdId)}`,
        MedicationReminderAcknowledgementResultSchema,
        {
          method: "POST",
          headers: { "x-csrf-token": csrf, "idempotency-key": newKey() },
          body: JSON.stringify(request),
        },
      );
      setItems((current) =>
        current.map((candidate) =>
          candidate.occurrenceId === item.occurrenceId ? result.notification : candidate,
        ),
      );
      setDuplicateOccurrence(result.result === "duplicate" ? item.occurrenceId : null);
      setUncertainOccurrence(null);
      requestAnimationFrame(() => stateHeading.current?.focus());
    } catch (error) {
      const caught = asApiFailure(error);
      if (caught.uncertain) setUncertainOccurrence(item.occurrenceId);
      else setFailure(caught.failure);
      requestAnimationFrame(() => stateHeading.current?.focus());
    }
  }

  return (
    <main id="medication-main" className="medication-main" tabIndex={-1}>
      <h1>{t(locale, "notifications")}</h1>
      <p className="medication-intro">{t(locale, "notificationsIntro")}</p>
      <State tone="warning" heading={t(locale, "seenOnly")}>
        <a href={`/households/${encodeURIComponent(householdId)}/medication-reminders`}>
          {t(locale, "schedules")}
        </a>
      </State>
      {!online ? <State tone="warning" role="status" heading={t(locale, "offline")} /> : null}
      {loading ? <State role="status" heading={t(locale, "loading")} /> : null}
      {failure ? (
        <FailurePanel
          failure={failure}
          locale={locale}
          headingRef={stateHeading}
          onReload={() => void load()}
        />
      ) : null}
      {uncertainOccurrence ? (
        <State tone="warning" heading={t(locale, "uncertain")} headingRef={stateHeading}>
          <button type="button" onClick={() => void load()}>
            {t(locale, "check")}
          </button>
        </State>
      ) : null}
      {duplicateOccurrence ? (
        <State role="status" heading={t(locale, "duplicate")} headingRef={stateHeading} />
      ) : null}
      {!loading && !failure && items.length === 0 ? (
        <State heading={t(locale, "emptyNotifications")} />
      ) : null}
      <ol className="medication-notification-list">
        {items.map((item) => (
          <li key={item.occurrenceId}>
            <h2>{t(locale, "notifications")}</h2>
            <dl className="medication-facts">
              <Fact label={t(locale, "intent")} value={item.intentState} />
              <Fact label={t(locale, "delivery")} value={deliveryCopy(item, locale)} />
              <Fact
                label={t(locale, "acknowledgement")}
                value={
                  item.acknowledgementState === "seen"
                    ? `${t(locale, "seen")} — ${item.acknowledgedAt ?? ""}`
                    : t(locale, "unacknowledged")
                }
              />
              {item.scheduledAtUtc ? <Fact label="UTC" value={item.scheduledAtUtc} /> : null}
            </dl>
            {item.deliveryState === "delivered" &&
            item.acknowledgementState === "unacknowledged" ? (
              <button type="button" disabled={!online} onClick={() => void acknowledge(item)}>
                {t(locale, "acknowledge")}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </main>
  );
}

function ReminderForm({
  form,
  setForm,
  locale,
  disabled,
  onSubmit,
}: {
  form: FormState;
  setForm: (value: FormState) => void;
  locale: Locale;
  disabled: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm({ ...form, [key]: value });
  return (
    <form className="medication-form" noValidate onSubmit={onSubmit}>
      <label>
        <span>{t(locale, "medicationLabel")}</span>
        <input
          required
          maxLength={80}
          value={form.medicationLabel}
          onChange={(event) => update("medicationLabel", event.target.value)}
        />
      </label>
      <label>
        <span>{t(locale, "amount")}</span>
        <input
          required
          inputMode="decimal"
          placeholder="1"
          value={form.amount}
          onChange={(event) => update("amount", event.target.value)}
        />
      </label>
      <label>
        <span>{t(locale, "unit")}</span>
        <select
          value={form.unit}
          onChange={(event) => update("unit", event.target.value as MedicationReminderUnit)}
        >
          {unitValues.map((unit) => (
            <option key={unit} value={unit}>
              {unit === "unit" ? t(locale, "unitValue") : t(locale, unit)}
            </option>
          ))}
        </select>
      </label>
      {form.unit === "other" ? (
        <label>
          <span>{t(locale, "otherUnit")}</span>
          <input
            required
            maxLength={24}
            value={form.otherUnitLabel}
            onChange={(event) => update("otherUnitLabel", event.target.value)}
          />
        </label>
      ) : null}
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
        <span>{t(locale, "timeZone")}</span>
        <input
          required
          placeholder="Asia/Bangkok"
          value={form.sourceTimeZone}
          onChange={(event) => update("sourceTimeZone", event.target.value)}
        />
      </label>
      <label>
        <span>{t(locale, "utcOffset")}</span>
        <input
          required
          placeholder="+07:00"
          pattern="[+-][0-9]{2}:[0-9]{2}"
          value={form.sourceUtcOffset}
          onChange={(event) => update("sourceUtcOffset", event.target.value)}
        />
      </label>
      <label>
        <span>{t(locale, "ambiguity")}</span>
        <select
          value={form.ambiguousTimePolicy}
          onChange={(event) =>
            update("ambiguousTimePolicy", event.target.value as FormState["ambiguousTimePolicy"])
          }
        >
          <option value="">{t(locale, "ordinary")}</option>
          <option value="earlier">{t(locale, "earlier")}</option>
          <option value="later">{t(locale, "later")}</option>
        </select>
      </label>
      <label>
        <span>{t(locale, "frequency")}</span>
        <select
          value={form.frequency}
          onChange={(event) => update("frequency", event.target.value as FormState["frequency"])}
        >
          <option value="none">{t(locale, "none")}</option>
          <option value="daily">{t(locale, "daily")}</option>
          <option value="weekly">{t(locale, "weekly")}</option>
        </select>
      </label>
      {form.frequency !== "none" ? (
        <>
          <label>
            <span>{t(locale, "interval")}</span>
            <input
              required
              type="number"
              min="1"
              max={form.frequency === "daily" ? "7" : "4"}
              value={form.interval}
              onChange={(event) => update("interval", event.target.value)}
            />
          </label>
          <label>
            <span>{t(locale, "occurrenceCount")}</span>
            <input
              required
              type="number"
              min="2"
              max={form.frequency === "daily" ? "31" : "12"}
              value={form.occurrenceCount}
              onChange={(event) => update("occurrenceCount", event.target.value)}
            />
          </label>
        </>
      ) : null}
      <p>{t(locale, "reviewNotice")}</p>
      <button type="submit" disabled={disabled}>
        {t(locale, "review")}
      </button>
    </form>
  );
}

function ReminderList({
  items,
  householdId,
  locale,
}: {
  items: MedicationReminderProjection[];
  householdId: string;
  locale: Locale;
}) {
  if (items.length === 0) return <State heading={t(locale, "empty")} />;
  return (
    <ol className="medication-schedule-list">
      {items.map((item) => (
        <li key={item.reminderId}>
          <h2>{item.medicationLabel}</h2>
          <p>
            {item.amount}{" "}
            {item.unit === "other"
              ? item.otherUnitLabel
              : t(locale, item.unit === "unit" ? "unitValue" : item.unit)}
          </p>
          <p>
            <time dateTime={item.sourceLocalStart}>{item.sourceLocalStart}</time> —{" "}
            {item.sourceTimeZone} ({item.sourceUtcOffset})
          </p>
          <a
            href={`/medication-reminders/${encodeURIComponent(item.reminderId)}?householdId=${encodeURIComponent(householdId)}`}
          >
            {t(locale, "open")}
          </a>
        </li>
      ))}
    </ol>
  );
}

function ReminderFacts({
  reminder,
  locale,
}: {
  reminder: MedicationReminderProjection;
  locale: Locale;
}) {
  return (
    <dl className="medication-facts">
      <Fact label={t(locale, "medicationLabel")} value={reminder.medicationLabel} />
      <Fact label={t(locale, "amount")} value={reminder.amount} />
      <Fact
        label={t(locale, "unit")}
        value={reminder.unit === "other" ? (reminder.otherUnitLabel ?? "other") : reminder.unit}
      />
      <Fact label={t(locale, "localStart")} value={reminder.sourceLocalStart} />
      <Fact label={t(locale, "timeZone")} value={reminder.sourceTimeZone} />
      <Fact label={t(locale, "utcOffset")} value={reminder.sourceUtcOffset} />
      <Fact label={t(locale, "version")} value={String(reminder.version)} />
      <Fact label={t(locale, "intent")} value={reminder.occurrences[0]?.notificationIntent ?? ""} />
    </dl>
  );
}

function ReviewFacts({ form, locale }: { form: FormState; locale: Locale }) {
  return (
    <dl className="medication-facts">
      <Fact label={t(locale, "medicationLabel")} value={form.medicationLabel} />
      <Fact label={t(locale, "amount")} value={form.amount} />
      <Fact
        label={t(locale, "unit")}
        value={form.unit === "other" ? form.otherUnitLabel : form.unit}
      />
      <Fact label={t(locale, "localStart")} value={form.localStart} />
      <Fact label={t(locale, "timeZone")} value={form.sourceTimeZone} />
      <Fact label={t(locale, "utcOffset")} value={form.sourceUtcOffset} />
      <Fact label={t(locale, "frequency")} value={form.frequency} />
    </dl>
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
  tone = "normal",
  role,
  headingRef,
}: {
  heading: string;
  children?: ReactNode;
  tone?: "normal" | "warning" | "danger";
  role?: "alert" | "status";
  headingRef?: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section className={`medication-state ${tone}`} {...(role ? { role } : {})}>
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
  headingRef,
  onReload,
}: {
  failure: Failure;
  locale: Locale;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onReload: () => void;
}) {
  const denied = failure.code === "COORDINATION_RESOURCE_NOT_FOUND";
  const conflict =
    failure.code === "MEDICATION_REMINDER_VERSION_CONFLICT" ||
    failure.code === "MEDICATION_ACKNOWLEDGEMENT_VERSION_CONFLICT";
  const invalid =
    failure.code === "MEDICATION_REMINDER_VALIDATION_FAILED" ||
    failure.code === "MEDICATION_REMINDER_LOCAL_TIME_INVALID" ||
    failure.code === "MEDICATION_REMINDER_RECURRENCE_INVALID";
  return (
    <State
      tone="danger"
      role="alert"
      heading={t(
        locale,
        denied ? "denied" : conflict ? "conflict" : invalid ? "invalid" : "unavailable",
      )}
      headingRef={headingRef}
    >
      {failure.fieldErrors ? (
        <ul>
          {Object.keys(failure.fieldErrors).map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={onReload}>
        {t(locale, conflict ? "check" : "retry")}
      </button>
    </State>
  );
}

function deliveryCopy(item: MedicationReminderNotificationProjection, locale: Locale): string {
  switch (item.deliveryState) {
    case "delivered":
      return t(locale, "delivered");
    case "failed":
      return t(locale, "failed");
    case "missed":
      return t(locale, "missed");
    case "uncertain":
      return t(locale, "uncertainDelivery");
    case "cancelled":
      return t(locale, "cancelled");
    default:
      return t(locale, "pending");
  }
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
        "x-correlation-id": `web_p4s1_${crypto.randomUUID().replaceAll("-", "")}`,
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiFailure({ code: "NETWORK_UNAVAILABLE" }, Boolean(init?.method));
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiFailure({ code: "SERVICE_UNAVAILABLE" }, Boolean(init?.method));
  }
  if (!response.ok) {
    throw new ApiFailure(
      (body as { error?: Failure } | null)?.error ?? { code: "SERVICE_UNAVAILABLE" },
      Boolean(init?.method) && response.status >= 500,
    );
  }
  return schema.parse((body as { data?: unknown }).data);
}

function requestFor(form: FormState, expectedVersion?: number) {
  const schedule = {
    localStart: form.localStart,
    sourceTimeZone: form.sourceTimeZone,
    sourceUtcOffset: form.sourceUtcOffset,
    ambiguousTimePolicy: form.ambiguousTimePolicy || null,
    recurrence:
      form.frequency === "none"
        ? { frequency: "none" as const }
        : form.frequency === "daily"
          ? {
              frequency: "daily" as const,
              intervalDays: Number(form.interval),
              occurrenceCount: Number(form.occurrenceCount),
            }
          : {
              frequency: "weekly" as const,
              intervalWeeks: Number(form.interval),
              occurrenceCount: Number(form.occurrenceCount),
            },
  };
  const facts = {
    medicationLabel: form.medicationLabel,
    amount: form.amount,
    unit: form.unit,
    otherUnitLabel: form.unit === "other" ? form.otherUnitLabel : null,
    schedule,
  };
  return expectedVersion
    ? ChangeMedicationReminderRequestSchema.parse({
        operation: "change_medication_reminder" as const,
        expectedVersion,
        ...facts,
      })
    : CreateMedicationReminderRequestSchema.parse({
        operation: "create_medication_reminder" as const,
        ...facts,
      });
}

function emptyForm(): FormState {
  return {
    medicationLabel: "",
    amount: "",
    unit: "tablet",
    otherUnitLabel: "",
    localStart: "",
    sourceTimeZone: "",
    sourceUtcOffset: "",
    ambiguousTimePolicy: "",
    frequency: "none",
    interval: "1",
    occurrenceCount: "2",
  };
}

function formFromReminder(reminder: MedicationReminderProjection): FormState {
  const recurrence = reminder.recurrence;
  return {
    medicationLabel: reminder.medicationLabel,
    amount: reminder.amount,
    unit: reminder.unit,
    otherUnitLabel: reminder.otherUnitLabel ?? "",
    localStart: reminder.sourceLocalStart,
    sourceTimeZone: reminder.sourceTimeZone,
    sourceUtcOffset: reminder.sourceUtcOffset,
    ambiguousTimePolicy: reminder.ambiguousTimePolicy ?? "",
    frequency: recurrence.frequency,
    interval:
      recurrence.frequency === "daily"
        ? String(recurrence.intervalDays)
        : recurrence.frequency === "weekly"
          ? String(recurrence.intervalWeeks)
          : "1",
    occurrenceCount: recurrence.frequency === "none" ? "2" : String(recurrence.occurrenceCount),
  };
}

function useOnline(): boolean {
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

function failureFrom(error: unknown): Failure {
  return asApiFailure(error).failure;
}

function asApiFailure(error: unknown): ApiFailure {
  return error instanceof ApiFailure
    ? error
    : new ApiFailure({ code: "SERVICE_UNAVAILABLE" }, false);
}

function newKey(): string {
  return `p4s1_${crypto.randomUUID()}`;
}

const unitValues: MedicationReminderUnit[] = [
  "tablet",
  "capsule",
  "millilitre",
  "drop",
  "puff",
  "patch",
  "application",
  "unit",
  "other",
];
