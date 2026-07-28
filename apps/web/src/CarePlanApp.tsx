"use client";

import {
  CarePlanHistoryProjectionSchema,
  CarePlanMutationResultSchema,
  CarePlanProjectionSchema,
  IdentitySessionProjectionSchema,
  type CarePlanHistoryProjection,
  type CarePlanProjection,
  type CarePlanVersionProjection,
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
type Phase =
  "view" | "edit" | "saving" | "review" | "confirming" | "success" | "conflict" | "uncertain";

interface Failure {
  code: string;
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
  en: {
    skip: "Skip to main content",
    language: "Language",
    title: "Support plan",
    intro: "A shared coordination plan. It does not provide diagnosis or treatment advice.",
    loading: "Loading server-confirmed support plan…",
    noPlan: "No support plan has been confirmed.",
    current: "Current confirmed version",
    draft: "Working draft — not current",
    history: "Confirmed version history",
    edit: "Edit support plan",
    review: "Review unsent draft",
    makeCurrent: "Make current",
    cancel: "Cancel",
    goal: "Coordination goal",
    preference: "Coordination preference",
    responsibility: "Responsibility",
    responsible: "Responsible party",
    reviewDate: "Local review date",
    zone: "IANA review time zone",
    aggregate: "Aggregate revision",
    draftRevision: "Draft revision",
    base: "Base current version",
    version: "Confirmed version",
    change: "Change summary",
    confirmed: "Confirmed at",
    reviewStatus: "Review status",
    bounds: "Server-resolved UTC review-day bounds",
    loadMore: "Load earlier confirmed versions",
    offline:
      "Offline — already loaded information may be stale. Changes are blocked and never queued.",
    unavailableOffline: "Offline and no safe in-memory plan is available.",
    denied: "This content cannot be opened",
    unavailable: "The service is unavailable; an empty plan is not inferred.",
    conflict: "The support plan changed",
    conflictBody: "Your choices remain unsent. Load current state and review again.",
    uncertain: "The result is uncertain",
    uncertainBody: "Do not retry blindly. Check current state first.",
    check: "Check current state",
    success: "The confirmed support plan is current",
    saved: "Draft saved on the server.",
    errorSummary: "Please correct the following",
    dateRequired: "Choose a review date before review.",
    actorRequired: "No currently authorized responsibility actor is available.",
    notClinical: "Coordination only — not clinical advice.",
    staleAt: "Last server confirmation",
  },
  "vi-VN": {
    skip: "Bỏ qua đến nội dung chính",
    language: "Ngôn ngữ",
    title: "Kế hoạch hỗ trợ",
    intro: "Kế hoạch phối hợp dùng chung. Nội dung không đưa ra chẩn đoán hoặc tư vấn điều trị.",
    loading: "Đang tải kế hoạch hỗ trợ đã được máy chủ xác nhận…",
    noPlan: "Chưa có kế hoạch hỗ trợ nào được xác nhận.",
    current: "Phiên bản hiện tại đã xác nhận",
    draft: "Bản nháp đang làm — chưa phải hiện tại",
    history: "Lịch sử phiên bản đã xác nhận",
    edit: "Chỉnh sửa kế hoạch hỗ trợ",
    review: "Rà soát bản nháp chưa gửi",
    makeCurrent: "Đặt làm hiện tại",
    cancel: "Hủy",
    goal: "Mục tiêu phối hợp",
    preference: "Ưu tiên phối hợp",
    responsibility: "Trách nhiệm",
    responsible: "Người chịu trách nhiệm",
    reviewDate: "Ngày rà soát địa phương",
    zone: "Múi giờ IANA của ngày rà soát",
    aggregate: "Lần sửa tổng",
    draftRevision: "Lần sửa bản nháp",
    base: "Phiên bản hiện tại làm cơ sở",
    version: "Phiên bản đã xác nhận",
    change: "Tóm tắt thay đổi",
    confirmed: "Được xác nhận lúc",
    reviewStatus: "Trạng thái rà soát",
    bounds: "Ranh giới UTC của ngày rà soát do máy chủ giải quyết",
    loadMore: "Tải các phiên bản đã xác nhận trước đó",
    offline:
      "Đang ngoại tuyến — thông tin đã tải có thể cũ. Thay đổi bị chặn và không bao giờ xếp hàng.",
    unavailableOffline: "Đang ngoại tuyến và không có kế hoạch an toàn trong bộ nhớ.",
    denied: "Không thể mở nội dung này",
    unavailable: "Dịch vụ không khả dụng; không suy diễn thành kế hoạch trống.",
    conflict: "Kế hoạch hỗ trợ đã thay đổi",
    conflictBody: "Lựa chọn của bạn vẫn chưa gửi. Hãy tải trạng thái hiện tại và rà soát lại.",
    uncertain: "Chưa biết kết quả",
    uncertainBody: "Không thử lại mù quáng. Hãy kiểm tra trạng thái hiện tại trước.",
    check: "Kiểm tra trạng thái hiện tại",
    success: "Kế hoạch hỗ trợ đã xác nhận là hiện tại",
    saved: "Bản nháp đã được lưu trên máy chủ.",
    errorSummary: "Vui lòng sửa các mục sau",
    dateRequired: "Chọn ngày rà soát trước khi rà soát.",
    actorRequired: "Không có người chịu trách nhiệm nào đang được ủy quyền.",
    notClinical: "Chỉ để phối hợp — không phải tư vấn lâm sàng.",
    staleAt: "Xác nhận máy chủ gần nhất",
  },
} as const;
type CopyKey = keyof typeof copy.en;
const t = (locale: Locale, key: CopyKey) => copy[locale][key];

async function api<T>(url: string, schema: { parse(value: unknown): T }, init?: RequestInit) {
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
  if (!response.ok)
    throw new ApiError(
      (body as { error?: Failure })?.error ?? { code: "SERVICE_UNAVAILABLE" },
      Boolean(init?.method) && response.status >= 500,
    );
  return schema.parse((body as { data?: unknown }).data);
}

export function CarePlanApp({ householdId }: { householdId: string }) {
  const [locale, setLocale] = useState<Locale>("vi-VN");
  const [online, setOnline] = useState(true);
  const [plan, setPlan] = useState<CarePlanProjection | null>(null);
  const [history, setHistory] = useState<CarePlanHistoryProjection | null>(null);
  const [csrf, setCsrf] = useState("");
  const [phase, setPhase] = useState<Phase>("view");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState("Weekly coordination check-in");
  const [preference, setPreference] = useState("Coordination language: Vietnamese");
  const [responsibility, setResponsibility] = useState("Confirm shared schedule");
  const [actorRef, setActorRef] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [reviewZone, setReviewZone] = useState("Asia/Bangkok");
  const [errors, setErrors] = useState<string[]>([]);
  const stateHeading = useRef<HTMLHeadingElement>(null);
  const editHeading = useRef<HTMLHeadingElement>(null);

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
    if (["review", "success", "conflict", "uncertain"].includes(phase))
      requestAnimationFrame(() => stateHeading.current?.focus());
  }, [phase]);

  const load = useCallback(
    async (withHistory = true) => {
      if (!navigator.onLine) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setFailure(null);
      try {
        const [session, next] = await Promise.all([
          api("/api/v1/account/session", IdentitySessionProjectionSchema),
          api(
            `/api/v1/households/${encodeURIComponent(householdId)}/care-plan`,
            CarePlanProjectionSchema,
          ),
        ]);
        setCsrf(session.csrfToken);
        setPlan(next);
        if (!actorRef && next.eligibleResponsibilityActors[0])
          setActorRef(next.eligibleResponsibilityActors[0].actorRef);
        if (next.draft) {
          setGoal(next.draft.goals[0]?.statement ?? goal);
          setPreference(next.draft.preferences[0]?.statement ?? preference);
          setResponsibility(next.draft.responsibilities[0]?.statement ?? responsibility);
          const draftActor = next.draft.responsibilities[0]?.actor;
          setActorRef(
            draftActor?.state === "eligible"
              ? draftActor.actorRef
              : (next.eligibleResponsibilityActors[0]?.actorRef ?? ""),
          );
          setReviewDate(next.draft.reviewLocalDate ?? "");
          setReviewZone(next.draft.reviewTimeZone ?? "Asia/Bangkok");
        }
        if (withHistory)
          setHistory(
            await api(
              `/api/v1/households/${encodeURIComponent(householdId)}/care-plan/history?limit=5`,
              CarePlanHistoryProjectionSchema,
            ),
          );
      } catch (error) {
        setFailure(failureFrom(error));
      } finally {
        setLoading(false);
      }
    },
    [actorRef, goal, householdId, preference, responsibility],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function saveForReview(event: FormEvent) {
    event.preventDefault();
    const nextErrors = [
      ...(!reviewDate ? [t(locale, "dateRequired")] : []),
      ...(!actorRef ? [t(locale, "actorRequired")] : []),
    ];
    setErrors(nextErrors);
    if (nextErrors.length) {
      requestAnimationFrame(() => stateHeading.current?.focus());
      return;
    }
    if (!online) return;
    setPhase("saving");
    try {
      await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/care-plan/draft`,
        CarePlanMutationResultSchema,
        {
          method: "PUT",
          headers: { "x-csrf-token": csrf, "idempotency-key": `p3s3_${crypto.randomUUID()}` },
          body: JSON.stringify({
            operation: "save_care_plan_draft",
            expectedAggregateRevision: plan?.aggregateRevision ?? 0,
            expectedDraftRevision: plan?.draft?.draftRevision ?? null,
            baseCurrentVersion: plan?.current?.planVersion ?? null,
            goals: [{ category: "communication", statement: goal }],
            preferences: [{ category: "communication", statement: preference }],
            responsibilities: [{ category: "coordination", statement: responsibility, actorRef }],
            reviewLocalDate: reviewDate,
            reviewTimeZone: reviewZone,
          }),
        },
      );
      await load(false);
      setPhase("review");
    } catch (error) {
      mutationFailure(error, setFailure, setPhase);
    }
  }

  async function confirm() {
    if (!online || !plan?.draft) return;
    setPhase("confirming");
    try {
      await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/care-plan/current`,
        CarePlanMutationResultSchema,
        {
          method: "POST",
          headers: { "x-csrf-token": csrf, "idempotency-key": `p3s3_${crypto.randomUUID()}` },
          body: JSON.stringify({
            operation: "confirm_care_plan_version",
            expectedAggregateRevision: plan.aggregateRevision,
            expectedDraftRevision: plan.draft.draftRevision,
            baseCurrentVersion: plan.draft.baseCurrentVersion,
          }),
        },
      );
      await load(true);
      setPhase("success");
    } catch (error) {
      mutationFailure(error, setFailure, setPhase);
    }
  }

  async function loadMore() {
    if (!history?.nextCursor || !online) return;
    try {
      const next = await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/care-plan/history?limit=5&cursor=${encodeURIComponent(history.nextCursor)}`,
        CarePlanHistoryProjectionSchema,
      );
      setHistory({ ...next, versions: [...history.versions, ...next.versions] });
    } catch (error) {
      setFailure(failureFrom(error));
    }
  }

  return (
    <div className="care-plan-app">
      <a className="skip-link" href="#care-plan-main">
        {t(locale, "skip")}
      </a>
      <header className="care-plan-header">
        <a href={`/households/${encodeURIComponent(householdId)}/timeline`}>LifeBridge</a>
        <label>
          <span>{t(locale, "language")}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <main id="care-plan-main" className="care-plan-main" tabIndex={-1}>
        <h1>{t(locale, "title")}</h1>
        <p>{t(locale, "intro")}</p>
        <p className="care-plan-notice">{t(locale, "notClinical")}</p>
        {!online ? (
          <Panel
            heading={plan ? t(locale, "offline") : t(locale, "unavailableOffline")}
            tone="warning"
          >
            <p>{plan ? `${t(locale, "staleAt")}: ${plan.serverTime}` : null}</p>
          </Panel>
        ) : null}
        {loading ? <Panel heading={t(locale, "loading")} role="status" /> : null}
        {failure && phase !== "conflict" && phase !== "uncertain" ? (
          <Panel
            heading={isDenied(failure.code) ? t(locale, "denied") : t(locale, "unavailable")}
            tone="danger"
          >
            <button type="button" onClick={() => void load()}>
              {t(locale, "check")}
            </button>
          </Panel>
        ) : null}
        {errors.length ? (
          <section className="error-summary" role="alert" aria-labelledby="error-summary-title">
            <h2 id="error-summary-title" ref={stateHeading} tabIndex={-1}>
              {t(locale, "errorSummary")}
            </h2>
            <ul>
              {errors.map((error) => (
                <li key={error}>
                  <a href="#review-date">{error}</a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {phase === "conflict" ? (
          <Panel heading={t(locale, "conflict")} tone="danger" headingRef={stateHeading}>
            <p>{t(locale, "conflictBody")}</p>
            <button type="button" onClick={() => void load()}>
              {t(locale, "check")}
            </button>
          </Panel>
        ) : null}
        {phase === "uncertain" ? (
          <Panel heading={t(locale, "uncertain")} tone="warning" headingRef={stateHeading}>
            <p>{t(locale, "uncertainBody")}</p>
            <button type="button" onClick={() => void load()}>
              {t(locale, "check")}
            </button>
          </Panel>
        ) : null}
        {phase === "success" ? (
          <Panel heading={t(locale, "success")} role="status" headingRef={stateHeading} />
        ) : null}
        {plan && phase !== "edit" && phase !== "review" ? (
          <PlanSummary plan={plan} locale={locale} />
        ) : null}
        {plan && phase === "view" ? (
          <button
            type="button"
            disabled={!online}
            onClick={() => {
              setPhase("edit");
              requestAnimationFrame(() => editHeading.current?.focus());
            }}
          >
            {t(locale, "edit")}
          </button>
        ) : null}
        {plan && phase === "edit" ? (
          <form className="care-plan-form" onSubmit={saveForReview} noValidate>
            <h2 ref={editHeading} tabIndex={-1}>
              {t(locale, "edit")}
            </h2>
            <label>
              <span>{t(locale, "goal")}</span>
              <select value={goal} onChange={(e) => setGoal(e.target.value)}>
                <option>Weekly coordination check-in</option>
                <option>Shared schedule ready</option>
              </select>
            </label>
            <label>
              <span>{t(locale, "preference")}</span>
              <select value={preference} onChange={(e) => setPreference(e.target.value)}>
                <option>Coordination language: Vietnamese</option>
                <option>Coordination language: English</option>
              </select>
            </label>
            <label>
              <span>{t(locale, "responsibility")}</span>
              <select value={responsibility} onChange={(e) => setResponsibility(e.target.value)}>
                <option>Confirm shared schedule</option>
                <option>Prepare transport details</option>
              </select>
            </label>
            <label>
              <span>{t(locale, "responsible")}</span>
              <select value={actorRef} onChange={(e) => setActorRef(e.target.value)}>
                {plan.eligibleResponsibilityActors.map((actor) => (
                  <option key={actor.actorRef} value={actor.actorRef}>
                    {actor.displayKey === "coordination.actor.you" ? "Your account" : "Participant"}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="review-date">
              <span>{t(locale, "reviewDate")}</span>
              <input
                id="review-date"
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
              />
            </label>
            <label>
              <span>{t(locale, "zone")}</span>
              <select value={reviewZone} onChange={(e) => setReviewZone(e.target.value)}>
                <option>Asia/Bangkok</option>
                <option>America/New_York</option>
              </select>
            </label>
            <div className="care-plan-actions">
              <button type="submit" disabled={!online}>
                {t(locale, "review")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setPhase("view");
                  setErrors([]);
                }}
              >
                {t(locale, "cancel")}
              </button>
            </div>
          </form>
        ) : null}
        {plan?.draft && phase === "review" ? (
          <section className="review-panel">
            <h2 ref={stateHeading} tabIndex={-1}>
              {t(locale, "review")}
            </h2>
            <p>{t(locale, "saved")}</p>
            <PlanDraft plan={plan} locale={locale} />
            <div className="care-plan-actions">
              <button type="button" disabled={!online} onClick={() => void confirm()}>
                {t(locale, "makeCurrent")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setPhase("edit");
                  requestAnimationFrame(() => editHeading.current?.focus());
                }}
              >
                {t(locale, "cancel")}
              </button>
            </div>
          </section>
        ) : null}
        {history?.versions.length ? (
          <section>
            <h2>{t(locale, "history")}</h2>
            <ol className="care-plan-history">
              {history.versions.map((version) => (
                <li key={version.planVersion}>
                  <VersionFacts version={version} locale={locale} />
                </li>
              ))}
            </ol>
            {history.nextCursor ? (
              <button type="button" disabled={!online} onClick={() => void loadMore()}>
                {t(locale, "loadMore")}
              </button>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}

function PlanSummary({ plan, locale }: { plan: CarePlanProjection; locale: Locale }) {
  return (
    <>
      {plan.current ? (
        <section className="care-plan-card">
          <h2>{t(locale, "current")}</h2>
          <VersionFacts version={plan.current} locale={locale} />
        </section>
      ) : (
        <Panel heading={t(locale, "noPlan")} />
      )}
      {plan.draft ? (
        <section className="care-plan-card warning">
          <h2>{t(locale, "draft")}</h2>
          <PlanDraft plan={plan} locale={locale} />
        </section>
      ) : null}
    </>
  );
}
function PlanDraft({ plan, locale }: { plan: CarePlanProjection; locale: Locale }) {
  const draft = plan.draft!;
  return (
    <dl className="care-plan-facts">
      <Fact label={t(locale, "aggregate")} value={String(plan.aggregateRevision)} />
      <Fact label={t(locale, "draftRevision")} value={String(draft.draftRevision)} />
      <Fact
        label={t(locale, "base")}
        value={draft.baseCurrentVersion ? String(draft.baseCurrentVersion) : "—"}
      />
      <Fact label={t(locale, "goal")} value={draft.goals.map((x) => x.statement).join("; ")} />
      <Fact
        label={t(locale, "preference")}
        value={draft.preferences.map((x) => x.statement).join("; ")}
      />
      <Fact
        label={t(locale, "responsibility")}
        value={draft.responsibilities.map((x) => x.statement).join("; ")}
      />
      <Fact
        label={t(locale, "responsible")}
        value={draft.responsibilities
          .map((x) => (x.actor.state === "eligible" ? x.actor.actorRef : "authorization_changed"))
          .join("; ")}
      />
      <Fact
        label={t(locale, "reviewDate")}
        value={`${draft.reviewLocalDate ?? "—"} · ${draft.reviewTimeZone ?? "—"}`}
      />
      <Fact
        label={t(locale, "bounds")}
        value={`${draft.reviewDayStartUtc ?? "—"} — ${draft.reviewDayEndUtc ?? "—"}`}
      />
    </dl>
  );
}
function VersionFacts({ version, locale }: { version: CarePlanVersionProjection; locale: Locale }) {
  return (
    <article>
      <h3>
        {t(locale, "version")} {version.planVersion}
      </h3>
      <dl className="care-plan-facts">
        <Fact label={t(locale, "change")} value={version.changeGroups.join(", ")} />
        <Fact label={t(locale, "goal")} value={version.goals.map((x) => x.statement).join("; ")} />
        <Fact
          label={t(locale, "preference")}
          value={version.preferences.map((x) => x.statement).join("; ")}
        />
        <Fact
          label={t(locale, "responsibility")}
          value={version.responsibilities.map((x) => x.statement).join("; ")}
        />
        <Fact
          label={t(locale, "responsible")}
          value={version.responsibilities
            .map((x) => (x.actor.state === "eligible" ? x.actor.actorRef : "authorization_changed"))
            .join("; ")}
        />
        <Fact
          label={t(locale, "reviewDate")}
          value={`${version.review.reviewLocalDate} · ${version.review.reviewTimeZone}`}
        />
        <Fact
          label={t(locale, "bounds")}
          value={`${version.review.reviewDayStartUtc} — ${version.review.reviewDayEndUtc}`}
        />
        <Fact label={t(locale, "reviewStatus")} value={version.review.reviewState} />
        <Fact label={t(locale, "confirmed")} value={version.confirmedAt} />
      </dl>
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
function Panel({
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
    <section className={`care-plan-card ${tone}`} role={role}>
      <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
        {heading}
      </h2>
      {children}
    </section>
  );
}
function failureFrom(error: unknown): Failure {
  return error instanceof ApiError ? error.failure : { code: "SERVICE_UNAVAILABLE" };
}
function isDenied(code: string) {
  return [
    "CONSENT_RESOURCE_NOT_FOUND",
    "COORDINATION_RESOURCE_NOT_FOUND",
    "SESSION_REQUIRED",
  ].includes(code);
}
function mutationFailure(
  error: unknown,
  setFailure: (failure: Failure) => void,
  setPhase: (phase: Phase) => void,
) {
  const failure = failureFrom(error);
  setFailure(failure);
  setPhase(
    error instanceof ApiError && error.uncertain
      ? "uncertain"
      : failure.code === "CARE_PLAN_VERSION_CONFLICT" || failure.code === "CARE_PLAN_STATE_CONFLICT"
        ? "conflict"
        : "edit",
  );
}
