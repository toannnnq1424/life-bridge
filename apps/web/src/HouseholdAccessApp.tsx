"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";

import { householdCopy, type HouseholdCopy, type HouseholdLocale } from "./household-i18n";

type HouseholdScreen = "create" | "invitations" | "decision" | "context";
type InvitationState = "pending" | "accepted" | "declined" | "expired" | "revoked";

interface SessionProjection {
  csrfToken: string;
  preferences: { locale: HouseholdLocale };
}

interface HouseholdProjection {
  householdId: string;
  displayLabel: string;
  role: "organizer" | "caregiver" | "member";
  capabilities: string[];
  version: number;
}

interface InvitationProjection {
  invitationId: string;
  householdId: string;
  role: "caregiver" | "member";
  state: InvitationState;
  expiresAt: string;
  version: number;
}

interface ContextProjection {
  recipientContextId: string;
  householdId: string;
  displayLabel: string;
  relationshipLabel: string;
  version: number;
}

interface Envelope {
  data?: unknown;
  error?: { code?: string };
}

class ApiFailure extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

export function HouseholdAccessApp({
  initialScreen,
  householdId,
}: {
  initialScreen: HouseholdScreen;
  householdId?: string;
}) {
  const [locale, setLocale] = useState<HouseholdLocale>("vi-VN");
  const [session, setSession] = useState<SessionProjection | null>(null);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [household, setHousehold] = useState<HouseholdProjection | null>(null);
  const [invitation, setInvitation] = useState<InvitationProjection | null>(null);
  const [context, setContext] = useState<ContextProjection | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);
  const createKey = useRef("");
  const inviteKey = useRef("");
  const t = householdCopy[locale];

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

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${titleFor(initialScreen, t)} — LifeBridge`;
    headingRef.current?.focus();
  }, [initialScreen, locale, t]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/v1/account/session", {
          credentials: "same-origin",
          headers: { "x-correlation-id": correlationId() },
        });
        const envelope = (await response.json()) as Envelope;
        if (!response.ok) throw new ApiFailure(response.status, envelope.error?.code ?? "FAILED");
        if (!active) return;
        const projection = envelope.data as SessionProjection;
        setSession(projection);
        setLocale(projection.preferences.locale);
      } catch {
        if (active) setError(t.signInRequired);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [t.signInRequired]);

  useEffect(() => {
    if (
      !session ||
      !householdId ||
      (initialScreen !== "context" && initialScreen !== "invitations")
    ) {
      return;
    }
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const householdResponse = await requestJson(
          `/api/v1/households/${encodeURIComponent(householdId)}`,
          "GET",
          session,
        );
        if (!active) return;
        setHousehold(householdResponse.data as HouseholdProjection);
        if (initialScreen === "context") {
          const contextResponse = await requestJson(
            `/api/v1/households/${encodeURIComponent(householdId)}/recipient-context`,
            "GET",
            session,
          );
          if (active) setContext((contextResponse.data as ContextProjection | null) ?? null);
        }
      } catch (caught) {
        if (active) setError(messageFor(caught, t));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [householdId, initialScreen, session, t]);

  async function mutate(
    path: string,
    method: "POST" | "PUT",
    body: unknown,
    idempotencyKey?: string,
  ): Promise<Envelope> {
    if (!online) {
      setError(t.offline);
      throw new ApiFailure(0, "OFFLINE_BLOCKED");
    }
    if (!session) {
      setError(t.signInRequired);
      throw new ApiFailure(401, "SESSION_REQUIRED");
    }
    setBusy(true);
    setError("");
    try {
      return await requestJson(path, method, session, body, idempotencyKey);
    } catch (caught) {
      setError(messageFor(caught, t));
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="household-access-app">
      <a className="skip-link" href="#household-main">
        {t.skip}
      </a>
      <header className="account-header">
        <a className="brand" href="/">
          LifeBridge
        </a>
        <label>
          <span>{t.language}</span>
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as HouseholdLocale)}
          >
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <main id="household-main" className="account-shell" tabIndex={-1} aria-busy={busy}>
        <h1 ref={headingRef} tabIndex={-1}>
          {titleFor(initialScreen, t)}
        </h1>
        {!online ? (
          <div className="status-banner warning" role="status">
            {t.offline}
          </div>
        ) : null}
        {error ? (
          <div ref={errorRef} className="error-summary" role="alert" tabIndex={-1}>
            <strong>{t.errorTitle}</strong>
            <p>{error}</p>
            {error === t.signInRequired ? (
              <a className="secondary-action" href="/login">
                {t.signIn}
              </a>
            ) : null}
          </div>
        ) : null}
        <div className="sr-status" role="status" aria-live="polite">
          {status}
        </div>
        {loading ? <div className="state-panel">{t.loading}</div> : null}
        {!loading && session && initialScreen === "create" ? (
          <CreateHouseholdPanel
            t={t}
            busy={busy}
            household={household}
            onSubmit={async (displayLabel) => {
              createKey.current ||= idempotencyKey();
              const envelope = await mutate(
                "/api/v1/households",
                "POST",
                { displayLabel },
                createKey.current,
              );
              const created = envelope.data as HouseholdProjection;
              setHousehold(created);
              createKey.current = "";
              setStatus(t.created);
            }}
          />
        ) : null}
        {!loading && session && initialScreen === "invitations" && householdId ? (
          <InvitationManager
            t={t}
            busy={busy}
            invitation={invitation}
            onCreate={async (inviteeLoginName, role) => {
              inviteKey.current ||= idempotencyKey();
              const envelope = await mutate(
                `/api/v1/households/${encodeURIComponent(householdId)}/invitations`,
                "POST",
                { inviteeLoginName, role },
                inviteKey.current,
              );
              setInvitation(toInvitationProjection(envelope.data));
              inviteKey.current = "";
              setStatus(t.invitationPending);
            }}
            onTransition={async (action) => {
              if (!invitation) return;
              const envelope = await mutate(
                `/api/v1/households/${encodeURIComponent(householdId)}/invitations/${encodeURIComponent(invitation.invitationId)}/${action}`,
                "POST",
                { expectedVersion: invitation.version },
              );
              setInvitation(toInvitationProjection(envelope.data));
              setStatus(action === "resend" ? t.resent : t.revokedStatus);
            }}
          />
        ) : null}
        {!loading && session && initialScreen === "decision" ? (
          <InvitationDecision
            t={t}
            busy={busy}
            tokenRef={tokenRef}
            invitation={invitation}
            onDecision={async (decision, invitationToken) => {
              if (tokenRef.current) tokenRef.current.value = "";
              const envelope = await mutate(`/api/v1/invitations/${decision}`, "POST", {
                invitationToken,
              });
              const decided = toInvitationProjection(envelope.data);
              setInvitation(decided);
              setStatus(decided.state === "accepted" ? t.decisionAccepted : t.decisionDeclined);
            }}
          />
        ) : null}
        {!loading && session && initialScreen === "context" && householdId ? (
          <ContextPanel
            t={t}
            busy={busy}
            household={household}
            context={context}
            onSave={async (displayLabel, relationshipLabel) => {
              const envelope = await mutate(
                `/api/v1/households/${encodeURIComponent(householdId)}/recipient-context`,
                "PUT",
                {
                  displayLabel,
                  relationshipLabel,
                  expectedVersion: context?.version ?? 0,
                },
              );
              setContext(envelope.data as ContextProjection);
              setStatus(t.contextSaved);
            }}
            onReload={async () => {
              try {
                const envelope = await requestJson(
                  `/api/v1/households/${encodeURIComponent(householdId)}/recipient-context`,
                  "GET",
                  session,
                );
                setContext((envelope.data as ContextProjection | null) ?? null);
                setError("");
              } catch (caught) {
                setError(messageFor(caught, t));
              }
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function CreateHouseholdPanel({
  t,
  busy,
  household,
  onSubmit,
}: {
  t: HouseholdCopy;
  busy: boolean;
  household: HouseholdProjection | null;
  onSubmit: (displayLabel: string) => Promise<void>;
}) {
  const [length, setLength] = useState(0);
  if (household) {
    return (
      <section className="account-card confirmed-panel">
        <p role="status">{t.created}</p>
        <strong>{household.displayLabel}</strong>
        <div className="action-row">
          <a className="primary-action" href={`/households/${household.householdId}/invitations`}>
            {t.manageInvitations}
          </a>
          <a
            className="secondary-action"
            href={`/households/${household.householdId}/recipient-context`}
          >
            {t.setContext}
          </a>
        </div>
      </section>
    );
  }
  return (
    <form className="account-card" onSubmit={(event) => void submitLabel(event, onSubmit)}>
      <p>{t.createIntro}</p>
      <label>
        <span>
          {t.householdLabel} ({t.required})
        </span>
        <input
          name="displayLabel"
          required
          maxLength={80}
          aria-describedby="household-label-count"
          onInput={(event) => setLength(event.currentTarget.value.length)}
        />
      </label>
      <small id="household-label-count">
        {length}/80 {t.characters}
      </small>
      <button type="submit" disabled={busy} aria-busy={busy}>
        {busy ? t.busy : t.create}
      </button>
    </form>
  );
}

function InvitationManager({
  t,
  busy,
  invitation,
  onCreate,
  onTransition,
}: {
  t: HouseholdCopy;
  busy: boolean;
  invitation: InvitationProjection | null;
  onCreate: (loginName: string, role: "caregiver" | "member") => Promise<void>;
  onTransition: (action: "resend" | "revoke") => Promise<void>;
}) {
  if (invitation) {
    return (
      <section className="account-card">
        <h2>{t.invitationState}</h2>
        <p className="badge status-with-icon">● {t[invitation.state]}</p>
        <p>{t.invitationPending}</p>
        {invitation.state === "pending" ? (
          <div className="action-row">
            <button type="button" disabled={busy} onClick={() => void onTransition("resend")}>
              {t.resend}
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={busy}
              onClick={() => void onTransition("revoke")}
            >
              {t.revoke}
            </button>
          </div>
        ) : null}
      </section>
    );
  }
  return (
    <form className="account-card" onSubmit={(event) => void submitInvitation(event, onCreate)}>
      <p>{t.invitationIntro}</p>
      <label>
        {t.inviteeLogin} ({t.required})
        <input name="inviteeLoginName" autoComplete="off" required minLength={3} maxLength={64} />
      </label>
      <fieldset>
        <legend>{t.role}</legend>
        <label>
          <input type="radio" name="role" value="caregiver" required />
          <span>
            <strong>{t.caregiver}</strong>
            <br />
            {t.caregiverHelp}
          </span>
        </label>
        <label>
          <input type="radio" name="role" value="member" required defaultChecked />
          <span>
            <strong>{t.member}</strong>
            <br />
            {t.memberHelp}
          </span>
        </label>
      </fieldset>
      <button type="submit" disabled={busy} aria-busy={busy}>
        {busy ? t.busy : t.sendInvitation}
      </button>
    </form>
  );
}

function InvitationDecision({
  t,
  busy,
  tokenRef,
  invitation,
  onDecision,
}: {
  t: HouseholdCopy;
  busy: boolean;
  tokenRef: RefObject<HTMLInputElement | null>;
  invitation: InvitationProjection | null;
  onDecision: (decision: "accept" | "decline", token: string) => Promise<void>;
}) {
  if (invitation) {
    return (
      <section className="account-card confirmed-panel">
        <h2>{t.invitationState}</h2>
        <p className="status-with-icon">● {t[invitation.state]}</p>
      </section>
    );
  }
  return (
    <form
      className="account-card"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const token = String(data.get("invitationToken") ?? "");
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const decision = submitter?.value as "accept" | "decline";
        void onDecision(decision, token);
      }}
    >
      <p>{t.decisionIntro}</p>
      <label>
        {t.invitationToken} ({t.required})
        <input
          ref={tokenRef}
          name="invitationToken"
          type="password"
          autoComplete="off"
          required
          minLength={43}
          maxLength={43}
        />
      </label>
      <div className="action-row">
        <button type="submit" name="decision" value="accept" disabled={busy}>
          {t.accept}
        </button>
        <button
          type="submit"
          name="decision"
          value="decline"
          className="secondary-action"
          disabled={busy}
        >
          {t.decline}
        </button>
      </div>
    </form>
  );
}

function ContextPanel({
  t,
  busy,
  household,
  context,
  onSave,
  onReload,
}: {
  t: HouseholdCopy;
  busy: boolean;
  household: HouseholdProjection | null;
  context: ContextProjection | null;
  onSave: (displayLabel: string, relationshipLabel: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const canManage = household?.capabilities.includes("recipient_context.manage") ?? false;
  return (
    <>
      <section className="status-banner">
        <p>{t.contextNotice}</p>
      </section>
      {context ? (
        <section className="account-card confirmed-panel">
          <h2>{t.currentContext}</h2>
          <dl className="context-list">
            <div>
              <dt>{t.displayLabel}</dt>
              <dd>{context.displayLabel}</dd>
            </div>
            <div>
              <dt>{t.relationshipLabel}</dt>
              <dd>{context.relationshipLabel}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <div className="state-panel">{t.noContext}</div>
      )}
      {canManage ? (
        <form className="account-card" onSubmit={(event) => void submitContext(event, onSave)}>
          <p>{t.organizerOnly}</p>
          <label>
            {t.displayLabel} ({t.required})
            <input
              name="displayLabel"
              required
              maxLength={80}
              defaultValue={context?.displayLabel ?? ""}
            />
          </label>
          <label>
            {t.relationshipLabel} ({t.required})
            <input
              name="relationshipLabel"
              required
              maxLength={80}
              defaultValue={context?.relationshipLabel ?? ""}
            />
          </label>
          <div className="action-row">
            <button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? t.busy : t.saveContext}
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={busy}
              onClick={() => void onReload()}
            >
              {t.reload}
            </button>
          </div>
        </form>
      ) : (
        <p>{t.organizerOnly}</p>
      )}
    </>
  );
}

function titleFor(screen: HouseholdScreen, t: HouseholdCopy): string {
  if (screen === "create") return t.createTitle;
  if (screen === "invitations") return t.invitationTitle;
  if (screen === "decision") return t.decisionTitle;
  return t.contextTitle;
}

async function requestJson(
  path: string,
  method: "GET" | "POST" | "PUT",
  session: SessionProjection,
  body?: unknown,
  idempotency?: string,
): Promise<Envelope> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      "x-correlation-id": correlationId(),
      ...(method === "GET"
        ? {}
        : {
            "content-type": "application/json",
            "x-csrf-token": session.csrfToken,
          }),
      ...(idempotency ? { "idempotency-key": idempotency } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const envelope = (await response.json()) as Envelope;
  if (!response.ok) throw new ApiFailure(response.status, envelope.error?.code ?? "FAILED");
  return envelope;
}

function messageFor(caught: unknown, t: HouseholdCopy): string {
  if (!(caught instanceof ApiFailure)) return t.serviceError;
  if (caught.status === 0) return t.offline;
  if (caught.status === 409) return t.conflict;
  if (caught.status === 429) return t.throttled;
  if (caught.status === 404) return t.genericError;
  if (caught.status === 401) return t.signInRequired;
  return t.serviceError;
}

function toInvitationProjection(value: unknown): InvitationProjection {
  const source = value as InvitationProjection;
  return {
    invitationId: source.invitationId,
    householdId: source.householdId,
    role: source.role,
    state: source.state,
    expiresAt: source.expiresAt,
    version: source.version,
  };
}

function idempotencyKey(): string {
  return `web_${crypto.randomUUID().replaceAll("-", "")}`;
}

function correlationId(): string {
  return `corr_web_${crypto.randomUUID().replaceAll("-", "")}`;
}

async function submitLabel(
  event: FormEvent<HTMLFormElement>,
  onSubmit: (value: string) => Promise<void>,
) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  await onSubmit(String(data.get("displayLabel") ?? "").trim());
}

async function submitInvitation(
  event: FormEvent<HTMLFormElement>,
  onSubmit: (loginName: string, role: "caregiver" | "member") => Promise<void>,
) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  await onSubmit(
    String(data.get("inviteeLoginName") ?? "").trim(),
    String(data.get("role")) as "caregiver" | "member",
  );
}

async function submitContext(
  event: FormEvent<HTMLFormElement>,
  onSubmit: (displayLabel: string, relationshipLabel: string) => Promise<void>,
) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  await onSubmit(
    String(data.get("displayLabel") ?? "").trim(),
    String(data.get("relationshipLabel") ?? "").trim(),
  );
}
