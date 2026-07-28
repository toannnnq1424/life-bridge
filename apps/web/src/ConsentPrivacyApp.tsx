"use client";

import type {
  AuditHistoryProjection,
  ConsentGrantProjection,
  ConsentOverviewProjection,
  ConsentScope,
  PrivacyPreferencesProjection,
} from "@lifebridge/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

type View = "consent" | "privacy" | "audit" | "settings";

interface SessionProjection {
  csrfToken: string;
  preferences: { locale: "vi-VN" | "en" };
}

interface Envelope<T> {
  data: T;
  meta: { correlationId: string };
}

interface PendingConsent {
  action: "grant" | "narrow" | "revoke";
  grant?: ConsentGrantProjection;
  recipientRef?: string;
  scopes: ConsentScope[];
  idempotencyKey?: string;
}

class ApiFailure extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

const scopeLabels: Record<ConsentScope, [string, string]> = {
  "recipient_context.basic_label": ["Nhãn cơ bản", "Basic recipient label"],
  "recipient_context.relationship_label": ["Nhãn quan hệ", "Relationship label"],
  "document_vault.access": ["Truy cập kho tài liệu", "Document vault access"],
};

export function ConsentPrivacyApp({ view, householdId }: { view: View; householdId?: string }) {
  const [session, setSession] = useState<SessionProjection | null>(null);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [announcementSequence, setAnnouncementSequence] = useState(0);
  const statusRef = useRef<HTMLDivElement>(null);
  const settingsHref = householdId
    ? `/settings?householdId=${encodeURIComponent(householdId)}`
    : "/settings";

  const announce = useCallback((value: string, isError = false) => {
    if (isError) {
      setMessage("");
      setError(value);
    } else {
      setError("");
      setMessage(value);
    }
    setAnnouncementSequence((current) => current + 1);
  }, []);

  useEffect(() => {
    if (announcementSequence > 0) {
      statusRef.current?.focus();
    }
  }, [announcementSequence]);

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
    void (async () => {
      try {
        const envelope = await api<SessionProjection>("/api/v1/account/session");
        setSession(envelope.data);
      } catch {
        announce(
          "Phiên đã hết hạn hoặc không khả dụng. / The session expired or is unavailable.",
          true,
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [announce]);

  const mutation = useCallback(
    async <T,>(url: string, method: "POST" | "PATCH", body: unknown, idempotencyKey?: string) => {
      if (!online) {
        throw new ApiFailure(0, "OFFLINE");
      }
      if (!session) {
        throw new ApiFailure(401, "SESSION_REQUIRED");
      }
      return api<T>(url, {
        method,
        headers: {
          "content-type": "application/json",
          "x-csrf-token": session.csrfToken,
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
      });
    },
    [online, session],
  );

  return (
    <div className="privacy-app">
      <a className="skip-link" href="#main-content">
        Bỏ qua đến nội dung / Skip to content
      </a>
      <header className="app-header">
        <div>
          <a className="brand" href="/">
            LifeBridge
          </a>
          <p className="fixture-note">Dữ liệu tổng hợp / Synthetic data only</p>
        </div>
        <nav aria-label="Cài đặt / Settings">
          <a href={settingsHref}>Cài đặt / Settings</a>
          {" · "}
          <a href="/onboarding/accessibility">Tiếp cận / Accessibility</a>
        </nav>
      </header>
      {!online ? (
        <div className="offline-banner" role="status">
          Không thể lưu khi ngoại tuyến. Thay đổi sẽ không được xếp hàng hoặc tự gửi lại. / Changes
          cannot be saved offline and will not be queued or submitted later.
        </div>
      ) : null}
      <main id="main-content" className="privacy-main">
        <div
          ref={statusRef}
          className={error ? "status-panel error-summary" : "status-panel"}
          role={error ? "alert" : "status"}
          aria-live={error ? "assertive" : "polite"}
          tabIndex={-1}
          hidden={!error && !message}
        >
          {error || message}
        </div>
        {loading ? (
          <section aria-busy="true" aria-label="Đang tải / Loading">
            <h1 tabIndex={-1}>Đang tải / Loading</h1>
            <p>Đang tải trạng thái đã xác nhận. / Loading confirmed state.</p>
          </section>
        ) : view === "consent" && householdId ? (
          <ConsentScreen
            householdId={householdId}
            online={online}
            mutation={mutation}
            announce={announce}
          />
        ) : view === "privacy" ? (
          <PrivacyScreen online={online} mutation={mutation} announce={announce} />
        ) : view === "audit" && householdId ? (
          <AuditScreen householdId={householdId} announce={announce} />
        ) : (
          <SettingsScreen {...(householdId ? { householdId } : {})} />
        )}
      </main>
    </div>
  );
}

function ConsentScreen({
  householdId,
  online,
  mutation,
  announce,
}: {
  householdId: string;
  online: boolean;
  mutation: <T>(
    url: string,
    method: "POST" | "PATCH",
    body: unknown,
    idempotencyKey?: string,
  ) => Promise<Envelope<T>>;
  announce: (message: string, isError?: boolean) => void;
}) {
  const [overview, setOverview] = useState<ConsentOverviewProjection | null>(null);
  const [contextId, setContextId] = useState("");
  const [recipientRef, setRecipientRef] = useState("");
  const [scopes, setScopes] = useState<ConsentScope[]>([]);
  const [pending, setPending] = useState<PendingConsent | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const bindReviewRef = useRef<HTMLHeadingElement>(null);
  const timeZone = safeTimeZone();

  const load = useCallback(async () => {
    try {
      const [consent, context] = await Promise.all([
        api<ConsentOverviewProjection>(
          `/api/v1/households/${encodeURIComponent(householdId)}/consent`,
        ),
        api<{ recipientContextId?: string } | null>(
          `/api/v1/households/${encodeURIComponent(householdId)}/recipient-context`,
        ),
      ]);
      setOverview(consent.data);
      setContextId(context.data?.recipientContextId ?? "");
      setLoadFailed(false);
      return true;
    } catch (caught) {
      setLoadFailed(true);
      announce(errorCopy(caught), true);
      return false;
    }
  }, [announce, householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pending?.recipientRef === "__bind__") {
      bindReviewRef.current?.focus();
    }
  }, [pending]);

  const toggleScope = (scope: ConsentScope) => {
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  };

  const confirm = async () => {
    if (!overview?.subject || !pending) return;
    setBusy(true);
    try {
      const base = {
        effectiveTime: { mode: "immediate", displayTimeZone: timeZone },
        expectedSubjectVersion: overview.subject.version,
      };
      if (pending.action === "grant") {
        await mutation(
          `/api/v1/households/${encodeURIComponent(householdId)}/consent/grants`,
          "POST",
          {
            ...base,
            action: "grant",
            recipientRef: pending.recipientRef,
            purpose: "household_coordination",
            scopes: pending.scopes,
          },
          pending.idempotencyKey,
        );
      } else if (pending.grant) {
        await mutation(
          `/api/v1/households/${encodeURIComponent(householdId)}/consent/grants/${encodeURIComponent(pending.grant.grantId)}/${pending.action}`,
          "POST",
          {
            ...base,
            action: pending.action,
            expectedGrantVersion: pending.grant.version,
            ...(pending.action === "narrow" ? { scopes: pending.scopes } : {}),
          },
          pending.idempotencyKey,
        );
      }
      setPending(null);
      setScopes([]);
      const refreshed = await load();
      announce(
        refreshed
          ? "Máy chủ đã xác nhận thay đổi. / The server confirmed the change."
          : "Máy chủ đã xác nhận thay đổi nhưng chưa thể tải lại trạng thái. Không gửi lại mù quáng. / The server confirmed the change, but the latest state could not be reloaded. Do not retry blindly.",
      );
    } catch (caught) {
      announce(errorCopy(caught), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 tabIndex={-1}>Đồng thuận chia sẻ / Consent sharing</h1>
      <p className="authority-note">
        Vai trò người tổ chức không tự cấp quyền đồng thuận. / Organizer membership does not grant
        consent authority.
      </p>
      <p>
        Mọi thay đổi có hiệu lực khi máy chủ xác nhận bằng UTC; hiển thị theo {timeZone}. / Changes
        take effect when the server confirms them in UTC; displayed in {timeZone}.
      </p>
      <button
        className="secondary-button"
        type="button"
        disabled={busy}
        onClick={() => void load()}
      >
        Tải lại trạng thái đã xác nhận / Reload confirmed state
      </button>
      {!overview && loadFailed ? (
        <p>
          Không thể tải trạng thái đã xác nhận. Không có thay đổi nào được gửi. / Confirmed state is
          unavailable. No change was submitted.
        </p>
      ) : !overview ? (
        <p aria-busy="true">Đang tải trạng thái đã xác nhận. / Loading confirmed state.</p>
      ) : overview.authority === "unbound" ? (
        <section className="privacy-card" aria-labelledby="authority-heading">
          <h2 id="authority-heading">Xác nhận quyền tự quản / Confirm self authority</h2>
          <p>
            Chỉ xác nhận nếu bối cảnh này là của chính tài khoản bạn đã tạo. Bối cảnh cũ không có
            nguồn gốc sẽ bị từ chối. / Confirm only for your own context created by this account.
            Legacy contexts without provenance are denied.
          </p>
          <button
            type="button"
            disabled={!online || !contextId || busy}
            onClick={() =>
              setPending({
                action: "grant",
                recipientRef: "__bind__",
                scopes: [],
              })
            }
          >
            Xem lại quyền tự quản / Review self authority
          </button>
          {pending?.recipientRef === "__bind__" ? (
            <div className="review-panel" role="group" aria-labelledby="bind-review">
              <h3 ref={bindReviewRef} id="bind-review" tabIndex={-1}>
                Xem lại / Review
              </h3>
              <p>
                Hiệu lực: tự quản bối cảnh này; không cấp quyền cho thành viên khác. / Effect: self
                authority for this context; no member access is granted.
              </p>
              <p>
                UTC máy chủ tham chiếu / Server UTC reference: <time>{overview.serverTime}</time> (
                {timeZone})
              </p>
              <div className="action-row">
                <button
                  type="button"
                  disabled={!online || busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await mutation(
                          `/api/v1/households/${encodeURIComponent(householdId)}/consent/subject`,
                          "POST",
                          {
                            recipientContextId: contextId,
                            displayTimeZone: timeZone,
                          },
                        );
                        setPending(null);
                        const refreshed = await load();
                        announce(
                          refreshed
                            ? "Đã xác nhận quyền tự quản. / Self authority confirmed."
                            : "Đã xác nhận quyền tự quản nhưng chưa thể tải lại trạng thái. / Self authority was confirmed, but the latest state could not be reloaded.",
                        );
                      } catch (caught) {
                        announce(errorCopy(caught), true);
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  Xác nhận / Confirm
                </button>
                <button className="secondary-button" type="button" onClick={() => setPending(null)}>
                  Hủy / Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <section className="privacy-card" aria-labelledby="current-grants">
            <h2 id="current-grants">Chia sẻ hiện tại / Current sharing</h2>
            {overview.grants.length === 0 ? (
              <p>
                Không có quyền chia sẻ đã xác nhận trên trang này. / No confirmed sharing is shown
                on this page.
              </p>
            ) : (
              <ul className="grant-list">
                {overview.grants.map((grant) => (
                  <li key={grant.grantId} className="grant-card">
                    <h3>Thành viên hộ gia đình / Household member</h3>
                    <p>
                      Trạng thái / Status: <strong>{grant.state}</strong>
                    </p>
                    <p>Mục đích / Purpose: Điều phối hộ gia đình / Household coordination</p>
                    <p>
                      Phạm vi / Scopes:{" "}
                      {grant.scopes.map((scope) => scopeLabels[scope].join(" / ")).join(", ")}
                    </p>
                    <p>
                      Hiệu lực UTC / Effective UTC: <time>{grant.effectiveAt}</time> (
                      {grant.displayTimeZone})
                    </p>
                    <p>Phiên bản / Version: {grant.version}</p>
                    {grant.state === "active" ? (
                      <div className="action-row">
                        <button
                          type="button"
                          disabled={!online || grant.scopes.length < 2}
                          onClick={() =>
                            setPending({
                              action: "narrow",
                              grant,
                              scopes: [grant.scopes[0]!],
                              idempotencyKey: mutationKey(),
                            })
                          }
                        >
                          Thu hẹp / Narrow
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          disabled={!online}
                          onClick={() =>
                            setPending({
                              action: "revoke",
                              grant,
                              scopes: [],
                              idempotencyKey: mutationKey(),
                            })
                          }
                        >
                          Thu hồi / Revoke
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="privacy-card" aria-labelledby="grant-heading">
            <h2 id="grant-heading">Cấp quyền chia sẻ / Grant sharing</h2>
            <label>
              Người nhận / Recipient
              <select
                value={recipientRef}
                onChange={(event) => setRecipientRef(event.target.value)}
              >
                <option value="">Chọn thành viên / Select a member</option>
                {overview.eligibleRecipients.map((recipient) => (
                  <option key={recipient.recipientRef} value={recipient.recipientRef}>
                    Thành viên hộ gia đình ({recipient.role}) / Household member
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Phạm vi, không chọn sẵn / Scopes, none preselected</legend>
              {(Object.keys(scopeLabels) as ConsentScope[]).map((scope) => (
                <label key={scope} className="check-row">
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                  />
                  {scopeLabels[scope].join(" / ")}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              disabled={!online || !recipientRef || scopes.length === 0}
              onClick={() =>
                setPending({
                  action: "grant",
                  recipientRef,
                  scopes,
                  idempotencyKey: mutationKey(),
                })
              }
            >
              Xem lại cấp quyền / Review grant
            </button>
          </section>
          {pending ? (
            <ConsentReview
              pending={pending}
              busy={busy}
              online={online}
              serverTime={overview.serverTime}
              onConfirm={confirm}
              onCancel={() => setPending(null)}
            />
          ) : null}
          <p>
            <a href={`/households/${encodeURIComponent(householdId)}/audit`}>
              Xem nhật ký đã che / View redacted access history
            </a>
          </p>
        </>
      )}
    </>
  );
}

function ConsentReview({
  pending,
  busy,
  online,
  serverTime,
  onConfirm,
  onCancel,
}: {
  pending: PendingConsent;
  busy: boolean;
  online: boolean;
  serverTime: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  if (pending.recipientRef === "__bind__") return null;
  const labels = pending.scopes.map((scope) => scopeLabels[scope].join(" / ")).join(", ");
  return (
    <section className="review-panel" aria-labelledby="consent-review">
      <h2 ref={headingRef} id="consent-review" tabIndex={-1}>
        Xem lại thay đổi / Review change
      </h2>
      <dl>
        <dt>Người nhận / Recipient</dt>
        <dd>Thành viên hộ gia đình / Household member</dd>
        <dt>Hiệu lực / Effect</dt>
        <dd>{pending.action}</dd>
        <dt>Phạm vi / Scopes</dt>
        <dd>{labels || "Tất cả quyền truy cập mới dừng / All new access stops"}</dd>
        <dt>Quyền / Authority</dt>
        <dd>Người nhận tự quản / Self-authorized care recipient</dd>
        <dt>Thời điểm / Time</dt>
        <dd>
          Có hiệu lực khi máy chủ xác nhận / Effective when the server confirms. UTC máy chủ tham
          chiếu / Server UTC reference: <time>{serverTime}</time>
        </dd>
      </dl>
      {pending.action === "revoke" ? (
        <p>
          Quyền truy cập mới dừng tại thời điểm có hiệu lực; bằng chứng lịch sử đã che vẫn được giữ
          theo chính sách. / New access stops at the effective boundary; redacted historical
          evidence remains under policy.
        </p>
      ) : null}
      <div className="action-row">
        <button
          className={pending.action === "revoke" ? "danger-button" : ""}
          type="button"
          disabled={!online || busy}
          onClick={() => void onConfirm()}
        >
          Xác nhận {pending.action} / Confirm {pending.action}
        </button>
        <button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>
          Hủy / Cancel
        </button>
      </div>
    </section>
  );
}

function PrivacyScreen({
  online,
  mutation,
  announce,
}: {
  online: boolean;
  mutation: <T>(
    url: string,
    method: "POST" | "PATCH",
    body: unknown,
    idempotencyKey?: string,
  ) => Promise<Envelope<T>>;
  announce: (message: string, isError?: boolean) => void;
}) {
  const [confirmed, setConfirmed] = useState<PrivacyPreferencesProjection | null>(null);
  const [draft, setDraft] = useState<PrivacyPreferencesProjection | null>(null);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const timeZone = safeTimeZone();

  const load = useCallback(async () => {
    try {
      const envelope = await api<PrivacyPreferencesProjection>("/api/v1/account/privacy");
      setConfirmed(envelope.data);
      setDraft(envelope.data);
      setLoadFailed(false);
    } catch (caught) {
      setLoadFailed(true);
      announce(errorCopy(caught), true);
    }
  }, [announce]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (review) reviewHeadingRef.current?.focus();
  }, [review]);

  const save = async () => {
    if (!draft || !confirmed) return;
    setBusy(true);
    try {
      const envelope = await mutation<PrivacyPreferencesProjection>(
        "/api/v1/account/privacy",
        "PATCH",
        {
          profileVisibility: draft.profileVisibility,
          coordinationActivityVisibility: draft.coordinationActivityVisibility,
          accessAlerts: draft.accessAlerts,
          expectedVersion: confirmed.version,
          displayTimeZone: timeZone,
        },
      );
      setConfirmed(envelope.data);
      setDraft(envelope.data);
      setReview(false);
      announce("Đã lưu nguyên tử cả ba tùy chọn. / All three preferences were saved atomically.");
    } catch (caught) {
      setDraft(confirmed);
      setReview(false);
      announce(errorCopy(caught), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 tabIndex={-1}>Cài đặt quyền riêng tư / Privacy settings</h1>
      <p>
        Đây là điều khiển sản phẩm, không phải tự động hóa tuân thủ pháp lý. / These are product
        controls, not legal-compliance automation.
      </p>
      <button
        className="secondary-button"
        type="button"
        disabled={busy}
        onClick={() => void load()}
      >
        Tải lại trạng thái đã xác nhận / Reload confirmed state
      </button>
      {loadFailed && (!draft || !confirmed) ? (
        <p>
          Không thể tải tùy chọn đã xác nhận. Không có thay đổi nào được gửi. / Confirmed
          preferences are unavailable. No change was submitted.
        </p>
      ) : !draft || !confirmed ? (
        <p aria-busy="true">Đang tải / Loading</p>
      ) : (
        <section className="privacy-card" aria-labelledby="privacy-preferences">
          <h2 id="privacy-preferences">Tùy chọn quyền riêng tư / Privacy preferences</h2>
          <fieldset>
            <legend>Hiển thị hồ sơ / Profile visibility</legend>
            {(["private", "household_only"] as const).map((value) => (
              <label key={value} className="check-row">
                <input
                  type="radio"
                  name="profile"
                  value={value}
                  checked={draft.profileVisibility === value}
                  onChange={() => setDraft({ ...draft, profileVisibility: value })}
                />
                {value === "private" ? "Riêng tư / Private" : "Chỉ hộ gia đình / Household only"}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Hiển thị hoạt động điều phối / Coordination activity visibility</legend>
            {(["hidden", "household_only"] as const).map((value) => (
              <label key={value} className="check-row">
                <input
                  type="radio"
                  name="activity"
                  value={value}
                  checked={draft.coordinationActivityVisibility === value}
                  onChange={() => setDraft({ ...draft, coordinationActivityVisibility: value })}
                />
                {value === "hidden" ? "Ẩn / Hidden" : "Chỉ hộ gia đình / Household only"}
              </label>
            ))}
          </fieldset>
          <label className="check-row">
            <input
              type="checkbox"
              checked={draft.accessAlerts}
              onChange={(event) => setDraft({ ...draft, accessAlerts: event.target.checked })}
            />
            Cảnh báo truy cập đồng thuận / Consent access alerts
          </label>
          <p>
            Phiên bản / Version: {confirmed.version}. UTC: <time>{confirmed.confirmedAt}</time> (
            {timeZone})
          </p>
          <button type="button" disabled={!online || busy} onClick={() => setReview(true)}>
            Xem lại thay đổi / Review changes
          </button>
        </section>
      )}
      {review && draft ? (
        <section className="review-panel" aria-labelledby="privacy-review">
          <h2 ref={reviewHeadingRef} id="privacy-review" tabIndex={-1}>
            Xem lại và lưu / Review and save
          </h2>
          <p>
            Hồ sơ / Profile: {draft.profileVisibility}; Hoạt động / Activity:{" "}
            {draft.coordinationActivityVisibility}; Cảnh báo / Alerts:{" "}
            {draft.accessAlerts ? "Bật / On" : "Tắt / Off"}.
          </p>
          <p>
            Cả ba thay đổi được lưu nguyên tử; lỗi xác nhận không thay đổi giá trị nào. / All three
            save atomically; a failed confirmation changes none.
          </p>
          <div className="action-row">
            <button type="button" disabled={!online || busy} onClick={() => void save()}>
              Xác nhận lưu / Confirm save
            </button>
            <button className="secondary-button" type="button" onClick={() => setReview(false)}>
              Hủy / Cancel
            </button>
          </div>
        </section>
      ) : null}
      <section className="privacy-card" aria-labelledby="deferred-actions">
        <h2 id="deferred-actions">Xuất và xóa / Export and deletion</h2>
        <p>
          Xuất và xóa chưa được tự động hóa trong phạm vi này. / Export and deletion are not
          automated in this slice.
        </p>
      </section>
      <p>
        <a href="/settings">Quay lại trung tâm cài đặt / Back to settings hub</a>
      </p>
    </>
  );
}

function AuditScreen({
  householdId,
  announce,
}: {
  householdId: string;
  announce: (message: string, isError?: boolean) => void;
}) {
  const [history, setHistory] = useState<AuditHistoryProjection | null>(null);
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const timeZone = safeTimeZone();

  const load = useCallback(
    async (cursor?: string) => {
      setBusy(true);
      try {
        const query = new URLSearchParams({ limit: "20", displayTimeZone: timeZone });
        if (category) query.set("category", category);
        if (cursor) query.set("cursor", cursor);
        const envelope = await api<AuditHistoryProjection>(
          `/api/v1/households/${encodeURIComponent(householdId)}/audit?${query.toString()}`,
        );
        setHistory((current) =>
          cursor && current
            ? {
                items: [...current.items, ...envelope.data.items],
                nextCursor: envelope.data.nextCursor,
              }
            : envelope.data,
        );
        setLoadFailed(false);
      } catch (caught) {
        setLoadFailed(true);
        announce(errorCopy(caught), true);
      } finally {
        setBusy(false);
      }
    },
    [announce, category, householdId, timeZone],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h1 tabIndex={-1}>Nhật ký truy cập đã che / Redacted access history</h1>
      <p className="authority-note">
        Chỉ đọc: trang này không thể cấp hoặc thay đổi quyền. / Read only: this page cannot grant or
        change access.
      </p>
      <p>
        Một số trường được che để bảo vệ quyền riêng tư hộ gia đình. / Some fields are hidden to
        protect household privacy.
      </p>
      <form
        className="audit-filters"
        onSubmit={(event) => {
          event.preventDefault();
          setHistory(null);
          void load();
        }}
      >
        <label>
          Loại sự kiện / Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Tất cả loại được phép / All permitted categories</option>
            <option value="consent.granted">Đã cấp / Consent granted</option>
            <option value="consent.narrowed">Đã thu hẹp / Sharing narrowed</option>
            <option value="consent.revoked">Đã thu hồi / Consent revoked</option>
            <option value="recipient_context.access_allowed">
              Cho phép truy cập / Access allowed
            </option>
            <option value="recipient_context.access_denied">
              Từ chối truy cập / Access denied
            </option>
          </select>
        </label>
        <button type="submit" disabled={busy}>
          Áp dụng / Apply
        </button>
      </form>
      {!history && loadFailed ? (
        <p>
          Không thể tải lịch sử được phép. Bộ lọc không tiết lộ số hàng ẩn. / Permitted history is
          unavailable. The filter reveals no hidden-row count.
        </p>
      ) : !history ? (
        <p aria-busy="true">Đang tải lịch sử được phép. / Loading permitted history.</p>
      ) : history.items.length === 0 ? (
        <p>
          Không có sự kiện nào được hiển thị cho bộ lọc này. / No events are shown for this filter.
        </p>
      ) : (
        <ol className="audit-list">
          {history.items.map((item) => (
            <li key={item.eventRef} className="privacy-card">
              <h2>{auditCategory(item.category)}</h2>
              <dl>
                <dt>Tác nhân / Actor</dt>
                <dd>{actorAlias(item.actorAlias)}</dd>
                <dt>Kết quả / Outcome</dt>
                <dd>{item.outcome}</dd>
                <dt>Che thông tin / Redaction</dt>
                <dd>Được bảo vệ / Protected</dd>
                <dt>UTC</dt>
                <dd>
                  <time>{item.occurredAt}</time> ({item.displayTimeZone})
                </dd>
              </dl>
            </li>
          ))}
        </ol>
      )}
      {history?.nextCursor ? (
        <button type="button" disabled={busy} onClick={() => void load(history.nextCursor!)}>
          Tải sự kiện cũ hơn / Load older events
        </button>
      ) : null}
      <p>
        <a href={`/households/${encodeURIComponent(householdId)}/consent`}>
          Quay lại đồng thuận chia sẻ / Back to consent sharing
        </a>
      </p>
    </>
  );
}

function SettingsScreen({ householdId }: { householdId?: string }) {
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [privacyStatus, setPrivacyStatus] = useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  useEffect(() => {
    void api<PrivacyPreferencesProjection>("/api/v1/account/privacy")
      .then((envelope) => {
        setConfirmedAt(envelope.data.confirmedAt);
        setPrivacyStatus("ready");
      })
      .catch(() => {
        setConfirmedAt(null);
        setPrivacyStatus("unavailable");
      });
  }, []);
  const destination = householdId ? `/households/${encodeURIComponent(householdId)}` : "";
  const cards = [
    {
      href: "/settings/privacy",
      title: "Cài đặt quyền riêng tư / Privacy settings",
      body: "Quản lý hiển thị và cảnh báo bằng một lần lưu nguyên tử. / Manage visibility and alerts with one atomic save.",
    },
    {
      href: destination ? `${destination}/consent` : "/",
      title: "Đồng thuận chia sẻ / Consent sharing",
      body: destination
        ? "Xem và điều chỉnh quyền chia sẻ của hộ đã chọn. / Review sharing for the selected household."
        : "Chọn hộ gia đình từ trang chủ trước. / Select a household from home first.",
    },
    {
      href: destination ? `${destination}/audit` : "/",
      title: "Nhật ký đã che / Redacted access history",
      body: destination
        ? "Xem lịch sử chỉ đọc được phép. / View permitted read-only history."
        : "Chọn hộ gia đình từ trang chủ trước. / Select a household from home first.",
    },
    {
      href: "/onboarding/accessibility",
      title: "Ngôn ngữ và tiếp cận / Language and accessibility",
      body: "Quản lý tùy chọn tiếp cận độc lập. / Manage accessibility preferences independently.",
    },
    {
      href: "/mfa",
      title: "Bảo mật tài khoản / Account security",
      body: "Xem xác thực và khôi phục. / Review authentication and recovery.",
    },
    {
      href: "/",
      title: "Đăng xuất / Sign out",
      body: "Kết thúc phiên từ điều khiển tài khoản. / End the session from account controls.",
    },
  ];
  return (
    <>
      <h1 tabIndex={-1}>Trung tâm cài đặt / Settings hub</h1>
      <p>
        Các mục được quản lý độc lập. Trung tâm này không có trạng thái đã lưu chung. / Sections are
        managed independently. This hub has no global saved state.
      </p>
      <nav aria-label="Mục cài đặt / Settings sections">
        <ul className="settings-grid">
          {cards.map((card) => (
            <li key={card.title} className="privacy-card">
              <h2>
                <a href={card.href}>{card.title}</a>
              </h2>
              <p>{card.body}</p>
              {card.href === "/settings/privacy" && confirmedAt ? (
                <p>
                  Đã xác nhận / Confirmed: <time>{confirmedAt}</time> UTC ({safeTimeZone()})
                </p>
              ) : card.href === "/settings/privacy" && privacyStatus === "loading" ? (
                <p aria-busy="true">Đang tải trạng thái / Loading status</p>
              ) : card.href === "/settings/privacy" && privacyStatus === "unavailable" ? (
                <p>
                  Trạng thái đã xác nhận không khả dụng; không có giá trị nào được hiển thị. /
                  Confirmed status is unavailable; no preference value is shown.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

async function api<T>(url: string, init?: RequestInit): Promise<Envelope<T>> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ApiFailure(0, "UNCERTAIN");
  }
  const body = (await response.json().catch(() => null)) as
    Envelope<T> | { error?: { code?: string } } | null;
  if (!response.ok) {
    throw new ApiFailure(response.status, body && "error" in body ? (body.error?.code ?? "") : "");
  }
  return body as Envelope<T>;
}

function errorCopy(error: unknown): string {
  if (error instanceof ApiFailure) {
    if (error.code === "OFFLINE") {
      return "Không thể lưu ngoại tuyến; không có yêu cầu nào được xếp hàng. / Cannot save offline; no request was queued.";
    }
    if (error.code === "UNCERTAIN") {
      return "Kết quả chưa rõ. Kiểm tra trạng thái đã xác nhận trước khi thử lại. / Result uncertain. Check confirmed state before retrying.";
    }
    if (error.code === "CONSENT_VERSION_CONFLICT" || error.code === "PRIVACY_VERSION_CONFLICT") {
      return "Trạng thái đã thay đổi. Tải lại bản đã xác nhận trước khi thử lại. / The state changed. Reload the confirmed version before retrying.";
    }
    if (error.status === 404 || error.status === 403) {
      return "Không thể truy cập tài nguyên này. / This resource is not accessible.";
    }
  }
  return "Dịch vụ tạm thời không khả dụng. Không có thành công nào được xác nhận. / Service temporarily unavailable. No success was confirmed.";
}

function safeTimeZone(): string {
  try {
    const value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return value.includes("/") ? value : "Asia/Bangkok";
  } catch {
    return "Asia/Bangkok";
  }
}

function mutationKey(): string {
  return `p2s3-${crypto.randomUUID()}`;
}

function auditCategory(value: string): string {
  const labels: Record<string, string> = {
    "consent.subject_established": "Đã xác nhận quyền tự quản / Self authority confirmed",
    "consent.granted": "Đã cấp đồng thuận / Consent granted",
    "consent.narrowed": "Đã thu hẹp chia sẻ / Sharing narrowed",
    "consent.revoked": "Đã thu hồi đồng thuận / Consent revoked",
    "recipient_context.access_allowed": "Đã cho phép truy cập / Governed access allowed",
    "recipient_context.access_denied": "Đã từ chối truy cập / Governed access denied",
    "privacy.confirmed": "Đã xác nhận quyền riêng tư / Privacy confirmed",
  };
  return labels[value] ?? "Sự kiện được bảo vệ / Protected event";
}

function actorAlias(value: string): string {
  return value === "your_account"
    ? "Tài khoản của bạn / Your account"
    : value === "household_member"
      ? "Thành viên hộ gia đình / Household member"
      : "Được bảo vệ / Protected";
}
