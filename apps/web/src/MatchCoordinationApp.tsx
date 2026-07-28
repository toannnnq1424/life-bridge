"use client";

import { useCallback, useEffect, useState } from "react";

type Locale = "vi-VN" | "en";
type View = "volunteer" | "coordinator";
type Phase =
  | "loading"
  | "ready"
  | "empty"
  | "denied"
  | "revoked"
  | "expired"
  | "conflict"
  | "no-capacity"
  | "uncertain"
  | "offline"
  | "partial"
  | "unavailable";

interface Projection {
  matchId: string;
  category: string;
  provinceCityCode: string;
  serviceDate?: string;
  dayPart?: string;
  state: string;
  version: number;
  offerId?: string;
  nextActions?: string[];
  approvalExpiresAt?: string;
  offerExpiresAt?: string;
  capacityState?: "available" | "reserved" | "full" | "unknown";
  progress?: string[];
  minimumDisclosure?: boolean;
}

const copy = {
  en: {
    skip: "Skip to coordination content",
    matching: "Volunteer matching",
    organization: "Organization coordination",
    purpose:
      "Use only the minimum disclosed fields needed to coordinate an organization-approved match.",
    authority:
      "A role is not consent or authority. Every protected read or action needs a fresh, request-bound, purpose-scoped Identity & Consent decision.",
    evidence:
      "Identity authority, organization approval, care-recipient consent, and volunteer capacity are separate expiring and revocable evidence.",
    loading: "Checking fresh authority and authoritative Community state…",
    empty: "No match is available in this authorized scope.",
    unavailable:
      "Authoritative Community state is unavailable. Nothing is shown as accepted, assigned, recorded, or closed.",
    offline: "Offline: protected actions are blocked and are not queued on this device.",
    uncertain:
      "The result is uncertain after dispatch. Do not repeat the action; check authoritative current state.",
    denied: "Access denied. Protected match details have been removed.",
    revoked: "Authority or approval was revoked during the action. Protected details are hidden.",
    expired: "The approval or offer expired. Refresh authority and current state before deciding.",
    conflict: "The match changed. Review the current version before making a new decision.",
    capacity: "No capacity exists for this service date and day-part.",
    partial: "Some organization aggregates are unavailable; missing values are not shown as zero.",
    refresh: "Check current state",
    queue: "Authorized match queue",
    detail: "Minimum-disclosure match detail",
    evidenceTitle: "Separate evidence required",
    actions: "Permitted actions",
    accept: "Accept offer",
    decline: "Decline offer",
    assign: "Assign",
    reassign: "Reassign",
    progress: "Record structured progress",
    close: "Close match",
    closeOnly: "Only a coordinator may close. Volunteer progress is append-only.",
    noClaim:
      "No automatic dispatch. An action is not successful until Community returns authoritative evidence.",
    date: "Service date",
    part: "Day-part",
    category: "Support category",
    area: "Coarse service area",
    state: "Authoritative state",
    version: "Version",
    approval: "Approval expires",
    offer: "Offer expires",
    capacityLabel: "Capacity for date and day-part",
    progressTitle: "Append-only progress",
    language: "Language",
  },
  "vi-VN": {
    skip: "Chuyển đến nội dung điều phối",
    matching: "Ghép nối tình nguyện viên",
    organization: "Điều phối tổ chức",
    purpose:
      "Chỉ dùng các trường tối thiểu đã được phép tiết lộ để điều phối một ghép nối do tổ chức phê duyệt.",
    authority:
      "Vai trò không phải là đồng thuận hay thẩm quyền. Mỗi lần đọc hoặc hành động được bảo vệ cần quyết định Danh tính & Đồng thuận mới, gắn với yêu cầu và đúng mục đích.",
    evidence:
      "Thẩm quyền danh tính, phê duyệt tổ chức, đồng thuận của người nhận chăm sóc và năng lực tình nguyện viên là các bằng chứng riêng, có hạn và có thể thu hồi.",
    loading: "Đang kiểm tra thẩm quyền mới và trạng thái Cộng đồng có thẩm quyền…",
    empty: "Không có ghép nối trong phạm vi được phép này.",
    unavailable:
      "Không lấy được trạng thái Cộng đồng có thẩm quyền. Không nội dung nào được coi là đã chấp nhận, phân công, ghi nhận hoặc đóng.",
    offline: "Ngoại tuyến: hành động được bảo vệ bị chặn và không được xếp hàng trên thiết bị.",
    uncertain:
      "Kết quả chưa chắc chắn sau khi gửi. Không lặp lại hành động; hãy kiểm tra trạng thái hiện tại có thẩm quyền.",
    denied: "Truy cập bị từ chối. Chi tiết ghép nối được bảo vệ đã bị ẩn.",
    revoked:
      "Thẩm quyền hoặc phê duyệt bị thu hồi trong khi thao tác. Chi tiết được bảo vệ đã bị ẩn.",
    expired:
      "Phê duyệt hoặc đề nghị đã hết hạn. Hãy làm mới thẩm quyền và trạng thái trước khi quyết định.",
    conflict: "Ghép nối đã thay đổi. Hãy xem phiên bản hiện tại trước khi quyết định lại.",
    capacity: "Không còn năng lực cho ngày phục vụ và buổi này.",
    partial:
      "Một phần tổng hợp tổ chức không khả dụng; giá trị thiếu không được hiển thị là số không.",
    refresh: "Kiểm tra trạng thái hiện tại",
    queue: "Hàng đợi ghép nối được phép",
    detail: "Chi tiết ghép nối tiết lộ tối thiểu",
    evidenceTitle: "Các bằng chứng riêng bắt buộc",
    actions: "Hành động được phép",
    accept: "Chấp nhận đề nghị",
    decline: "Từ chối đề nghị",
    assign: "Phân công",
    reassign: "Phân công lại",
    progress: "Ghi tiến độ có cấu trúc",
    close: "Đóng ghép nối",
    closeOnly: "Chỉ điều phối viên được đóng. Tiến độ tình nguyện viên chỉ được ghi nối tiếp.",
    noClaim:
      "Không tự động điều phối. Hành động chưa thành công cho đến khi Cộng đồng trả bằng chứng có thẩm quyền.",
    date: "Ngày phục vụ",
    part: "Buổi",
    category: "Loại hỗ trợ",
    area: "Khu vực phục vụ tổng quát",
    state: "Trạng thái có thẩm quyền",
    version: "Phiên bản",
    approval: "Phê duyệt hết hạn",
    offer: "Đề nghị hết hạn",
    capacityLabel: "Năng lực theo ngày và buổi",
    progressTitle: "Tiến độ chỉ ghi nối tiếp",
    language: "Ngôn ngữ",
  },
} as const;

function phaseForStatus(status: number, code?: string): Phase {
  if (status === 401 || status === 403) return "denied";
  if (code?.includes("REVOKED")) return "revoked";
  if (code?.includes("EXPIRED")) return "expired";
  if (code?.includes("NO_CAPACITY")) return "no-capacity";
  if (code?.includes("RESULT_UNKNOWN")) return "uncertain";
  if (code?.includes("CONFLICT") || status === 409) return "conflict";
  return "unavailable";
}

export function MatchCoordinationApp({
  view,
  householdId,
  organizationId,
}: {
  view: View;
  householdId: string;
  organizationId: string;
}) {
  const [locale, setLocale] = useState<Locale>("vi-VN");
  const [phase, setPhase] = useState<Phase>("loading");
  const [matches, setMatches] = useState<Projection[]>([]);
  const [selected, setSelected] = useState<Projection | null>(null);
  const [csrf, setCsrf] = useState("");
  const text = copy[locale];

  const load = useCallback(async () => {
    if (!householdId || !organizationId) {
      setPhase("denied");
      return;
    }
    if (!navigator.onLine) {
      setPhase("offline");
      setMatches([]);
      setSelected(null);
      return;
    }
    setPhase("loading");
    try {
      const sessionResponse = await fetch("/api/v1/session", { cache: "no-store" });
      const sessionBody = (await sessionResponse.json()) as { data?: { csrfToken?: string } };
      const csrfToken = sessionBody.data?.csrfToken ?? "";
      if (!sessionResponse.ok || !csrfToken) {
        setPhase("denied");
        return;
      }
      setCsrf(csrfToken);
      const endpoint =
        view === "volunteer"
          ? "/api/v1/community/matches/volunteer/query"
          : "/api/v1/community/matches/organization/query";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ householdId, organizationId }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        matches?: Projection[];
        partial?: boolean;
        error?: { code?: string };
      };
      if (!response.ok) {
        setMatches([]);
        setSelected(null);
        setPhase(phaseForStatus(response.status, body.error?.code));
        return;
      }
      const authorized = (body.matches ?? []).filter((match) => match.minimumDisclosure !== false);
      setMatches(authorized);
      setSelected(authorized[0] ?? null);
      setPhase(body.partial ? "partial" : authorized.length ? "ready" : "empty");
    } catch {
      setMatches([]);
      setSelected(null);
      setPhase("unavailable");
    }
  }, [householdId, organizationId, view]);

  const act = useCallback(
    async (action: "accept" | "decline" | "progress" | "close") => {
      if (!selected || !csrf || !navigator.onLine) {
        setPhase("offline");
        return;
      }
      const submissionReference = `matchcmd_${crypto.randomUUID().replaceAll("-", "")}`;
      const common = {
        householdId,
        organizationId,
        submissionReference,
        expectedVersion: selected.version,
      };
      const routeAction =
        action === "accept" || action === "decline"
          ? "respond"
          : action === "progress"
            ? "record-progress"
            : "close";
      const intent =
        action === "accept" || action === "decline"
          ? {
              ...common,
              offerId: selected.offerId,
              expectedOfferVersion: 1,
              response: action === "accept" ? "accepted" : "declined",
            }
          : action === "progress"
            ? { ...common, checkpoint: "arrangements_confirmed" }
            : { ...common, reason: "support_completed" };
      if ((action === "accept" || action === "decline") && !selected.offerId) {
        setPhase("conflict");
        return;
      }
      try {
        const response = await fetch(
          `/api/v1/community/matches/${encodeURIComponent(selected.matchId)}/${routeAction}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-csrf-token": csrf,
              "idempotency-key": submissionReference,
            },
            body: JSON.stringify(intent),
          },
        );
        const body = (await response.json()) as {
          matches?: Projection[];
          error?: { code?: string };
        };
        if (!response.ok) {
          setPhase(phaseForStatus(response.status, body.error?.code));
          return;
        }
        const authoritative = body.matches?.[0];
        if (!authoritative) {
          setPhase("unavailable");
          return;
        }
        setMatches((items) =>
          items.map((item) => (item.matchId === authoritative.matchId ? authoritative : item)),
        );
        setSelected(authoritative);
        setPhase("ready");
      } catch {
        setPhase("uncertain");
      }
    },
    [csrf, householdId, organizationId, selected],
  );

  useEffect(() => void load(), [load]);
  useEffect(() => {
    const offline = () => setPhase("offline");
    const online = () => void load();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, [load]);

  const stateMessage: Partial<Record<Phase, string>> = {
    loading: text.loading,
    empty: text.empty,
    denied: text.denied,
    revoked: text.revoked,
    expired: text.expired,
    conflict: text.conflict,
    "no-capacity": text.capacity,
    uncertain: text.uncertain,
    offline: text.offline,
    partial: text.partial,
    unavailable: text.unavailable,
  };

  return (
    <div className="match-app">
      <a className="skip-link" href="#match-main">
        {text.skip}
      </a>
      <header className="match-header">
        <div>
          <p className="match-kicker">{view === "volunteer" ? "LB-025" : "LB-026"}</p>
          <h1>{view === "volunteer" ? text.matching : text.organization}</h1>
        </div>
        <label>
          {text.language}
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>

      <main id="match-main" className="match-main">
        <section className="match-boundary" aria-labelledby="match-purpose">
          <h2 id="match-purpose">{text.purpose}</h2>
          <p>{text.authority}</p>
          <p>{text.evidence}</p>
          <button type="button" onClick={() => void load()}>
            {text.refresh}
          </button>
        </section>

        {phase !== "ready" && (
          <section className={`match-state state-${phase}`} role="status" aria-live="polite">
            <h2>{stateMessage[phase]}</h2>
            {phase !== "loading" && (
              <button type="button" onClick={() => void load()}>
                {text.refresh}
              </button>
            )}
          </section>
        )}

        {(phase === "ready" || phase === "partial") && (
          <div className="match-workspace">
            <section aria-labelledby="match-queue">
              <h2 id="match-queue">{text.queue}</h2>
              <ul className="match-list">
                {matches.map((match) => (
                  <li key={match.matchId}>
                    <button
                      type="button"
                      aria-pressed={selected?.matchId === match.matchId}
                      onClick={() => setSelected(match)}
                    >
                      <strong>{match.matchId}</strong>
                      <span>{match.category}</span>
                      <span>{match.state}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {selected && (
              <section className="match-detail" aria-labelledby="match-detail">
                <h2 id="match-detail">{text.detail}</h2>
                <dl>
                  <dt>{text.category}</dt>
                  <dd>{selected.category}</dd>
                  <dt>{text.area}</dt>
                  <dd>{selected.provinceCityCode}</dd>
                  <dt>{text.date}</dt>
                  <dd>{selected.serviceDate ?? "—"}</dd>
                  <dt>{text.part}</dt>
                  <dd>{selected.dayPart ?? "—"}</dd>
                  <dt>{text.state}</dt>
                  <dd>{selected.state}</dd>
                  <dt>{text.version}</dt>
                  <dd>{selected.version}</dd>
                  <dt>{text.approval}</dt>
                  <dd>{selected.approvalExpiresAt ?? "—"}</dd>
                  <dt>{text.offer}</dt>
                  <dd>{selected.offerExpiresAt ?? "—"}</dd>
                  <dt>{text.capacityLabel}</dt>
                  <dd>{selected.capacityState ?? "unknown"}</dd>
                </dl>

                <section className="match-evidence" aria-labelledby="match-evidence">
                  <h3 id="match-evidence">{text.evidenceTitle}</h3>
                  <ul>
                    <li>Identity &amp; Consent: exact action scope</li>
                    <li>Organization approval: maximum 30 days</li>
                    <li>Volunteer capacity: service date + day-part</li>
                    <li>Care-recipient consent: current and revocable</li>
                    <li>Offer: maximum 7 days</li>
                  </ul>
                </section>

                <section aria-labelledby="match-actions">
                  <h3 id="match-actions">{text.actions}</h3>
                  <div className="match-actions">
                    {view === "volunteer" ? (
                      <>
                        <button
                          type="button"
                          disabled={!selected.nextActions?.includes("accept")}
                          onClick={() => void act("accept")}
                        >
                          {text.accept}
                        </button>
                        <button
                          type="button"
                          disabled={!selected.nextActions?.includes("decline")}
                          onClick={() => void act("decline")}
                        >
                          {text.decline}
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" disabled>
                          {text.assign}
                        </button>
                        <button type="button" disabled>
                          {text.reassign}
                        </button>
                        <button
                          type="button"
                          disabled={!selected.nextActions?.includes("close")}
                          onClick={() => void act("close")}
                        >
                          {text.close}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={!selected.nextActions?.includes("record_progress")}
                      onClick={() => void act("progress")}
                    >
                      {text.progress}
                    </button>
                  </div>
                  <p>{text.closeOnly}</p>
                  <p>{text.noClaim}</p>
                </section>

                <section aria-labelledby="match-progress">
                  <h3 id="match-progress">{text.progressTitle}</h3>
                  {selected.progress?.length ? (
                    <ol>
                      {selected.progress.map((entry, index) => (
                        <li key={`${entry}-${index}`}>{entry}</li>
                      ))}
                    </ol>
                  ) : (
                    <p>—</p>
                  )}
                </section>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
