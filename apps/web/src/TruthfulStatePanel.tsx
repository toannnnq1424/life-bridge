"use client";

import { type ReactNode, type RefObject } from "react";

export type TruthfulUiState =
  | "stale"
  | "queued"
  | "blocked"
  | "conflicted"
  | "rejected"
  | "dependency_failed"
  | "uncertain"
  | "reconciling"
  | "confirmed";

const copy = {
  "vi-VN": {
    stale: "Dữ liệu có thể đã cũ. Hãy tải trạng thái hiện tại trước khi thay đổi.",
    queued: "Đã giữ yêu cầu trong tab này; chưa gửi và chưa lưu trên máy chủ.",
    blocked: "Đang ngoại tuyến. Thao tác bị chặn và không được tự động gửi lại.",
    conflicted: "Trạng thái đã thay đổi. Không ghi đè; hãy xem phiên bản hiện tại.",
    rejected: "Yêu cầu không được chấp nhận. Không có thay đổi nào được xác nhận.",
    dependency_failed:
      "Một dịch vụ cần thiết không khả dụng. Dữ liệu đã xác nhận vẫn được giữ nguyên.",
    uncertain: "Có thể yêu cầu đã đến máy chủ. Không thử lại; cần đối soát.",
    reconciling: "Đang đọc trạng thái có thẩm quyền; chưa xác nhận kết quả.",
    confirmed: "Máy chủ đã xác nhận thay đổi với phiên bản và thời điểm mới.",
  },
  en: {
    stale: "This data may be stale. Load current state before changing it.",
    queued: "Held in this tab; not sent and not saved by the server.",
    blocked: "Offline. This action is blocked and will not be submitted automatically.",
    conflicted: "State changed. Nothing was overwritten; review the current version.",
    rejected: "The request was rejected. No change is confirmed.",
    dependency_failed: "A required service is unavailable. Confirmed data remains unchanged.",
    uncertain: "The request may have reached the server. Do not retry; reconcile first.",
    reconciling: "Reading authoritative state; the result is not yet confirmed.",
    confirmed: "The server confirmed the change with a new version and timestamp.",
  },
} as const;

export function TruthfulStatePanel({
  state,
  locale,
  headingRef,
  details,
  children,
}: {
  state: TruthfulUiState;
  locale: "vi-VN" | "en";
  headingRef?: RefObject<HTMLHeadingElement | null>;
  details?: string | undefined;
  children?: ReactNode;
}) {
  const urgent = ["conflicted", "rejected", "dependency_failed", "uncertain"].includes(state);
  return (
    <section
      className={`truthful-state truthful-state-${state}`}
      aria-live={urgent ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <h3 ref={headingRef} tabIndex={-1}>
        <span aria-hidden="true">{urgent ? "!" : "i"}</span> {copy[locale][state]}
      </h3>
      {details ? <p>{details}</p> : null}
      {children}
    </section>
  );
}
