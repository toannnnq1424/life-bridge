"use client";

import {
  DashboardProjectionSchema,
  MemberSchema,
  NotificationSchema,
  TaskProjectionSchema,
  type DashboardProjection,
  type Member,
  type Notification,
  type TaskProjection,
} from "@lifebridge/contracts";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { type Locale, type MessageKey, translate } from "./i18n";

type View = "dashboard" | "tasks" | "detail" | "notifications";

interface CareAppProps {
  view: View;
  householdId: string;
  taskId?: string;
}

interface ApiFailure {
  code: string;
  fieldErrors?: Record<string, string>;
  currentTask?: TaskProjection;
}

class ClientApiError extends Error {
  public constructor(public readonly failure: ApiFailure) {
    super(failure.code);
  }
}

function idempotencyKey(): string {
  return `idem_${crypto.randomUUID()}`;
}

async function api<T>(
  url: string,
  actorId: string,
  schema: { parse: (value: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-fixture-actor-id": actorId,
      "x-correlation-id": `web_${crypto.randomUUID().replaceAll("-", "")}`,
      ...init?.headers,
    },
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = (body as { error?: ApiFailure }).error;
    throw new ClientApiError(error ?? { code: "SERVICE_UNAVAILABLE" });
  }
  return schema.parse((body as { data: unknown }).data);
}

function futureBangkokDateTime(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function bangkokLocalToIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}

export function CareApp({ view, householdId, taskId }: CareAppProps) {
  const [locale, setLocale] = useState<Locale>("vi-VN");
  const [actor, setActor] = useState("member_lan");
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskProjection[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [task, setTask] = useState<TaskProjection | null>(null);
  const [dashboard, setDashboard] = useState<DashboardProjection | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [status, setStatus] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);

  useEffect(() => {
    const storedLocale = localStorage.getItem("lifebridge.locale");
    const storedActor = localStorage.getItem("lifebridge.actor");
    if (storedLocale === "vi-VN" || storedLocale === "en") {
      setLocale(storedLocale);
    }
    if (storedActor === "member_lan" || storedActor === "member_minh") {
      setActor(storedActor);
    }
    setOnline(navigator.onLine);
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("lifebridge.locale", locale);
  }, [locale]);

  useEffect(() => {
    localStorage.setItem("lifebridge.actor", actor);
  }, [actor]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [view]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (view === "dashboard") {
        setDashboard(
          await api(
            `/api/v1/households/${encodeURIComponent(householdId)}/dashboard`,
            actor,
            DashboardProjectionSchema,
          ),
        );
      }
      if (view === "tasks") {
        const [taskData, memberData] = await Promise.all([
          api(`/api/v1/households/${encodeURIComponent(householdId)}/tasks`, actor, {
            parse: (value) => TaskProjectionSchema.array().parse(value),
          }),
          api(`/api/v1/households/${encodeURIComponent(householdId)}/members`, actor, {
            parse: (value) => MemberSchema.array().parse(value),
          }),
        ]);
        setTasks(taskData);
        setMembers(memberData);
      }
      if (view === "detail" && taskId) {
        setTask(
          await api(`/api/v1/tasks/${encodeURIComponent(taskId)}`, actor, TaskProjectionSchema),
        );
      }
      if (view === "notifications") {
        setNotifications(
          await api("/api/v1/notifications", actor, {
            parse: (value) => NotificationSchema.array().parse(value),
          }),
        );
      }
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.failure : { code: "SERVICE_UNAVAILABLE" });
    } finally {
      setLoading(false);
    }
  }, [actor, householdId, taskId, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const title =
    view === "dashboard"
      ? t("dashboard")
      : view === "notifications"
        ? t("notifications")
        : view === "detail"
          ? t("taskDetails")
          : t("tasks");

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t("skip")}
      </a>
      <header className="app-header">
        <div>
          <a className="brand" href={`/households/${householdId}`}>
            {t("brand")}
          </a>
          <p className="fixture-note">{t("fixture")}</p>
        </div>
        <div className="header-controls">
          <label>
            <span>{t("actor")}</span>
            <select value={actor} onChange={(event) => setActor(event.target.value)}>
              <option value="member_lan">
                {t("lan")} — {t("caregiver")}
              </option>
              <option value="member_minh">
                {t("minh")} — {t("member")}
              </option>
            </select>
          </label>
          <label>
            <span>{t("language")}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              <option value="vi-VN">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </header>
      <nav aria-label={t("brand")} className="primary-nav">
        <a
          aria-current={view === "dashboard" ? "page" : undefined}
          href={`/households/${householdId}`}
        >
          {t("dashboard")}
        </a>
        <a
          aria-current={view === "tasks" || view === "detail" ? "page" : undefined}
          href={`/households/${householdId}/tasks`}
        >
          {t("tasks")}
        </a>
        <a aria-current={view === "notifications" ? "page" : undefined} href="/notifications">
          {t("notifications")}
        </a>
      </nav>
      <main id="main-content" className="page-shell" tabIndex={-1}>
        <h1 ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
        <p className="intro">
          {view === "dashboard"
            ? t("dashboardIntro")
            : view === "notifications"
              ? t("notificationsIntro")
              : t("taskBoardIntro")}
        </p>
        {!online ? (
          <div className="status-banner warning" role="status">
            <span aria-hidden="true">⚠</span> {t("offline")}
          </div>
        ) : null}
        <div className="sr-status" aria-live="polite">
          {status}
        </div>
        {loading ? (
          <div className="state-panel" role="status">
            {t("loading")}
          </div>
        ) : error ? (
          <ErrorPanel error={error} t={t} onRetry={() => void load()} />
        ) : view === "dashboard" && dashboard ? (
          <Dashboard
            dashboard={dashboard}
            actor={actor}
            locale={locale}
            t={t}
            onComplete={async (selected) => {
              await complete(selected);
            }}
            online={online}
          />
        ) : view === "tasks" ? (
          <>
            {members.find((member) => member.memberId === actor)?.role === "caregiver" ? (
              <TaskForm
                householdId={householdId}
                actor={actor}
                members={members}
                online={online}
                t={t}
                onCreated={(created) => {
                  setTasks((current) => [created, ...current]);
                  setStatus(t("createdSuccess"));
                }}
              />
            ) : null}
            <TaskList
              tasks={tasks}
              actor={actor}
              locale={locale}
              t={t}
              online={online}
              onComplete={complete}
            />
          </>
        ) : view === "detail" && task ? (
          <TaskDetail
            task={task}
            actor={actor}
            locale={locale}
            t={t}
            online={online}
            onComplete={complete}
          />
        ) : view === "notifications" ? (
          <NotificationList notifications={notifications} locale={locale} t={t} />
        ) : null}
      </main>
    </>
  );

  async function complete(selected: TaskProjection) {
    setError(null);
    try {
      const completed = await api(
        `/api/v1/tasks/${encodeURIComponent(selected.taskId)}`,
        actor,
        TaskProjectionSchema,
        {
          method: "PATCH",
          headers: { "idempotency-key": idempotencyKey() },
          body: JSON.stringify({ operation: "complete", expectedVersion: selected.version }),
        },
      );
      setStatus(t("completedSuccess"));
      setTasks((current) =>
        current.map((candidate) => (candidate.taskId === completed.taskId ? completed : candidate)),
      );
      setTask((current) => (current?.taskId === completed.taskId ? completed : current));
      setDashboard((current) =>
        current
          ? {
              ...current,
              openCount: Math.max(0, current.openCount - 1),
              completedCount: current.completedCount + 1,
              nextTasks: current.nextTasks.map((candidate) =>
                candidate.taskId === completed.taskId ? completed : candidate,
              ),
            }
          : current,
      );
      window.setTimeout(() => void load(), 700);
    } catch (caught) {
      const failure =
        caught instanceof ClientApiError ? caught.failure : { code: "SERVICE_UNAVAILABLE" };
      setError(failure);
      if (failure.currentTask) {
        setTask(failure.currentTask);
      }
    }
  }
}

function Dashboard({
  dashboard,
  actor,
  locale,
  t,
  onComplete,
  online,
}: {
  dashboard: DashboardProjection;
  actor: string;
  locale: Locale;
  t: (key: MessageKey) => string;
  onComplete: (task: TaskProjection) => Promise<void>;
  online: boolean;
}) {
  return (
    <>
      <section aria-labelledby="counts-heading">
        <h2 id="counts-heading">{t("counts")}</h2>
        <dl className="count-grid">
          <div>
            <dt>{t("openCount")}</dt>
            <dd>{dashboard.openCount}</dd>
          </div>
          <div>
            <dt>{t("completedCount")}</dt>
            <dd>{dashboard.completedCount}</dd>
          </div>
        </dl>
      </section>
      {dashboard.notificationDependency === "degraded" ? (
        <div className="status-banner danger" role="alert">
          <span aria-hidden="true">!</span> {t("degraded")}
        </div>
      ) : null}
      <TaskList
        tasks={dashboard.nextTasks}
        actor={actor}
        locale={locale}
        t={t}
        onComplete={onComplete}
        online={online}
      />
    </>
  );
}

function TaskForm({
  householdId,
  actor,
  members,
  online,
  t,
  onCreated,
}: {
  householdId: string;
  actor: string;
  members: Member[];
  online: boolean;
  t: (key: MessageKey) => string;
  onCreated: (task: TaskProjection) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("member_minh");
  const [dueLocal, setDueLocal] = useState(futureBangkokDateTime);
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const hasInput = title.length > 0 || description.length > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const localErrors: Record<string, string> = {};
    if (!title.trim()) localErrors.title = "required";
    if (!dueLocal || Number.isNaN(new Date(dueLocal).getTime())) localErrors.dueAt = "invalid";
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setSaving(true);
    setFieldErrors({});
    try {
      const created = await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/tasks`,
        actor,
        TaskProjectionSchema,
        {
          method: "POST",
          headers: { "idempotency-key": idempotencyKey() },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            assigneeId,
            careRecipientId: "person_an",
            dueAt: bangkokLocalToIso(dueLocal),
            dueTimeZone: "Asia/Bangkok",
            priority,
          }),
        },
      );
      onCreated(created);
      setTitle("");
      setDescription("");
    } catch (caught) {
      const failure =
        caught instanceof ClientApiError ? caught.failure : { code: "SERVICE_UNAVAILABLE" };
      setFieldErrors(failure.fieldErrors ?? { form: failure.code });
      requestAnimationFrame(() => summaryRef.current?.focus());
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="form-card" aria-labelledby="create-heading">
      <h2 id="create-heading">{t("createHeading")}</h2>
      {Object.keys(fieldErrors).length > 0 ? (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <h3>{t("validationSummary")}</h3>
          <ul>
            {fieldErrors.title ? (
              <li>
                <a href="#task-title">
                  {t("title")}: {t("required")}
                </a>
              </li>
            ) : null}
            {fieldErrors.dueAt ? (
              <li>
                <a href="#task-due">
                  {t("due")}: {t("invalidDue")}
                </a>
              </li>
            ) : null}
            {fieldErrors.form ? <li>{t("error")}</li> : null}
          </ul>
        </div>
      ) : null}
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="task-title">{t("title")}</label>
          <input
            id="task-title"
            value={title}
            maxLength={120}
            required
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? "task-title-error" : undefined}
            onChange={(event) => setTitle(event.target.value)}
          />
          {fieldErrors.title ? (
            <span className="field-error" id="task-title-error">
              {t("required")}
            </span>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="task-description">{t("description")}</label>
          <textarea
            id="task-description"
            value={description}
            maxLength={500}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="task-assignee">{t("assignee")}</label>
            <select
              id="task-assignee"
              value={assigneeId}
              onChange={(event) => setAssigneeId(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.memberId} value={member.memberId}>
                  {member.memberId === "member_lan" ? t("lan") : t("minh")}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="task-priority">{t("priority")}</label>
            <select
              id="task-priority"
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as "normal" | "important" | "urgent")
              }
            >
              <option value="normal">{t("normal")}</option>
              <option value="important">{t("important")}</option>
              <option value="urgent">{t("urgent")}</option>
            </select>
          </div>
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="task-due">{t("due")}</label>
            <input
              id="task-due"
              type="datetime-local"
              value={dueLocal}
              required
              aria-invalid={Boolean(fieldErrors.dueAt)}
              onChange={(event) => setDueLocal(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="task-time-zone">{t("timeZone")}</label>
            <input id="task-time-zone" value="Asia/Bangkok" readOnly />
          </div>
        </div>
        {hasInput ? <p className="unsaved-note">{t("notSaved")}</p> : null}
        <div className="sticky-actions">
          <button type="submit" disabled={!online || saving}>
            {saving ? t("creating") : t("create")}
          </button>
        </div>
      </form>
    </section>
  );
}

function TaskList({
  tasks,
  actor,
  locale,
  t,
  onComplete,
  online,
}: {
  tasks: TaskProjection[];
  actor: string;
  locale: Locale;
  t: (key: MessageKey) => string;
  onComplete: (task: TaskProjection) => Promise<void>;
  online: boolean;
}) {
  return (
    <section aria-labelledby="task-list-heading">
      <h2 id="task-list-heading">{t("tasks")}</h2>
      {tasks.length === 0 ? (
        <div className="state-panel">
          <h3>{t("emptyTasks")}</h3>
        </div>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.taskId} className="task-card">
              <div className="task-card-header">
                <h3>{task.title}</h3>
                <span className={`badge priority-${task.priority}`}>
                  <span aria-hidden="true">{task.priority === "urgent" ? "!" : "•"}</span>{" "}
                  {t(task.priority)}
                </span>
              </div>
              {task.description ? <p>{task.description}</p> : null}
              <dl className="task-meta">
                <div>
                  <dt>{t("owner")}</dt>
                  <dd>{task.assigneeId === "member_lan" ? t("lan") : t("minh")}</dd>
                </div>
                <div>
                  <dt>{t("due")}</dt>
                  <dd>{formatDue(task, locale)}</dd>
                </div>
                <div>
                  <dt>{t("confirmed")}</dt>
                  <dd>
                    <span className="status-with-icon">
                      <span aria-hidden="true">{task.status === "completed" ? "✓" : "○"}</span>{" "}
                      {t(task.status)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>{t("version")}</dt>
                  <dd>{task.version}</dd>
                </div>
              </dl>
              {task.status === "completed" ? (
                <p className={`delivery delivery-${task.notificationDelivery}`}>
                  <span aria-hidden="true">
                    {task.notificationDelivery === "delivered" ? "✓" : "↻"}
                  </span>{" "}
                  {t(`delivery_${task.notificationDelivery}` as MessageKey)}
                </p>
              ) : null}
              <div className="task-actions">
                <a href={`/tasks/${task.taskId}`}>{t("taskDetails")}</a>
                {task.status === "open" && task.assigneeId === actor ? (
                  <button type="button" disabled={!online} onClick={() => void onComplete(task)}>
                    {t("complete")}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskDetail({
  task,
  actor,
  locale,
  t,
  online,
  onComplete,
}: {
  task: TaskProjection;
  actor: string;
  locale: Locale;
  t: (key: MessageKey) => string;
  online: boolean;
  onComplete: (task: TaskProjection) => Promise<void>;
}) {
  return (
    <article className="detail-card">
      <h2>{task.title}</h2>
      {task.description ? <p>{task.description}</p> : null}
      <dl className="task-meta">
        <div>
          <dt>{t("owner")}</dt>
          <dd>{task.assigneeId === "member_lan" ? t("lan") : t("minh")}</dd>
        </div>
        <div>
          <dt>{t("creator")}</dt>
          <dd>{task.createdBy === "member_lan" ? t("lan") : t("minh")}</dd>
        </div>
        <div>
          <dt>{t("due")}</dt>
          <dd>{formatDue(task, locale)}</dd>
        </div>
        <div>
          <dt>{t("version")}</dt>
          <dd>{task.version}</dd>
        </div>
      </dl>
      <p className="status-with-icon">
        <span aria-hidden="true">{task.status === "completed" ? "✓" : "○"}</span> {t(task.status)}
      </p>
      {task.status === "completed" ? (
        <p className={`delivery delivery-${task.notificationDelivery}`}>
          {t(`delivery_${task.notificationDelivery}` as MessageKey)}
        </p>
      ) : null}
      {task.status === "open" && task.assigneeId === actor ? (
        <button type="button" disabled={!online} onClick={() => void onComplete(task)}>
          {t("complete")}
        </button>
      ) : null}
    </article>
  );
}

function NotificationList({
  notifications,
  locale,
  t,
}: {
  notifications: Notification[];
  locale: Locale;
  t: (key: MessageKey) => string;
}) {
  if (notifications.length === 0) {
    return (
      <div className="state-panel">
        <h2>{t("emptyNotifications")}</h2>
      </div>
    );
  }
  return (
    <ul className="notification-list">
      {notifications.map((notification) => (
        <li key={notification.notificationId}>
          <p>
            <span aria-hidden="true">✓</span> {t("notificationCompleted")}
          </p>
          <time dateTime={notification.createdAt}>
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: "Asia/Bangkok",
            }).format(new Date(notification.createdAt))}{" "}
            (Asia/Bangkok)
          </time>
          <a href={`/tasks/${notification.sourceTaskId}`}>{t("sourceTask")}</a>
        </li>
      ))}
    </ul>
  );
}

function ErrorPanel({
  error,
  t,
  onRetry,
}: {
  error: ApiFailure;
  t: (key: MessageKey) => string;
  onRetry: () => void;
}) {
  const conflict = error.code === "TASK_VERSION_CONFLICT";
  return (
    <div className="state-panel danger" role="alert">
      <h2>{conflict ? t("conflict") : t("error")}</h2>
      <button type="button" onClick={onRetry}>
        {conflict ? t("loadCurrent") : t("retry")}
      </button>
    </div>
  );
}

function formatDue(task: TaskProjection, locale: Locale): string {
  return `${new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: task.dueTimeZone,
  }).format(new Date(task.dueAt))} (${task.dueTimeZone})`;
}
