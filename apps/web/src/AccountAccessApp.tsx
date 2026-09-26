"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

type Locale = "vi-VN" | "en";
type Screen = "landing" | "login" | "register" | "mfa" | "recover" | "onboarding" | "preferences";
type FactorMode = "registration" | "signin" | "factor-recovery";

interface SessionProjection {
  authorizationScope: "account";
  onboardingState: "required" | "complete";
  csrfToken: string;
  preferences: {
    locale: Locale;
    textScale: "default" | "large";
    contrast: "system" | "more";
    motion: "system" | "reduce";
    version: number;
  };
}

interface Envelope {
  data?: Record<string, unknown>;
  error?: { code?: string; messageKey?: string };
}

const copy = {
  "vi-VN": {
    skip: "Bỏ qua đến nội dung chính",
    language: "Ngôn ngữ",
    landingTitle: "Điều phối chăm sóc, rõ ràng và an toàn",
    landingIntro:
      "LifeBridge hỗ trợ phối hợp trách nhiệm. Đây không phải dịch vụ chẩn đoán hay điều phối cấp cứu.",
    signIn: "Đăng nhập",
    register: "Tạo tài khoản",
    loginName: "Tên đăng nhập",
    password: "Mật khẩu",
    newPassword: "Mật khẩu mới",
    showPassword: "Hiện mật khẩu",
    continue: "Tiếp tục",
    recovery: "Khôi phục quyền truy cập",
    loginTitle: "Đăng nhập",
    registerTitle: "Tạo tài khoản",
    registerHelp:
      "Tạo tài khoản chưa cấp quyền vào hộ gia đình. Bạn phải hoàn tất yếu tố xác thực và lưu mã khôi phục.",
    passwordHelp: "Dùng ít nhất 8 ký tự; mật khẩu phổ biến không được chấp nhận.",
    factorTitle: "Xác thực bắt buộc",
    totp: "Mã xác thực 6 chữ số",
    manualSecret: "Khóa thiết lập thủ công",
    recoveryCodes: "Mã khôi phục dùng một lần",
    acknowledge: "Tôi đã lưu các mã khôi phục ở nơi an toàn",
    verify: "Xác minh",
    recoveryTitle: "Khôi phục tài khoản",
    recoveryMode: "Cách khôi phục",
    passwordRecovery: "Đặt lại mật khẩu",
    factorRecovery: "Thay ứng dụng xác thực",
    recoveryCode: "Mã khôi phục đã lưu",
    currentFactor: "Mã xác thực hiện tại",
    onboardingTitle: "Hoàn tất thiết lập tài khoản — Bước 1/2",
    onboardingHelp:
      "Lựa chọn này chỉ ghi nhận ý định phối hợp; không cấp vai trò hoặc quyền vào hộ gia đình.",
    coordinate: "Tôi muốn điều phối",
    participate: "Tôi muốn tham gia",
    preferencesTitle: "Hiển thị và ngôn ngữ — Bước 2/2",
    textSize: "Cỡ chữ",
    default: "Mặc định",
    large: "Lớn",
    contrast: "Độ tương phản",
    system: "Theo hệ thống",
    more: "Cao hơn",
    motion: "Chuyển động",
    reduce: "Giảm chuyển động",
    save: "Lưu và tiếp tục",
    useDefaults: "Dùng mặc định và tiếp tục",
    signOut: "Đăng xuất",
    accountReady: "Phiên tài khoản đã được xác thực. Chưa có quyền hộ gia đình.",
    generic:
      "Không thể hoàn tất yêu cầu. Hãy kiểm tra thông tin hoặc thử lại sau. Phản hồi này không xác nhận tài khoản có tồn tại hay không.",
    accepted:
      "Yêu cầu đã được tiếp nhận. Tiếp tục theo hướng dẫn mà không suy luận trạng thái tài khoản.",
    offline: "Bạn đang ngoại tuyến. Thao tác bị chặn và sẽ không tự gửi lại khi kết nối.",
    expired: "Phiên hoặc yêu cầu đã hết hạn. Dữ liệu bí mật đã được xóa.",
    errorSummary: "Có vấn đề cần xử lý",
    back: "Quay lại",
  },
  en: {
    skip: "Skip to main content",
    language: "Language",
    landingTitle: "Coordinate care clearly and safely",
    landingIntro:
      "LifeBridge supports responsibility coordination. It is not a diagnostic or emergency dispatch service.",
    signIn: "Sign in",
    register: "Create account",
    loginName: "Login name",
    password: "Password",
    newPassword: "New password",
    showPassword: "Show password",
    continue: "Continue",
    recovery: "Recover account access",
    loginTitle: "Sign in",
    registerTitle: "Create an account",
    registerHelp:
      "Creating an account does not grant household access. Complete the required factor and save recovery codes.",
    passwordHelp: "Use at least 8 characters; common passwords are not accepted.",
    factorTitle: "Required authentication",
    totp: "6-digit authenticator code",
    manualSecret: "Manual setup key",
    recoveryCodes: "One-time recovery codes",
    acknowledge: "I saved the recovery codes in a safe place",
    verify: "Verify",
    recoveryTitle: "Recover account access",
    recoveryMode: "Recovery method",
    passwordRecovery: "Reset password",
    factorRecovery: "Replace authenticator",
    recoveryCode: "Saved recovery code",
    currentFactor: "Current authenticator code",
    onboardingTitle: "Finish account setup — Step 1 of 2",
    onboardingHelp:
      "This records coordination intent only. It does not grant a role or household access.",
    coordinate: "I intend to coordinate",
    participate: "I intend to participate",
    preferencesTitle: "Display and language — Step 2 of 2",
    textSize: "Text size",
    default: "Default",
    large: "Large",
    contrast: "Contrast",
    system: "Use system",
    more: "More",
    motion: "Motion",
    reduce: "Reduce motion",
    save: "Save and continue",
    useDefaults: "Use defaults and continue",
    signOut: "Sign out",
    accountReady: "Your account session is authorized. Household access has not been granted.",
    generic:
      "The request could not be completed. Check the information or try again later. This response does not confirm whether an account exists.",
    accepted: "The request was accepted. Continue as instructed without inferring account status.",
    offline: "You are offline. The action is blocked and will not submit after reconnecting.",
    expired: "The session or request expired. Secret fields were cleared.",
    errorSummary: "There is a problem to resolve",
    back: "Back",
  },
} as const;

const routes: Record<Screen, string> = {
  landing: "/",
  login: "/login",
  register: "/register",
  mfa: "/mfa",
  recover: "/recover",
  onboarding: "/onboarding",
  preferences: "/onboarding/accessibility",
};

export function AccountAccessApp({ initialScreen }: { initialScreen: Screen }) {
  const [screen, setScreen] = useState(initialScreen);
  const [locale, setLocale] = useState<Locale>("vi-VN");
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [challenge, setChallenge] = useState("");
  const [factorMode, setFactorMode] = useState<FactorMode>("signin");
  const [manualSecret, setManualSecret] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [session, setSession] = useState<SessionProjection | null>(null);
  const [recoveryMode, setRecoveryMode] = useState<"password" | "factor">("password");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const t = copy[locale];

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
    document.title = `${titleFor(screen, copy[locale])} — LifeBridge`;
    headingRef.current?.focus();
  }, [locale, screen]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function navigate(next: Screen) {
    clearSecrets();
    setError("");
    setStatus("");
    setScreen(next);
    window.history.pushState({}, "", routes[next]);
  }

  function clearSecrets() {
    setChallenge("");
    setManualSecret("");
    setRecoveryCodes([]);
  }

  async function request(path: string, method: string, body?: unknown): Promise<Envelope> {
    if (!navigator.onLine) {
      setError(t.offline);
      throw new Error("OFFLINE_BLOCKED");
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-correlation-id": `web_${crypto.randomUUID().replaceAll("-", "")}`,
          ...(session?.csrfToken ? { "x-csrf-token": session.csrfToken } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const envelope = (await response.json()) as Envelope;
      if (!response.ok) {
        setError(response.status === 401 ? t.expired : t.generic);
        if (response.status === 401) clearSecrets();
        throw new Error(envelope.error?.code ?? "REQUEST_FAILED");
      }
      return envelope;
    } catch (caught) {
      if (caught instanceof Error && caught.message === "OFFLINE_BLOCKED") throw caught;
      if (!error) setError(t.generic);
      throw caught;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="account-app"
      data-text-scale={session?.preferences.textScale ?? "default"}
      data-contrast={session?.preferences.contrast ?? "system"}
      data-motion={session?.preferences.motion ?? "system"}
    >
      <a className="skip-link" href="#account-main">
        {t.skip}
      </a>
      <header className="account-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate("landing");
          }}
        >
          LifeBridge
        </a>
        <label>
          <span>{t.language}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <main id="account-main" className="account-shell" tabIndex={-1}>
        <h1 ref={headingRef} tabIndex={-1}>
          {titleFor(screen, t)}
        </h1>
        {!online ? (
          <div className="status-banner warning" role="status">
            {t.offline}
          </div>
        ) : null}
        {error ? (
          <div ref={errorRef} className="error-summary" role="alert" tabIndex={-1}>
            <strong>{t.errorSummary}</strong>
            <p>{error}</p>
          </div>
        ) : null}
        <div className="sr-status" aria-live="polite">
          {status}
        </div>
        {screen === "landing" ? (
          <section className="account-card">
            <p>{t.landingIntro}</p>
            <div className="action-row">
              <a className="primary-action" href="/login">
                {t.signIn}
              </a>
              <a className="secondary-action" href="/register">
                {t.register}
              </a>
            </div>
          </section>
        ) : null}
        {screen === "login" ? (
          <CredentialForm
            t={t}
            busy={busy}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            onSubmit={async (loginName, password) => {
              const envelope = await request("/api/v1/account/sessions", "POST", {
                loginName,
                password,
              });
              setChallenge(String(envelope.data?.challengeToken ?? ""));
              setFactorMode("signin");
              setStatus(t.accepted);
              setScreen("mfa");
              window.history.replaceState({}, "", routes.mfa);
            }}
          >
            <a href="/recover">{t.recovery}</a>
          </CredentialForm>
        ) : null}
        {screen === "register" ? (
          <CredentialForm
            t={t}
            busy={busy}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            registration
            onSubmit={async (loginName, password) => {
              const envelope = await request("/api/v1/account/registrations", "POST", {
                loginName,
                password,
              });
              setChallenge(String(envelope.data?.challengeToken ?? ""));
              setManualSecret(String(envelope.data?.manualSecret ?? ""));
              setFactorMode("registration");
              setStatus(t.accepted);
              setScreen("mfa");
              window.history.replaceState({}, "", routes.mfa);
            }}
          />
        ) : null}
        {screen === "mfa" ? (
          <FactorPanel
            t={t}
            busy={busy}
            challenge={challenge}
            manualSecret={manualSecret}
            recoveryCodes={recoveryCodes}
            mode={factorMode}
            onVerify={async (code) => {
              const path =
                factorMode === "registration"
                  ? "/api/v1/account/registrations/factor"
                  : factorMode === "factor-recovery"
                    ? "/api/v1/account/recoveries/factor/confirm"
                    : "/api/v1/account/sessions/factor";
              const envelope = await request(path, "POST", { challengeToken: challenge, code });
              if (factorMode === "signin") {
                const projection = envelope.data?.projection as unknown as SessionProjection;
                setSession(projection);
                setChallenge("");
                setStatus("");
                setScreen("onboarding");
                window.history.replaceState({}, "", routes.onboarding);
              } else {
                setRecoveryCodes((envelope.data?.recoveryCodes as string[] | undefined) ?? []);
                setManualSecret("");
              }
            }}
            onAcknowledge={async () => {
              if (factorMode === "registration") {
                await request("/api/v1/account/registrations/confirm-recovery", "POST", {
                  challengeToken: challenge,
                  acknowledged: true,
                });
              }
              navigate("login");
            }}
          />
        ) : null}
        {screen === "recover" ? (
          <RecoveryPanel
            t={t}
            busy={busy}
            mode={recoveryMode}
            setMode={setRecoveryMode}
            onSubmit={async (values) => {
              if (recoveryMode === "password") {
                const envelope = await request(
                  "/api/v1/account/recoveries/password",
                  "POST",
                  values,
                );
                setRecoveryCodes((envelope.data?.recoveryCodes as string[] | undefined) ?? []);
                setStatus(t.accepted);
              } else {
                const envelope = await request("/api/v1/account/recoveries/factor", "POST", values);
                setChallenge(String(envelope.data?.challengeToken ?? ""));
                setManualSecret(String(envelope.data?.manualSecret ?? ""));
                setFactorMode("factor-recovery");
                setScreen("mfa");
                window.history.replaceState({}, "", routes.mfa);
              }
            }}
          />
        ) : null}
        {screen === "onboarding" ? (
          <OnboardingPanel
            t={t}
            busy={busy}
            accountReady={session?.onboardingState === "complete"}
            onContinue={async (roleIntent) => {
              const envelope = await request("/api/v1/account/onboarding/complete", "POST", {
                roleIntent,
              });
              setSession(envelope.data as unknown as SessionProjection);
              setScreen("preferences");
              window.history.replaceState({}, "", routes.preferences);
            }}
            onLogout={async () => {
              await request("/api/v1/account/session/logout", "POST");
              setSession(null);
              navigate("login");
            }}
          />
        ) : null}
        {screen === "preferences" ? (
          <PreferencesPanel
            t={t}
            busy={busy}
            locale={locale}
            onSave={async (preferences) => {
              if (!session) {
                setError(t.expired);
                return;
              }
              try {
                const envelope = await request("/api/v1/account/preferences", "PATCH", {
                  ...preferences,
                  expectedVersion: session.preferences.version,
                });
                setSession(envelope.data as unknown as SessionProjection);
                setStatus(t.accountReady);
              } catch {
                // Preference failure is displayed but never gates the account session.
              }
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function titleFor(screen: Screen, t: (typeof copy)[Locale]): string {
  return screen === "landing"
    ? t.landingTitle
    : screen === "login"
      ? t.loginTitle
      : screen === "register"
        ? t.registerTitle
        : screen === "mfa"
          ? t.factorTitle
          : screen === "recover"
            ? t.recoveryTitle
            : screen === "onboarding"
              ? t.onboardingTitle
              : t.preferencesTitle;
}

function CredentialForm({
  t,
  busy,
  registration = false,
  showPassword,
  setShowPassword,
  onSubmit,
  children,
}: {
  t: (typeof copy)[Locale];
  busy: boolean;
  registration?: boolean;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  onSubmit: (loginName: string, password: string) => Promise<void>;
  children?: ReactNode;
}) {
  return (
    <form className="account-card" onSubmit={(event) => void submitCredentials(event, onSubmit)}>
      {registration ? <p>{t.registerHelp}</p> : null}
      <label>
        {t.loginName}
        <input name="loginName" autoComplete="username" required />
      </label>
      <label>
        {registration ? t.newPassword : t.password}
        <input
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={registration ? "new-password" : "current-password"}
          required
          minLength={8}
        />
      </label>
      {registration ? <p className="field-help">{t.passwordHelp}</p> : null}
      <label className="check-row">
        <input
          type="checkbox"
          checked={showPassword}
          onChange={(event) => setShowPassword(event.target.checked)}
        />
        {t.showPassword}
      </label>
      <button type="submit" disabled={busy}>
        {t.continue}
      </button>
      {children}
    </form>
  );
}

async function submitCredentials(
  event: FormEvent<HTMLFormElement>,
  action: (login: string, password: string) => Promise<void>,
) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    await action(String(data.get("loginName") ?? ""), String(data.get("password") ?? ""));
    event.currentTarget.reset();
  } catch {
    // Shared error summary owns all anonymous failure presentation.
  }
}

function FactorPanel({
  t,
  busy,
  challenge,
  manualSecret,
  recoveryCodes,
  mode,
  onVerify,
  onAcknowledge,
}: {
  t: (typeof copy)[Locale];
  busy: boolean;
  challenge: string;
  manualSecret: string;
  recoveryCodes: string[];
  mode: FactorMode;
  onVerify: (code: string) => Promise<void>;
  onAcknowledge: () => Promise<void>;
}) {
  if (!challenge)
    return (
      <div className="state-panel" role="status">
        {t.expired}
      </div>
    );
  return (
    <section className="account-card">
      {manualSecret ? (
        <div>
          <p>{t.manualSecret}</p>
          <code className="secret-display">{manualSecret}</code>
        </div>
      ) : null}
      {recoveryCodes.length ? (
        <>
          <p>{t.recoveryCodes}</p>
          <ul className="recovery-list">
            {recoveryCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
          <label className="check-row">
            <input form="ack-form" name="acknowledged" type="checkbox" required />
            {t.acknowledge}
          </label>
          <form
            id="ack-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onAcknowledge();
            }}
          >
            <button type="submit" disabled={busy}>
              {mode === "registration" ? t.continue : t.signIn}
            </button>
          </form>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void onVerify(String(data.get("code") ?? ""))
              .then(() => event.currentTarget.reset())
              .catch(() => undefined);
          }}
        >
          <label>
            {t.totp}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            {t.verify}
          </button>
        </form>
      )}
    </section>
  );
}

function RecoveryPanel({
  t,
  busy,
  mode,
  setMode,
  onSubmit,
}: {
  t: (typeof copy)[Locale];
  busy: boolean;
  mode: "password" | "factor";
  setMode: (mode: "password" | "factor") => void;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}) {
  return (
    <form
      className="account-card"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const values = Object.fromEntries(
          [...data.entries()].map(([key, value]) => [key, String(value)]),
        );
        void onSubmit(values)
          .then(() => event.currentTarget.reset())
          .catch(() => undefined);
      }}
    >
      <fieldset>
        <legend>{t.recoveryMode}</legend>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "password"}
            onChange={() => setMode("password")}
          />
          {t.passwordRecovery}
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "factor"}
            onChange={() => setMode("factor")}
          />
          {t.factorRecovery}
        </label>
      </fieldset>
      <label>
        {t.loginName}
        <input name="loginName" autoComplete="username" required />
      </label>
      {mode === "password" ? (
        <>
          <label>
            {t.currentFactor}
            <input
              name="totpCode"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
            />
          </label>
          <label>
            {t.newPassword}
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        </>
      ) : (
        <label>
          {t.password}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
      )}
      <label>
        {t.recoveryCode}
        <input name="recoveryCode" autoComplete="off" required />
      </label>
      <button type="submit" disabled={busy}>
        {t.continue}
      </button>
      <a href="/login">{t.back}</a>
    </form>
  );
}

function OnboardingPanel({
  t,
  busy,
  accountReady,
  onContinue,
  onLogout,
}: {
  t: (typeof copy)[Locale];
  busy: boolean;
  accountReady: boolean;
  onContinue: (intent: "coordinate" | "participate") => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [intent, setIntent] = useState<"coordinate" | "participate">("coordinate");
  return (
    <section className="account-card">
      <p>{accountReady ? t.accountReady : t.onboardingHelp}</p>
      <fieldset>
        <legend>{t.onboardingHelp}</legend>
        <label>
          <input
            type="radio"
            checked={intent === "coordinate"}
            onChange={() => setIntent("coordinate")}
          />
          {t.coordinate}
        </label>
        <label>
          <input
            type="radio"
            checked={intent === "participate"}
            onChange={() => setIntent("participate")}
          />
          {t.participate}
        </label>
      </fieldset>
      <div className="action-row">
        <button type="button" disabled={busy} onClick={() => void onContinue(intent)}>
          {t.continue}
        </button>
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={() => void onLogout()}
        >
          {t.signOut}
        </button>
      </div>
    </section>
  );
}

function PreferencesPanel({
  t,
  busy,
  locale,
  onSave,
}: {
  t: (typeof copy)[Locale];
  busy: boolean;
  locale: Locale;
  onSave: (preferences: {
    locale: Locale;
    textScale: "default" | "large";
    contrast: "system" | "more";
    motion: "system" | "reduce";
  }) => Promise<void>;
}) {
  return (
    <form
      className="account-card"
      onSubmit={(event) => {
        event.preventDefault();
        const d = new FormData(event.currentTarget);
        void onSave({
          locale,
          textScale: String(d.get("textScale")) as "default" | "large",
          contrast: String(d.get("contrast")) as "system" | "more",
          motion: String(d.get("motion")) as "system" | "reduce",
        });
      }}
    >
      <label>
        {t.textSize}
        <select name="textScale" defaultValue="default">
          <option value="default">{t.default}</option>
          <option value="large">{t.large}</option>
        </select>
      </label>
      <label>
        {t.contrast}
        <select name="contrast" defaultValue="system">
          <option value="system">{t.system}</option>
          <option value="more">{t.more}</option>
        </select>
      </label>
      <label>
        {t.motion}
        <select name="motion" defaultValue="system">
          <option value="system">{t.system}</option>
          <option value="reduce">{t.reduce}</option>
        </select>
      </label>
      <div className="preference-preview" aria-label={t.preferencesTitle}>
        {t.accountReady}
      </div>
      <div className="action-row">
        <button type="submit" disabled={busy}>
          {t.save}
        </button>
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={() =>
            void onSave({
              locale: "vi-VN",
              textScale: "default",
              contrast: "system",
              motion: "system",
            })
          }
        >
          {t.useDefaults}
        </button>
      </div>
    </form>
  );
}
