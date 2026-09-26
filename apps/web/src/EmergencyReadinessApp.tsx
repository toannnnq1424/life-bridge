"use client";

import {
  EmergencyContactListProjectionSchema,
  EmergencyContactMutationResultSchema,
  EmergencyOfflineSnapshotSchema,
  EmergencyPlanMutationResultSchema,
  EmergencyPlanProjectionSchema,
  IdentitySessionProjectionSchema,
  type EmergencyContactProjection,
  type EmergencyPlanProjection,
} from "@lifebridge/contracts";
import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

import {
  hasEmergencyOfflineCopy,
  purgeEmergencyOfflineCopyIfSuperseded,
  registerEmergencyOfflineShell,
  removeEmergencyOfflineCopy,
  saveEmergencyOfflineCopy,
} from "./emergency-offline-store";

type Locale = "vi-VN" | "en";
type View = "contacts" | "plan";
type Phase =
  | "loading"
  | "view"
  | "review"
  | "saving"
  | "contacts-confirmed"
  | "draft-confirmed"
  | "plan-confirmed"
  | "conflict"
  | "uncertain"
  | "denied"
  | "unavailable";

interface Props {
  householdId: string;
  view: View;
}

interface EditableContact {
  contactId?: string;
  expectedVersion?: number;
  displayLabel: string;
  dialString: string;
}

interface Failure {
  code: string;
  recoveryAction?: string;
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
  en: {
    skip: "Skip to main content",
    language: "Language",
    contactsTitle: "Emergency contacts",
    planTitle: "Emergency plan",
    liveContacts: "Live server-confirmed information — permission checked for this view.",
    livePlan:
      "Live, server-confirmed plan — permission checked for this view. This is not an offline copy.",
    offline:
      "Offline — current permission and updates cannot be checked. Writes are blocked, never queued, and never submitted on reconnect.",
    authority:
      "Organizer or member status never replaces participant consent. Contact possession never creates authority.",
    safety:
      "LifeBridge only displays participant-entered contacts and a participant-reviewed plan. It does not diagnose, rank urgency, contact anyone, or dispatch emergency services.",
    callBoundary:
      "Choosing a configured number opens the device calling function. LifeBridge does not place, confirm, or guarantee a call.",
    loading: "Loading server-confirmed emergency readiness…",
    noContacts: "No emergency contacts are configured.",
    contactProjection:
      "This purpose-limited view shows only the configured order, display label, and one phone method.",
    addContact: "Add contact",
    displayLabel: "Display label",
    dialString: "Configured phone number",
    moveEarlier: "Move earlier",
    moveLater: "Move later",
    remove: "Remove",
    reviewContacts: "Review complete order",
    proposedOrder: "Proposed complete order — not yet sent",
    contactConsequence:
      "A confirmed contact change makes the reviewed plan require review and separately removes any saved offline copy.",
    back: "Back to edit",
    confirmContacts: "Confirm complete contact list",
    emptyReview: "The confirmed list will contain no contacts.",
    planNoPlan: "No reviewed emergency plan is confirmed.",
    draftOnly: "Working draft — not a confirmed plan",
    reviewRequired: "Contacts changed. Participant review is required before a new offline copy.",
    planSteps: "Participant-entered plan steps",
    addStep: "Add step",
    removeStep: "Remove step",
    saveDraft: "Save draft on server",
    reviewVersion: "Review and confirm version",
    currentPlan: "Participant-reviewed, server-confirmed plan",
    configuredContacts: "Configured contacts in reviewed order",
    facts: "Confirmation facts",
    planVersion: "Plan version",
    contactRevision: "Contact-list revision",
    lastConfirmed: "Last confirmed",
    reviewZone: "IANA display time zone",
    offlineSetup: "Save an encrypted offline copy",
    offlineReview:
      "Copies only the reviewed steps, minimum contacts, source versions, and confirmation/expiry facts. It is within the reading window for 24 hours, stale through 72 hours, then hidden and purged. Remote revocation cannot be learned offline.",
    deviceRisk:
      "Anyone with this passphrase and browser profile may read the copy. Same-origin script compromise or an unlocked device can expose it.",
    passphrase: "Offline passphrase (not your account password)",
    passphraseHelp:
      "12–128 characters. Paste and password managers are allowed. It is never sent, saved, hinted, or recoverable.",
    saveCopy: "Save encrypted copy on this device",
    removeCopy: "Remove saved copy",
    copySaved:
      "Plan confirmation and offline storage are separate: the encrypted copy was verified on this device.",
    copyRemoved: "Saved offline copy removed from this device.",
    copyFailed:
      "The live plan remains available, but the offline copy was not saved or could not be verified.",
    copyPresent: "This device has a saved encrypted copy.",
    copyAbsent: "This device has no saved emergency-plan copy.",
    confirmedContacts: "Contact list confirmed by the server.",
    confirmedDraft: "Draft saved by the server; it is not the current reviewed plan.",
    confirmedPlan: "Emergency plan version confirmed by the server.",
    invalid: "Correct the linked fields before review.",
    denied: "This content does not exist or the current account lacks purpose-scoped authority.",
    unavailable: "The service is unavailable. An empty list or no-plan state is not inferred.",
    conflict:
      "The confirmed state changed. Your choices remain unsent; load current state and review again.",
    uncertain: "The request outcome is unknown. Do not retry blindly; check current state first.",
    check: "Check current state",
    requiredLabel: "Enter a display label.",
    requiredDial: "Enter 3–15 digits, optionally beginning with +.",
    requiredStep: "Enter at least one plan step.",
    focusStatus: "Emergency readiness status",
  },
  "vi-VN": {
    skip: "Bỏ qua đến nội dung chính",
    language: "Ngôn ngữ",
    contactsTitle: "Danh bạ khẩn cấp",
    planTitle: "Kế hoạch khẩn cấp",
    liveContacts:
      "Thông tin trực tiếp đã được máy chủ xác nhận — quyền đã được kiểm tra cho lần xem này.",
    livePlan:
      "Kế hoạch trực tiếp đã được máy chủ xác nhận — quyền đã được kiểm tra cho lần xem này. Đây không phải bản sao ngoại tuyến.",
    offline:
      "Đang ngoại tuyến — không thể kiểm tra quyền hiện tại hoặc cập nhật. Mọi thay đổi đều bị chặn, không xếp hàng và không tự gửi khi kết nối lại.",
    authority:
      "Vai trò người tổ chức hoặc thành viên không thay thế sự đồng ý của người tham gia. Việc giữ bản sao liên hệ không tạo quyền.",
    safety:
      "LifeBridge chỉ hiển thị liên hệ do người tham gia nhập và kế hoạch do người tham gia rà soát. Ứng dụng không chẩn đoán, xếp hạng mức độ khẩn cấp, liên hệ bất kỳ ai hoặc điều phối dịch vụ khẩn cấp.",
    callBoundary:
      "Chọn số đã cấu hình chỉ mở chức năng gọi trên thiết bị. LifeBridge không thực hiện, xác nhận hoặc bảo đảm cuộc gọi.",
    loading: "Đang tải trạng thái sẵn sàng khẩn cấp đã được máy chủ xác nhận…",
    noContacts: "Chưa cấu hình liên hệ khẩn cấp.",
    contactProjection:
      "Chế độ xem giới hạn theo mục đích chỉ hiển thị thứ tự, nhãn và một phương thức điện thoại đã cấu hình.",
    addContact: "Thêm liên hệ",
    displayLabel: "Nhãn hiển thị",
    dialString: "Số điện thoại đã cấu hình",
    moveEarlier: "Chuyển lên trước",
    moveLater: "Chuyển xuống sau",
    remove: "Xóa",
    reviewContacts: "Rà soát toàn bộ thứ tự",
    proposedOrder: "Toàn bộ thứ tự đề xuất — chưa gửi",
    contactConsequence:
      "Thay đổi liên hệ đã xác nhận làm kế hoạch cần rà soát lại và bản sao ngoại tuyến được xóa riêng.",
    back: "Quay lại chỉnh sửa",
    confirmContacts: "Xác nhận toàn bộ danh bạ",
    emptyReview: "Danh bạ đã xác nhận sẽ không có liên hệ.",
    planNoPlan: "Chưa có kế hoạch khẩn cấp đã rà soát và xác nhận.",
    draftOnly: "Bản nháp đang làm — chưa phải kế hoạch đã xác nhận",
    reviewRequired: "Liên hệ đã thay đổi. Cần rà soát lại trước khi tạo bản sao ngoại tuyến mới.",
    planSteps: "Các bước kế hoạch do người tham gia nhập",
    addStep: "Thêm bước",
    removeStep: "Xóa bước",
    saveDraft: "Lưu bản nháp trên máy chủ",
    reviewVersion: "Rà soát và xác nhận phiên bản",
    currentPlan: "Kế hoạch do người tham gia rà soát và máy chủ xác nhận",
    configuredContacts: "Liên hệ đã cấu hình theo thứ tự được rà soát",
    facts: "Dữ kiện xác nhận",
    planVersion: "Phiên bản kế hoạch",
    contactRevision: "Lần sửa danh bạ",
    lastConfirmed: "Lần cuối xác nhận",
    reviewZone: "Múi giờ hiển thị IANA",
    offlineSetup: "Lưu bản sao ngoại tuyến đã mã hóa",
    offlineReview:
      "Chỉ sao chép các bước đã rà soát, liên hệ tối thiểu, phiên bản nguồn và dữ kiện xác nhận/hết hạn. Bản sao nằm trong khoảng đọc 24 giờ, cũ đến 72 giờ, sau đó bị ẩn và xóa. Không thể biết thu hồi từ xa khi ngoại tuyến.",
    deviceRisk:
      "Bất kỳ ai có cụm mật khẩu và hồ sơ trình duyệt này đều có thể đọc bản sao. Mã cùng nguồn bị xâm phạm hoặc thiết bị không khóa có thể làm lộ nội dung.",
    passphrase: "Cụm mật khẩu ngoại tuyến (không phải mật khẩu tài khoản)",
    passphraseHelp:
      "12–128 ký tự. Có thể dán và dùng trình quản lý mật khẩu. Cụm này không được gửi, lưu, gợi ý hoặc khôi phục.",
    saveCopy: "Lưu bản sao đã mã hóa trên thiết bị",
    removeCopy: "Xóa bản sao đã lưu",
    copySaved:
      "Xác nhận kế hoạch và lưu ngoại tuyến là hai việc riêng: bản sao đã mã hóa đã được kiểm tra trên thiết bị.",
    copyRemoved: "Bản sao ngoại tuyến đã được xóa khỏi thiết bị.",
    copyFailed:
      "Kế hoạch trực tiếp vẫn dùng được, nhưng bản sao ngoại tuyến chưa được lưu hoặc không thể xác minh.",
    copyPresent: "Thiết bị này có bản sao đã mã hóa.",
    copyAbsent: "Thiết bị này không có bản sao kế hoạch khẩn cấp đã lưu.",
    confirmedContacts: "Danh bạ đã được máy chủ xác nhận.",
    confirmedDraft: "Bản nháp đã được máy chủ lưu; chưa phải kế hoạch hiện tại đã rà soát.",
    confirmedPlan: "Phiên bản kế hoạch khẩn cấp đã được máy chủ xác nhận.",
    invalid: "Sửa các trường được liên kết trước khi rà soát.",
    denied: "Nội dung không tồn tại hoặc tài khoản hiện tại không có quyền đúng mục đích.",
    unavailable:
      "Dịch vụ không khả dụng. Không suy diễn thành danh sách trống hoặc không có kế hoạch.",
    conflict:
      "Trạng thái đã xác nhận đã thay đổi. Lựa chọn của bạn vẫn chưa gửi; hãy tải trạng thái hiện tại và rà soát lại.",
    uncertain:
      "Chưa biết kết quả yêu cầu. Không thử lại mù quáng; hãy kiểm tra trạng thái hiện tại trước.",
    check: "Kiểm tra trạng thái hiện tại",
    requiredLabel: "Nhập nhãn hiển thị.",
    requiredDial: "Nhập 3–15 chữ số, có thể bắt đầu bằng +.",
    requiredStep: "Nhập ít nhất một bước kế hoạch.",
    focusStatus: "Trạng thái sẵn sàng khẩn cấp",
  },
} as const;

type CopyKey = keyof typeof copy.en;
const t = (locale: Locale, key: CopyKey) => copy[locale][key];

export function EmergencyReadinessApp({ householdId, view }: Props) {
  const [locale, setLocale] = useState<Locale>("vi-VN");
  const [online, setOnline] = useState(true);
  const [phase, setPhase] = useState<Phase>("loading");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [csrf, setCsrf] = useState("");
  const [contacts, setContacts] = useState<EditableContact[]>([]);
  const [listRevision, setListRevision] = useState(0);
  const [plan, setPlan] = useState<EmergencyPlanProjection | null>(null);
  const [steps, setSteps] = useState([""]);
  const [displayTimeZone, setDisplayTimeZone] = useState("Asia/Bangkok");
  const [passphrase, setPassphrase] = useState("");
  const [copyStatus, setCopyStatus] = useState<
    "present" | "absent" | "saved" | "removed" | "failed"
  >("absent");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const statusHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("lifebridge.locale");
    if (saved === "vi-VN" || saved === "en") setLocale(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("lifebridge.locale", locale);
  }, [locale]);
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
  useEffect(() => {
    if (phase === "review") {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("#contact-review-title")?.focus(),
      );
    } else if (phase !== "view" && phase !== "loading") {
      requestAnimationFrame(() => statusHeading.current?.focus());
    }
  }, [phase]);

  const load = useCallback(async () => {
    if (!navigator.onLine) {
      setOnline(false);
      setPhase("view");
      return;
    }
    setPhase("loading");
    setFailure(null);
    try {
      const [session, contactResult, planResult] = await Promise.all([
        api("/api/v1/account/session", IdentitySessionProjectionSchema),
        api(
          `/api/v1/households/${encodeURIComponent(householdId)}/emergency-contacts`,
          EmergencyContactListProjectionSchema,
        ),
        api(
          `/api/v1/households/${encodeURIComponent(householdId)}/emergency-plan`,
          EmergencyPlanProjectionSchema,
        ),
      ]);
      await purgeEmergencyOfflineCopyIfSuperseded(
        planResult.state === "reviewed" ? (planResult.current?.planVersion ?? null) : null,
        contactResult.listRevision,
      ).catch(() => undefined);
      const saved = await hasEmergencyOfflineCopy().catch(() => false);
      setCsrf(session.csrfToken);
      setListRevision(contactResult.listRevision);
      setContacts(contactResult.contacts.map(editableContact));
      setPlan(planResult);
      setSteps(planResult.draft?.steps ?? planResult.current?.steps ?? [""]);
      setCopyStatus(saved ? "present" : "absent");
      setPhase("view");
    } catch (error) {
      if (error instanceof ApiFailure && error.failure.code === "COORDINATION_RESOURCE_NOT_FOUND") {
        await removeEmergencyOfflineCopy().catch(() => undefined);
      }
      handleFailure(error, setFailure, setPhase);
    }
  }, [householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  const title = view === "contacts" ? t(locale, "contactsTitle") : t(locale, "planTitle");
  return (
    <div className="emergency-app">
      <a className="skip-link" href="#emergency-main">
        {t(locale, "skip")}
      </a>
      <header className="emergency-header">
        <div>
          <a className="brand" href={`/households/${encodeURIComponent(householdId)}`}>
            LifeBridge
          </a>
          <p>{t(locale, "authority")}</p>
        </div>
        <label>
          {t(locale, "language")}
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <nav className="emergency-nav" aria-label="Emergency readiness">
        <a
          aria-current={view === "contacts" ? "page" : undefined}
          href={`/households/${encodeURIComponent(householdId)}/emergency-contacts`}
        >
          {t(locale, "contactsTitle")}
        </a>
        <a
          aria-current={view === "plan" ? "page" : undefined}
          href={`/households/${encodeURIComponent(householdId)}/emergency-plan`}
        >
          {t(locale, "planTitle")}
        </a>
      </nav>
      <main id="emergency-main" className="emergency-main">
        <h1>{title}</h1>
        <section className={`source-banner ${online ? "source-live" : "source-offline"}`}>
          <h2>{online ? "● Live / Trực tiếp" : "◇ Offline / Ngoại tuyến"}</h2>
          <p>
            {online
              ? t(locale, view === "plan" ? "livePlan" : "liveContacts")
              : t(locale, "offline")}
          </p>
        </section>
        <section className="emergency-safety" aria-labelledby="emergency-safety-title">
          <h2 id="emergency-safety-title">Safety boundary / Giới hạn an toàn</h2>
          <p>{t(locale, "safety")}</p>
          <p>{t(locale, "callBoundary")}</p>
        </section>
        <StatePanel
          locale={locale}
          phase={phase}
          failure={failure}
          headingRef={statusHeading}
          onReload={() => void load()}
        />
        {phase !== "loading" && phase !== "denied" && phase !== "unavailable" ? (
          view === "contacts" ? (
            <ContactsEditor
              locale={locale}
              contacts={contacts}
              setContacts={setContacts}
              listRevision={listRevision}
              online={online}
              phase={phase}
              setPhase={setPhase}
              errors={errors}
              setErrors={setErrors}
              csrf={csrf}
              householdId={householdId}
              reload={load}
            />
          ) : (
            <PlanEditor
              locale={locale}
              contacts={contacts}
              plan={plan}
              steps={steps}
              setSteps={setSteps}
              displayTimeZone={displayTimeZone}
              setDisplayTimeZone={setDisplayTimeZone}
              online={online}
              csrf={csrf}
              householdId={householdId}
              setPhase={setPhase}
              setFailure={setFailure}
              reload={load}
              passphrase={passphrase}
              setPassphrase={setPassphrase}
              copyStatus={copyStatus}
              setCopyStatus={setCopyStatus}
            />
          )
        ) : null}
      </main>
      <footer className="emergency-footer">
        <p>{t(locale, "safety")}</p>
      </footer>
    </div>
  );
}

function ContactsEditor(props: {
  locale: Locale;
  contacts: EditableContact[];
  setContacts: (value: EditableContact[]) => void;
  listRevision: number;
  online: boolean;
  phase: Phase;
  setPhase: (value: Phase) => void;
  errors: Record<string, string>;
  setErrors: (value: Record<string, string>) => void;
  csrf: string;
  householdId: string;
  reload: () => Promise<void>;
}) {
  const {
    locale,
    contacts,
    setContacts,
    listRevision,
    online,
    phase,
    setPhase,
    errors,
    setErrors,
    csrf,
    householdId,
    reload,
  } = props;

  const move = (from: number, to: number) => {
    const next = [...contacts];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    setContacts(next);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-contact-position="${to}"]`)?.focus(),
    );
  };

  const validate = () => {
    const next: Record<string, string> = {};
    contacts.forEach((contact, index) => {
      if (!contact.displayLabel.trim()) next[`label-${index}`] = t(locale, "requiredLabel");
      if (!/^\+?\d{3,15}$/.test(contact.dialString)) {
        next[`dial-${index}`] = t(locale, "requiredDial");
      }
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const confirm = async () => {
    if (!online || !validate()) return;
    setPhase("saving");
    try {
      await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/emergency-contacts`,
        EmergencyContactMutationResultSchema,
        {
          method: "PUT",
          headers: mutationHeaders(csrf),
          body: JSON.stringify({
            operation: "replace_emergency_contacts",
            expectedListRevision: listRevision,
            contacts: contacts.map((contact) => ({
              ...(contact.contactId
                ? {
                    contactId: contact.contactId,
                    expectedVersion: contact.expectedVersion,
                  }
                : {}),
              displayLabel: contact.displayLabel.trim(),
              dialString: contact.dialString,
            })),
          }),
        },
      );
      await removeEmergencyOfflineCopy().catch(() => undefined);
      await reload();
      setPhase("contacts-confirmed");
    } catch (error) {
      handleFailure(error, () => undefined, setPhase);
    }
  };

  if (phase === "review") {
    return (
      <section className="emergency-panel" aria-labelledby="contact-review-title">
        <h2 id="contact-review-title" tabIndex={-1}>
          {t(locale, "proposedOrder")}
        </h2>
        {contacts.length ? (
          <ol>
            {contacts.map((contact, index) => (
              <li key={contact.contactId ?? `new-${index}`}>
                {contact.displayLabel} — {contact.dialString}
              </li>
            ))}
          </ol>
        ) : (
          <p>{t(locale, "emptyReview")}</p>
        )}
        <dl>
          <dt>{t(locale, "contactRevision")}</dt>
          <dd>{listRevision}</dd>
        </dl>
        <p className="warning">{t(locale, "contactConsequence")}</p>
        <div className="button-row">
          <button type="button" onClick={() => setPhase("view")}>
            {t(locale, "back")}
          </button>
          <button type="button" disabled={!online} onClick={() => void confirm()}>
            {t(locale, "confirmContacts")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="emergency-panel" aria-labelledby="contact-list-title">
      <h2 id="contact-list-title">{t(locale, "contactsTitle")}</h2>
      <p>{t(locale, "contactProjection")}</p>
      {Object.keys(errors).length ? (
        <div className="error-summary" role="alert" tabIndex={-1}>
          <h3>{t(locale, "invalid")}</h3>
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`}>{message}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!contacts.length ? <p>{t(locale, "noContacts")}</p> : null}
      <ol className="contact-list">
        {contacts.map((contact, index) => (
          <li key={contact.contactId ?? `new-${index}`}>
            <article className="contact-card">
              <p className="position">
                {index + 1} / {contacts.length}
              </p>
              <label htmlFor={`label-${index}`}>
                {t(locale, "displayLabel")}
                <input
                  id={`label-${index}`}
                  value={contact.displayLabel}
                  aria-invalid={Boolean(errors[`label-${index}`])}
                  onChange={(event) => {
                    const next = [...contacts];
                    next[index] = { ...contact, displayLabel: event.target.value };
                    setContacts(next);
                  }}
                />
              </label>
              <label htmlFor={`dial-${index}`}>
                {t(locale, "dialString")}
                <input
                  id={`dial-${index}`}
                  inputMode="tel"
                  value={contact.dialString}
                  aria-invalid={Boolean(errors[`dial-${index}`])}
                  onChange={(event) => {
                    const next = [...contacts];
                    next[index] = { ...contact, dialString: event.target.value };
                    setContacts(next);
                  }}
                />
              </label>
              <div className="button-row">
                <button
                  type="button"
                  data-contact-position={index}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  ↑ {t(locale, "moveEarlier")}
                </button>
                <button
                  type="button"
                  disabled={index === contacts.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ↓ {t(locale, "moveLater")}
                </button>
                <button
                  type="button"
                  onClick={() => setContacts(contacts.filter((_, position) => position !== index))}
                >
                  {t(locale, "remove")}
                </button>
              </div>
            </article>
          </li>
        ))}
      </ol>
      <div className="button-row">
        <button
          type="button"
          disabled={contacts.length >= 10}
          onClick={() => setContacts([...contacts, { displayLabel: "", dialString: "" }])}
        >
          {t(locale, "addContact")}
        </button>
        <button
          type="button"
          disabled={!online}
          onClick={() => {
            if (validate()) setPhase("review");
          }}
        >
          {t(locale, "reviewContacts")}
        </button>
      </div>
    </section>
  );
}

function PlanEditor(props: {
  locale: Locale;
  contacts: EditableContact[];
  plan: EmergencyPlanProjection | null;
  steps: string[];
  setSteps: (value: string[]) => void;
  displayTimeZone: string;
  setDisplayTimeZone: (value: string) => void;
  online: boolean;
  csrf: string;
  householdId: string;
  setPhase: (value: Phase) => void;
  setFailure: (value: Failure | null) => void;
  reload: () => Promise<void>;
  passphrase: string;
  setPassphrase: (value: string) => void;
  copyStatus: "present" | "absent" | "saved" | "removed" | "failed";
  setCopyStatus: (value: "present" | "absent" | "saved" | "removed" | "failed") => void;
}) {
  const {
    locale,
    contacts,
    plan,
    steps,
    setSteps,
    displayTimeZone,
    setDisplayTimeZone,
    online,
    csrf,
    householdId,
    setPhase,
    setFailure,
    reload,
    passphrase,
    setPassphrase,
    copyStatus,
    setCopyStatus,
  } = props;
  const [stepError, setStepError] = useState("");
  const current = plan?.current ?? null;
  const draft = plan?.draft ?? null;

  const saveDraft = async () => {
    const normalized = steps.map((step) => step.trim()).filter(Boolean);
    if (!normalized.length) {
      setStepError(t(locale, "requiredStep"));
      return;
    }
    setStepError("");
    setPhase("saving");
    try {
      await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/emergency-plan/draft`,
        EmergencyPlanMutationResultSchema,
        {
          method: "PUT",
          headers: mutationHeaders(csrf),
          body: JSON.stringify({
            operation: "save_emergency_plan_draft",
            expectedAggregateRevision: plan?.aggregateRevision ?? 0,
            expectedDraftRevision: draft?.draftRevision ?? 0,
            basePlanVersion: current?.planVersion ?? 0,
            contactListRevision: plan?.contactListRevision ?? 0,
            steps: normalized,
          }),
        },
      );
      await reload();
      setPhase("draft-confirmed");
    } catch (error) {
      handleFailure(error, setFailure, setPhase);
    }
  };

  const reviewVersion = async () => {
    if (!draft || !plan) return;
    setPhase("saving");
    try {
      await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/emergency-plan/reviews`,
        EmergencyPlanMutationResultSchema,
        {
          method: "POST",
          headers: mutationHeaders(csrf),
          body: JSON.stringify({
            operation: "review_emergency_plan_version",
            expectedAggregateRevision: plan.aggregateRevision,
            expectedDraftRevision: draft.draftRevision,
            basePlanVersion: current?.planVersion ?? 0,
            contactListRevision: plan.contactListRevision,
            displayTimeZone,
          }),
        },
      );
      await removeEmergencyOfflineCopy().catch(() => undefined);
      setCopyStatus("removed");
      await reload();
      setPhase("plan-confirmed");
    } catch (error) {
      handleFailure(error, setFailure, setPhase);
    }
  };

  const saveOffline = async (event: FormEvent) => {
    event.preventDefault();
    if (!online || !current) return;
    setCopyStatus("absent");
    try {
      const snapshot = await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/emergency-plan/offline-snapshot`,
        EmergencyOfflineSnapshotSchema,
      );
      await saveEmergencyOfflineCopy(
        snapshot,
        passphrase,
        `/households/${householdId}/emergency-plan`,
      );
      const registration = await registerEmergencyOfflineShell();
      if (registration !== "registered") {
        await removeEmergencyOfflineCopy();
        throw new Error("offline_shell_unavailable");
      }
      setPassphrase("");
      setCopyStatus("saved");
    } catch {
      setCopyStatus("failed");
    }
  };

  return (
    <>
      <section className="emergency-panel" aria-labelledby="current-plan-title">
        <h2 id="current-plan-title">{t(locale, "currentPlan")}</h2>
        {!current ? (
          <p>{t(locale, plan?.state === "draft_only" ? "draftOnly" : "planNoPlan")}</p>
        ) : null}
        {plan?.state === "review_required" ? (
          <p className="warning">{t(locale, "reviewRequired")}</p>
        ) : null}
        {current ? (
          <>
            <ol className="plan-steps">
              {current.steps.map((step, index) => (
                <li key={`${current.planVersion}-${index}`}>{step}</li>
              ))}
            </ol>
            <h3>{t(locale, "configuredContacts")}</h3>
            <ol className="configured-contacts">
              {contacts.map((contact, index) => (
                <li key={contact.contactId ?? index}>
                  <strong>{contact.displayLabel}</strong>{" "}
                  <a href={`tel:${contact.dialString}`}>{contact.dialString}</a>
                </li>
              ))}
            </ol>
            <p>{t(locale, "callBoundary")}</p>
            <h3>{t(locale, "facts")}</h3>
            <dl className="facts">
              <dt>{t(locale, "planVersion")}</dt>
              <dd>{current.planVersion}</dd>
              <dt>{t(locale, "contactRevision")}</dt>
              <dd>{current.contactListRevision}</dd>
              <dt>{t(locale, "lastConfirmed")}</dt>
              <dd>
                <time dateTime={current.reviewedAtUtc}>{current.reviewedAtUtc}</time>
                <br />
                {current.displayLocalTime} {current.displayUtcOffset} ({current.displayTimeZone})
              </dd>
            </dl>
          </>
        ) : null}
      </section>
      <section className="emergency-panel" aria-labelledby="plan-editor-title">
        <h2 id="plan-editor-title">{t(locale, "planSteps")}</h2>
        {stepError ? (
          <p className="field-error" id="step-error" role="alert">
            {stepError}
          </p>
        ) : null}
        <ol className="step-editor">
          {steps.map((step, index) => (
            <li key={index}>
              <label htmlFor={`step-${index}`}>
                {t(locale, "planSteps")} {index + 1}
                <textarea
                  id={`step-${index}`}
                  maxLength={160}
                  value={step}
                  aria-describedby={stepError ? "step-error" : undefined}
                  onChange={(event) => {
                    const next = [...steps];
                    next[index] = event.target.value;
                    setSteps(next);
                  }}
                />
              </label>
              <button
                type="button"
                disabled={steps.length === 1}
                onClick={() => setSteps(steps.filter((_, position) => position !== index))}
              >
                {t(locale, "removeStep")}
              </button>
            </li>
          ))}
        </ol>
        <label>
          {t(locale, "reviewZone")}
          <input
            value={displayTimeZone}
            onChange={(event) => setDisplayTimeZone(event.target.value)}
          />
        </label>
        <div className="button-row">
          <button
            type="button"
            disabled={steps.length >= 8}
            onClick={() => setSteps([...steps, ""])}
          >
            {t(locale, "addStep")}
          </button>
          <button type="button" disabled={!online} onClick={() => void saveDraft()}>
            {t(locale, "saveDraft")}
          </button>
          <button type="button" disabled={!online || !draft} onClick={() => void reviewVersion()}>
            {t(locale, "reviewVersion")}
          </button>
        </div>
      </section>
      <section className="emergency-panel offline-setup" aria-labelledby="offline-setup-title">
        <h2 id="offline-setup-title">{t(locale, "offlineSetup")}</h2>
        <p>{t(locale, "offlineReview")}</p>
        <p className="warning">{t(locale, "deviceRisk")}</p>
        <p role="status">
          {t(
            locale,
            copyStatus === "present"
              ? "copyPresent"
              : copyStatus === "saved"
                ? "copySaved"
                : copyStatus === "removed"
                  ? "copyRemoved"
                  : copyStatus === "failed"
                    ? "copyFailed"
                    : "copyAbsent",
          )}
        </p>
        <form onSubmit={(event) => void saveOffline(event)}>
          <label htmlFor="offline-passphrase">
            {t(locale, "passphrase")}
            <input
              id="offline-passphrase"
              type="password"
              minLength={12}
              maxLength={128}
              value={passphrase}
              autoComplete="new-password"
              onChange={(event) => setPassphrase(event.target.value)}
              aria-describedby="offline-passphrase-help"
            />
          </label>
          <p id="offline-passphrase-help">{t(locale, "passphraseHelp")}</p>
          <div className="button-row">
            <button
              type="submit"
              disabled={
                !online ||
                plan?.state !== "reviewed" ||
                [...passphrase.normalize("NFC")].length < 12
              }
            >
              {t(locale, "saveCopy")}
            </button>
            <button
              className="danger-button"
              type="button"
              onClick={() => {
                void removeEmergencyOfflineCopy().then(() => setCopyStatus("removed"));
              }}
            >
              {t(locale, "removeCopy")}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

function StatePanel(props: {
  locale: Locale;
  phase: Phase;
  failure: Failure | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onReload: () => void;
}) {
  const { locale, phase, headingRef, onReload } = props;
  if (phase === "view" || phase === "review") return null;
  const key: CopyKey =
    phase === "loading"
      ? "loading"
      : phase === "contacts-confirmed"
        ? "confirmedContacts"
        : phase === "draft-confirmed"
          ? "confirmedDraft"
          : phase === "plan-confirmed"
            ? "confirmedPlan"
            : phase === "conflict"
              ? "conflict"
              : phase === "uncertain"
                ? "uncertain"
                : phase === "denied"
                  ? "denied"
                  : phase === "unavailable"
                    ? "unavailable"
                    : "loading";
  return (
    <section className={`state-panel state-${phase}`} aria-live="polite">
      <h2 ref={headingRef} tabIndex={-1}>
        {t(locale, key)}
      </h2>
      {phase === "conflict" || phase === "uncertain" || phase === "unavailable" ? (
        <button type="button" onClick={onReload}>
          {t(locale, "check")}
        </button>
      ) : null}
    </section>
  );
}

async function api<T>(
  url: string,
  schema: { parse(value: unknown): T },
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
      (body as { error?: Failure })?.error ?? { code: "SERVICE_UNAVAILABLE" },
      Boolean(init?.method) && response.status >= 500,
    );
  }
  return schema.parse((body as { data?: unknown }).data);
}

function mutationHeaders(csrf: string): Record<string, string> {
  return {
    "x-csrf-token": csrf,
    "x-requested-with": "fetch",
    "idempotency-key": crypto.randomUUID(),
  };
}

function editableContact(contact: EmergencyContactProjection): EditableContact {
  return {
    contactId: contact.contactId,
    expectedVersion: contact.version,
    displayLabel: contact.displayLabel,
    dialString: contact.dialString,
  };
}

function handleFailure(
  error: unknown,
  setFailure: (value: Failure | null) => void,
  setPhase: (value: Phase) => void,
) {
  const failure = error instanceof ApiFailure ? error.failure : { code: "SERVICE_UNAVAILABLE" };
  setFailure(failure);
  if (failure.code === "COORDINATION_RESOURCE_NOT_FOUND") {
    setPhase("denied");
  } else if (
    failure.code.includes("CONFLICT") ||
    failure.code === "EMERGENCY_PLAN_CONTACTS_CHANGED" ||
    failure.code === "EMERGENCY_PLAN_REVIEW_REQUIRED"
  ) {
    setPhase("conflict");
  } else if (error instanceof ApiFailure && error.uncertain) {
    setPhase("uncertain");
  } else {
    setPhase("unavailable");
  }
}
