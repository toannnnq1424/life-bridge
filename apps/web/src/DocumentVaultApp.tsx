"use client";

import {
  DocumentMutationResultSchema,
  DocumentVaultProjectionSchema,
  IdentitySessionProjectionSchema,
  type DocumentProjection,
  type UploadDocumentRequest,
} from "@lifebridge/contracts";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

type Locale = "vi-VN" | "en";
type Phase =
  | "loading"
  | "ready"
  | "invalid"
  | "uploading"
  | "cancelling"
  | "confirmed"
  | "delete-confirmed"
  | "download-issued"
  | "rejected"
  | "processing-pending"
  | "processing-failed"
  | "conflict"
  | "uncertain"
  | "offline"
  | "denied"
  | "unavailable";

interface Props {
  householdId: string;
}

interface Failure {
  code: string;
}

interface PendingUpload {
  request: UploadDocumentRequest;
  idempotencyKey: string;
}

interface PendingDelete {
  documentId: string;
  expectedVaultVersion: number;
  expectedDocumentVersion: number;
  idempotencyKey: string;
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
    title: "Document vault",
    live: "Live server state — current document permission is checked again for every action.",
    offline:
      "Offline — no document metadata or bytes are shown. Upload, download, and deletion are blocked, not queued, and never submitted automatically.",
    authority:
      "Access: the care recipient and currently authorized document collaborators. Organizer or member status alone grants nothing.",
    retention:
      "Retention: kept until explicit deletion. Deletion immediately removes the active bytes and metadata. LifeBridge has no undo or user restore; recovery means re-uploading your local original.",
    scanner:
      "Malware scanner: not configured. A ready document is unscanned and is not claimed clean, safe, reviewed, or clinically valid.",
    chooseTitle: "Choose one permitted file",
    choose: "Text document",
    policy:
      "Exactly one .txt file declared as text/plain, strict UTF-8, from 1 through 262,144 bytes.",
    selected: "Selected local file",
    exactSize: "Exact size",
    upload: "Upload for validation",
    cancel: "Cancel upload",
    progress: "Actual upload progress",
    documents: "Authoritative documents",
    empty: "No documents are currently available in this authorized vault.",
    readyUnscanned: "Ready for attachment download — unscanned",
    processing: "Processing — download is not available",
    rejected: "Rejected — temporary bytes were removed",
    failed: "Processing failed — download is not available",
    integrityFailed: "Integrity check failed — bytes were removed and download is blocked",
    uploaded: "Server upload confirmed",
    processed: "Processing confirmed",
    type: "Verified type",
    size: "Exact bytes",
    version: "Document version",
    download: "Download attachment",
    remove: "Review deletion",
    deleteTitle: "Delete this active document?",
    deleteEffect:
      "Active bytes and metadata will be removed immediately. Only content-free evidence remains. There is no LifeBridge undo or server restore.",
    keep: "Keep document",
    confirmDelete: "Delete active copy",
    loading: "Loading current authorized vault…",
    invalid: "Correct the selected file before upload.",
    confirmed:
      "Upload confirmed. Strict text, size, digest, and object-binding checks passed; malware was not scanned.",
    deleteConfirmed:
      "Deletion confirmed. The active copy is gone. To recover it, choose and upload your local original.",
    downloadIssued:
      "The attachment response was issued. LifeBridge cannot confirm that your browser saved or opened it.",
    conflict:
      "The vault changed. Nothing else was submitted; load current authoritative state and review again.",
    uncertain:
      "The request result is uncertain. Do not retry blindly. Reconcile with a fresh authorized vault read.",
    denied: "This content does not exist or the current account lacks document-specific authority.",
    unavailable:
      "Document storage or a required service is unavailable. An empty vault is not inferred.",
    reconcile: "Check current state",
    noQueue: "No offline queue",
    nameError: "Choose a final .txt filename without path, control, or bidirectional marks.",
    typeError: "The browser must identify the selected file as text/plain.",
    sizeError: "Choose a file from 1 through 262,144 exact bytes.",
    state: "State",
  },
  "vi-VN": {
    skip: "Bỏ qua đến nội dung chính",
    language: "Ngôn ngữ",
    title: "Kho tài liệu",
    live: "Trạng thái trực tiếp từ máy chủ — quyền tài liệu hiện tại được kiểm tra lại cho mỗi thao tác.",
    offline:
      "Đang ngoại tuyến — không hiển thị siêu dữ liệu hoặc nội dung tài liệu. Tải lên, tải xuống và xóa đều bị chặn, không xếp hàng và không tự gửi.",
    authority:
      "Phạm vi truy cập: người nhận chăm sóc và cộng tác viên hiện được cấp quyền tài liệu. Chỉ vai trò người tổ chức hoặc thành viên không tạo quyền.",
    retention:
      "Lưu giữ: giữ đến khi xóa rõ ràng. Xóa sẽ loại bỏ ngay nội dung và siêu dữ liệu đang hoạt động. LifeBridge không có hoàn tác hoặc khôi phục cho người dùng; phục hồi nghĩa là tải lại bản gốc trên thiết bị của bạn.",
    scanner:
      "Trình quét mã độc: chưa cấu hình. Tài liệu sẵn sàng vẫn chưa được quét và không được tuyên bố sạch, an toàn, đã rà soát hoặc có giá trị lâm sàng.",
    chooseTitle: "Chọn một tệp được phép",
    choose: "Tài liệu văn bản",
    policy: "Đúng một tệp .txt được khai báo text/plain, UTF-8 nghiêm ngặt, từ 1 đến 262.144 byte.",
    selected: "Tệp cục bộ đã chọn",
    exactSize: "Kích thước chính xác",
    upload: "Tải lên để xác thực",
    cancel: "Hủy tải lên",
    progress: "Tiến độ tải lên thực tế",
    documents: "Tài liệu có thẩm quyền",
    empty: "Hiện không có tài liệu trong kho được cấp quyền này.",
    readyUnscanned: "Sẵn sàng tải xuống dạng tệp đính kèm — chưa quét",
    processing: "Đang xử lý — chưa thể tải xuống",
    rejected: "Bị từ chối — byte tạm thời đã được xóa",
    failed: "Xử lý thất bại — không thể tải xuống",
    integrityFailed: "Kiểm tra toàn vẹn thất bại — nội dung đã bị xóa và tải xuống bị chặn",
    uploaded: "Máy chủ xác nhận tải lên",
    processed: "Xác nhận xử lý",
    type: "Loại đã xác thực",
    size: "Số byte chính xác",
    version: "Phiên bản tài liệu",
    download: "Tải tệp đính kèm",
    remove: "Xem xét xóa",
    deleteTitle: "Xóa tài liệu đang hoạt động này?",
    deleteEffect:
      "Nội dung và siêu dữ liệu đang hoạt động sẽ bị xóa ngay. Chỉ bằng chứng không chứa nội dung được giữ lại. LifeBridge không có hoàn tác hoặc khôi phục máy chủ.",
    keep: "Giữ tài liệu",
    confirmDelete: "Xóa bản đang hoạt động",
    loading: "Đang tải kho được cấp quyền hiện tại…",
    invalid: "Hãy sửa tệp đã chọn trước khi tải lên.",
    confirmed:
      "Đã xác nhận tải lên. Kiểm tra văn bản, kích thước, bản tóm lược và liên kết đối tượng đã đạt; mã độc chưa được quét.",
    deleteConfirmed:
      "Đã xác nhận xóa. Bản đang hoạt động không còn. Để phục hồi, hãy chọn và tải lại bản gốc cục bộ.",
    downloadIssued:
      "Phản hồi tệp đính kèm đã được phát hành. LifeBridge không thể xác nhận trình duyệt đã lưu hoặc mở tệp.",
    conflict:
      "Kho đã thay đổi. Không có thao tác nào khác được gửi; hãy tải trạng thái có thẩm quyền và xem xét lại.",
    uncertain:
      "Kết quả yêu cầu chưa chắc chắn. Không thử lại mù quáng. Hãy đối soát bằng lần đọc kho mới được cấp quyền.",
    denied:
      "Nội dung này không tồn tại hoặc tài khoản hiện tại không có quyền cụ thể với tài liệu.",
    unavailable:
      "Kho lưu trữ tài liệu hoặc dịch vụ cần thiết chưa sẵn sàng. Không suy diễn đây là kho trống.",
    reconcile: "Kiểm tra trạng thái hiện tại",
    noQueue: "Không có hàng đợi ngoại tuyến",
    nameError:
      "Chọn tên tệp kết thúc bằng .txt, không chứa đường dẫn, ký tự điều khiển hoặc dấu hai chiều.",
    typeError: "Trình duyệt phải nhận diện tệp đã chọn là text/plain.",
    sizeError: "Chọn tệp có kích thước chính xác từ 1 đến 262.144 byte.",
    state: "Trạng thái",
  },
} as const;

export function DocumentVaultApp({ householdId }: Props) {
  const [locale, setLocale] = useState<Locale>("vi-VN");
  const [phase, setPhase] = useState<Phase>("loading");
  const [online, setOnline] = useState(true);
  const [csrf, setCsrf] = useState("");
  const [vaultVersion, setVaultVersion] = useState(1);
  const [documents, setDocuments] = useState<DocumentProjection[]>([]);
  const [selected, setSelected] = useState<File | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentProjection | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadMayHaveReachedServer = useRef(false);
  const pendingUpload = useRef<PendingUpload | null>(null);
  const pendingDelete = useRef<PendingDelete | null>(null);
  const statusHeading = useRef<HTMLHeadingElement>(null);
  const errorHeading = useRef<HTMLHeadingElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const text = copy[locale];

  useEffect(() => {
    const update = () => {
      const next = navigator.onLine;
      setOnline(next);
      if (!next) {
        xhrRef.current?.abort();
        setDocuments([]);
        setPhase("offline");
      }
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const load = useCallback(async () => {
    if (!navigator.onLine) {
      setDocuments([]);
      setPhase("offline");
      return;
    }
    setPhase("loading");
    setFailure(null);
    try {
      const [session, vault] = await Promise.all([
        api("/api/v1/account/session", IdentitySessionProjectionSchema),
        api(
          `/api/v1/households/${encodeURIComponent(householdId)}/documents`,
          DocumentVaultProjectionSchema,
        ),
      ]);
      setCsrf(session.csrfToken);
      setVaultVersion(vault.vaultVersion);
      setDocuments(vault.documents);
      const reconciled = pendingUpload.current
        ? vault.documents.some(
            (document) =>
              document.uploadReference === pendingUpload.current?.request.uploadReference,
          )
        : false;
      const deletionReconciled = pendingDelete.current
        ? !vault.documents.some(
            (document) => document.documentId === pendingDelete.current?.documentId,
          )
        : false;
      if (deletionReconciled) {
        pendingDelete.current = null;
        setDeleteTarget(null);
        setPhase("delete-confirmed");
      } else if (reconciled) {
        pendingUpload.current = null;
        setSelected(null);
        if (fileInput.current) fileInput.current.value = "";
        setProgress(100);
        setPhase("confirmed");
      } else {
        setPhase("ready");
      }
    } catch (error) {
      handleFailure(error, setFailure, setPhase);
      setDocuments([]);
    }
  }, [householdId]);

  useEffect(() => {
    if (online) void load();
  }, [load, online]);

  useEffect(() => {
    if (
      phase === "conflict" ||
      phase === "uncertain" ||
      phase === "denied" ||
      phase === "unavailable" ||
      phase === "rejected" ||
      phase === "processing-pending" ||
      phase === "processing-failed" ||
      phase === "delete-confirmed"
    ) {
      statusHeading.current?.focus();
    }
    if (phase === "invalid") errorHeading.current?.focus();
  }, [phase]);

  const selectFile = (file: File | null) => {
    pendingUpload.current = null;
    setSelected(file);
    setSelectionError("");
    setProgress(0);
    if (!file) return;
    const error = validateSelection(file, text);
    if (error) {
      setSelectionError(error);
      setPhase("invalid");
    } else {
      setPhase("ready");
    }
  };

  const upload = async () => {
    if (!selected || !online) return;
    const error = validateSelection(selected, text);
    if (error) {
      setSelectionError(error);
      setPhase("invalid");
      return;
    }
    let attempt = pendingUpload.current;
    if (!attempt) {
      let contentBase64: string;
      try {
        contentBase64 = await fileBase64(selected);
      } catch {
        setFailure({ code: "LOCAL_FILE_READ_FAILED" });
        setPhase("unavailable");
        return;
      }
      attempt = {
        request: {
          uploadReference: `upload_${crypto.randomUUID().replaceAll("-", "")}`,
          fileName: selected.name,
          declaredType: "text/plain",
          decodedSizeBytes: selected.size,
          contentBase64,
        },
        idempotencyKey: crypto.randomUUID(),
      };
      pendingUpload.current = attempt;
    }
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    uploadMayHaveReachedServer.current = false;
    setProgress(0);
    setPhase("uploading");
    xhr.open("POST", `/api/v1/households/${encodeURIComponent(householdId)}/documents`, true);
    xhr.withCredentials = true;
    xhr.timeout = 15_000;
    xhr.setRequestHeader("content-type", "application/json");
    xhr.setRequestHeader("x-csrf-token", csrf);
    xhr.setRequestHeader("x-requested-with", "XMLHttpRequest");
    xhr.setRequestHeader("idempotency-key", attempt.idempotencyKey);
    xhr.setRequestHeader("x-correlation-id", `web_${crypto.randomUUID().replaceAll("-", "")}`);
    xhr.upload.addEventListener("progress", (event) => {
      uploadMayHaveReachedServer.current = event.loaded > 0;
      if (event.lengthComputable) {
        setProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });
    xhr.addEventListener("load", () => {
      xhrRef.current = null;
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        setPhase("uncertain");
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = DocumentMutationResultSchema.parse((body as { data?: unknown }).data);
          setVaultVersion(result.vaultVersion);
          if (result.document) {
            setDocuments((current) => [
              result.document!,
              ...current.filter((document) => document.documentId !== result.document!.documentId),
            ]);
          }
          setSelected(null);
          pendingUpload.current = null;
          if (fileInput.current) fileInput.current.value = "";
          setProgress(100);
          setPhase("confirmed");
        } catch {
          setPhase("uncertain");
        }
      } else {
        if (xhr.status < 500) pendingUpload.current = null;
        const responseFailure = failureFromBody(body);
        if (isUploadRejection(responseFailure.code)) {
          setSelected(null);
          if (fileInput.current) fileInput.current.value = "";
        }
        handleFailureBody(body, xhr.status >= 500, setFailure, setPhase);
      }
    });
    xhr.addEventListener("error", () => {
      xhrRef.current = null;
      if (!uploadMayHaveReachedServer.current) pendingUpload.current = null;
      setPhase(
        !navigator.onLine
          ? "offline"
          : uploadMayHaveReachedServer.current
            ? "uncertain"
            : "unavailable",
      );
    });
    xhr.addEventListener("timeout", () => {
      xhrRef.current = null;
      setPhase("uncertain");
    });
    xhr.addEventListener("abort", () => {
      xhrRef.current = null;
      if (!uploadMayHaveReachedServer.current) pendingUpload.current = null;
      setPhase(
        !navigator.onLine ? "offline" : uploadMayHaveReachedServer.current ? "uncertain" : "ready",
      );
    });
    try {
      uploadMayHaveReachedServer.current = true;
      xhr.send(JSON.stringify(attempt.request));
    } catch {
      xhrRef.current = null;
      uploadMayHaveReachedServer.current = false;
      pendingUpload.current = null;
      setFailure({ code: "NETWORK_UNAVAILABLE" });
      setPhase("unavailable");
    }
  };

  const cancelUpload = () => {
    if (!xhrRef.current) return;
    setPhase("cancelling");
    xhrRef.current.abort();
  };

  const download = async (document: DocumentProjection) => {
    try {
      const response = await fetch(
        `/api/v1/households/${encodeURIComponent(householdId)}/documents/${encodeURIComponent(document.documentId)}/content`,
        {
          credentials: "same-origin",
          headers: {
            "x-correlation-id": `web_${crypto.randomUUID().replaceAll("-", "")}`,
          },
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiFailure(
          (body as { error?: Failure } | null)?.error ?? {
            code: "DOCUMENT_STORAGE_UNAVAILABLE",
          },
          false,
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.displayName;
      anchor.rel = "noopener";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setPhase("download-issued");
    } catch (error) {
      handleFailure(error, setFailure, setPhase);
    }
  };

  const reviewDelete = (document: DocumentProjection) => {
    if (
      pendingDelete.current &&
      (pendingDelete.current.documentId !== document.documentId ||
        pendingDelete.current.expectedVaultVersion !== vaultVersion ||
        pendingDelete.current.expectedDocumentVersion !== document.version)
    ) {
      pendingDelete.current = null;
    }
    setDeleteTarget(document);
    deleteDialog.current?.showModal();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const attempt =
      pendingDelete.current ??
      ({
        documentId: deleteTarget.documentId,
        expectedVaultVersion: vaultVersion,
        expectedDocumentVersion: deleteTarget.version,
        idempotencyKey: crypto.randomUUID(),
      } satisfies PendingDelete);
    pendingDelete.current = attempt;
    deleteDialog.current?.close();
    try {
      const result = await api(
        `/api/v1/households/${encodeURIComponent(householdId)}/documents/${encodeURIComponent(deleteTarget.documentId)}`,
        DocumentMutationResultSchema,
        {
          method: "DELETE",
          headers: mutationHeaders(csrf, attempt.idempotencyKey),
          body: JSON.stringify({
            expectedVaultVersion: attempt.expectedVaultVersion,
            expectedDocumentVersion: attempt.expectedDocumentVersion,
          }),
        },
      );
      setVaultVersion(result.vaultVersion);
      setDocuments((current) =>
        current.filter((document) => document.documentId !== deleteTarget.documentId),
      );
      setDeleteTarget(null);
      pendingDelete.current = null;
      setPhase("delete-confirmed");
    } catch (error) {
      if (!(error instanceof ApiFailure && error.uncertain)) {
        pendingDelete.current = null;
      }
      handleFailure(error, setFailure, setPhase);
    }
  };

  const showAuthoritativeVault =
    phase !== "loading" &&
    phase !== "conflict" &&
    phase !== "uncertain" &&
    phase !== "processing-pending" &&
    phase !== "processing-failed" &&
    phase !== "offline" &&
    phase !== "denied" &&
    phase !== "unavailable";

  return (
    <div className="document-vault-app">
      <a className="skip-link" href="#document-vault-main">
        {text.skip}
      </a>
      <header className="document-vault-header">
        <a className="brand" href={`/households/${encodeURIComponent(householdId)}`}>
          LifeBridge
        </a>
        <label>
          {text.language}
          <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="vi-VN">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <main id="document-vault-main" className="document-vault-main">
        <h1>{text.title}</h1>
        <section className={`source-banner ${online ? "source-live" : "source-offline"}`}>
          <h2>{online ? "● Live / Trực tiếp" : "◇ Offline / Ngoại tuyến"}</h2>
          <p>{online ? text.live : text.offline}</p>
        </section>
        <section className="vault-boundary" aria-labelledby="document-vault-boundary-title">
          <h2 id="document-vault-boundary-title">
            Access, retention and processing / Truy cập, lưu giữ và xử lý
          </h2>
          <p>{text.authority}</p>
          <p>{text.retention}</p>
          <p>{text.scanner}</p>
        </section>

        <StatePanel
          phase={phase}
          text={text}
          headingRef={statusHeading}
          failure={failure}
          onReconcile={() => void load()}
        />

        {showAuthoritativeVault ? (
          <section className="vault-panel" aria-labelledby="document-upload-title">
            <h2 id="document-upload-title">{text.chooseTitle}</h2>
            <p>{text.policy}</p>
            {selectionError ? (
              <div className="error-summary" role="alert">
                <h3 ref={errorHeading} tabIndex={-1}>
                  {text.invalid}
                </h3>
                <a href="#document-file">{selectionError}</a>
              </div>
            ) : null}
            <label className="field" htmlFor="document-file">
              {text.choose}
              <input
                id="document-file"
                ref={fileInput}
                type="file"
                accept=".txt,text/plain"
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                disabled={phase === "uploading" || phase === "cancelling" || !online}
              />
            </label>
            {selected ? (
              <dl className="facts selected-file">
                <dt>{text.selected}</dt>
                <dd>{selected.name}</dd>
                <dt>{text.type}</dt>
                <dd>{selected.type || "—"}</dd>
                <dt>{text.exactSize}</dt>
                <dd>{selected.size.toLocaleString(locale)} bytes</dd>
              </dl>
            ) : null}
            {phase === "uploading" || phase === "cancelling" ? (
              <div className="upload-progress">
                <label htmlFor="document-progress">{text.progress}</label>
                <progress id="document-progress" max={100} value={progress}>
                  {progress}%
                </progress>
                <p role="status" aria-live="polite">
                  {progress}%
                </p>
                <button type="button" onClick={cancelUpload}>
                  {text.cancel}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void upload()}
                disabled={!selected || Boolean(selectionError) || !online}
              >
                {text.upload}
              </button>
            )}
          </section>
        ) : null}

        {showAuthoritativeVault ? (
          <section className="vault-panel" aria-labelledby="document-list-title">
            <h2 id="document-list-title">{text.documents}</h2>
            {documents.length === 0 ? (
              <p className="empty-state">{text.empty}</p>
            ) : (
              <ul className="document-list">
                {documents.map((document) => (
                  <DocumentCard
                    key={document.documentId}
                    document={document}
                    text={text}
                    locale={locale}
                    online={online}
                    onDownload={() => void download(document)}
                    onDelete={() => reviewDelete(document)}
                  />
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </main>
      <dialog
        ref={deleteDialog}
        aria-labelledby="delete-document-title"
        onClose={() => setDeleteTarget(null)}
      >
        <h2 id="delete-document-title">{text.deleteTitle}</h2>
        {deleteTarget ? <p className="document-name">{deleteTarget.displayName}</p> : null}
        <p>{text.deleteEffect}</p>
        <div className="button-row">
          <button type="button" onClick={() => deleteDialog.current?.close()}>
            {text.keep}
          </button>
          <button type="button" className="danger-button" onClick={() => void confirmDelete()}>
            {text.confirmDelete}
          </button>
        </div>
      </dialog>
      <footer className="document-vault-footer">
        <p>{text.scanner}</p>
      </footer>
    </div>
  );
}

function DocumentCard(props: {
  document: DocumentProjection;
  text: (typeof copy)[Locale];
  locale: Locale;
  online: boolean;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const { document, text, locale, online, onDownload, onDelete } = props;
  const stateText =
    document.processingState === "ready_unscanned"
      ? text.readyUnscanned
      : document.processingState === "processing"
        ? text.processing
        : document.processingState === "rejected"
          ? text.rejected
          : document.processingState === "integrity_failed"
            ? text.integrityFailed
            : text.failed;
  return (
    <li>
      <article className={`document-card state-${document.processingState}`}>
        <h3>{document.displayName}</h3>
        <p className="document-state">
          <span aria-hidden="true">
            {document.processingState === "ready_unscanned" ? "◇" : "!"}
          </span>{" "}
          {stateText}
        </p>
        <dl className="facts">
          <dt>{text.state}</dt>
          <dd>{document.processingState}</dd>
          <dt>{text.type}</dt>
          <dd>{document.verifiedType}</dd>
          <dt>{text.size}</dt>
          <dd>{document.sizeBytes.toLocaleString(locale)}</dd>
          <dt>{text.version}</dt>
          <dd>{document.version}</dd>
          <dt>{text.uploaded}</dt>
          <dd>
            <time dateTime={document.uploadedAt}>
              {new Date(document.uploadedAt).toLocaleString(locale)}
            </time>
          </dd>
          <dt>{text.processed}</dt>
          <dd>
            {document.processingConfirmedAt ? (
              <time dateTime={document.processingConfirmedAt}>
                {new Date(document.processingConfirmedAt).toLocaleString(locale)}
              </time>
            ) : (
              "—"
            )}
          </dd>
        </dl>
        <div className="button-row">
          <button
            type="button"
            onClick={onDownload}
            disabled={!online || document.processingState !== "ready_unscanned"}
          >
            {text.download}
          </button>
          <button type="button" className="danger-button" onClick={onDelete} disabled={!online}>
            {text.remove}
          </button>
        </div>
      </article>
    </li>
  );
}

function StatePanel(props: {
  phase: Phase;
  text: (typeof copy)[Locale];
  headingRef: RefObject<HTMLHeadingElement | null>;
  failure: Failure | null;
  onReconcile: () => void;
}) {
  const { phase, text, headingRef, failure, onReconcile } = props;
  if (phase === "ready" || phase === "invalid" || phase === "uploading" || phase === "cancelling") {
    return null;
  }
  const message =
    phase === "loading"
      ? text.loading
      : phase === "confirmed"
        ? text.confirmed
        : phase === "delete-confirmed"
          ? text.deleteConfirmed
          : phase === "download-issued"
            ? text.downloadIssued
            : phase === "rejected"
              ? text.rejected
              : phase === "processing-pending"
                ? text.processing
                : phase === "processing-failed"
                  ? failure?.code === "DOCUMENT_INTEGRITY_FAILED"
                    ? text.integrityFailed
                    : text.failed
                  : phase === "conflict"
                    ? text.conflict
                    : phase === "uncertain"
                      ? text.uncertain
                      : phase === "offline"
                        ? text.offline
                        : phase === "denied"
                          ? text.denied
                          : phase === "unavailable"
                            ? text.unavailable
                            : text.loading;
  return (
    <section className={`state-panel state-${phase}`} aria-live="polite">
      <h2 ref={headingRef} tabIndex={-1}>
        {message}
      </h2>
      {failure ? <p className="failure-code">{failure.code}</p> : null}
      {phase === "conflict" ||
      phase === "uncertain" ||
      phase === "unavailable" ||
      phase === "processing-pending" ||
      phase === "processing-failed" ? (
        <button type="button" onClick={onReconcile}>
          {text.reconcile}
        </button>
      ) : null}
      {phase === "offline" ? <p>{text.noQueue}</p> : null}
    </section>
  );
}

function validateSelection(file: File, text: (typeof copy)[Locale]): string {
  if (
    !file.name.toLowerCase().endsWith(".txt") ||
    hasForbiddenFileNameCharacter(file.name) ||
    file.name.startsWith(".") ||
    file.name.includes("..")
  ) {
    return text.nameError;
  }
  if (file.type !== "text/plain") return text.typeError;
  if (file.size < 1 || file.size > 262_144) return text.sizeError;
  return "";
}

function hasForbiddenFileNameCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0)!;
    return (
      character === "/" ||
      character === "\\" ||
      character === ":" ||
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    );
  });
}

async function fileBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
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
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiFailure(
      (body as { error?: Failure } | null)?.error ?? { code: "SERVICE_UNAVAILABLE" },
      Boolean(init?.method) && response.status >= 500,
    );
  }
  return schema.parse((body as { data?: unknown }).data);
}

function mutationHeaders(
  csrf: string,
  idempotencyKey = crypto.randomUUID(),
): Record<string, string> {
  return {
    "x-csrf-token": csrf,
    "x-requested-with": "fetch",
    "idempotency-key": idempotencyKey,
  };
}

function handleFailureBody(
  body: unknown,
  uncertain: boolean,
  setFailure: (value: Failure | null) => void,
  setPhase: (value: Phase) => void,
) {
  handleFailure(new ApiFailure(failureFromBody(body), uncertain), setFailure, setPhase);
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
  } else if (isUploadRejection(failure.code)) {
    setPhase("rejected");
  } else if (failure.code === "DOCUMENT_PROCESSING_PENDING") {
    setPhase("processing-pending");
  } else if (
    failure.code === "DOCUMENT_PROCESSING_FAILED" ||
    failure.code === "DOCUMENT_INTEGRITY_FAILED"
  ) {
    setPhase("processing-failed");
  } else if (failure.code === "DOCUMENT_CAPACITY_REACHED") {
    setPhase("conflict");
  } else if (failure.code.includes("CONFLICT")) {
    setPhase("conflict");
  } else if (error instanceof ApiFailure && error.uncertain) {
    setPhase("uncertain");
  } else {
    setPhase("unavailable");
  }
}

function failureFromBody(body: unknown): Failure {
  return (body as { error?: Failure } | null)?.error ?? { code: "SERVICE_UNAVAILABLE" };
}

function isUploadRejection(code: string): boolean {
  return (
    code === "DOCUMENT_VALIDATION_FAILED" ||
    code === "DOCUMENT_TYPE_UNSUPPORTED" ||
    code === "DOCUMENT_TOO_LARGE" ||
    code === "DOCUMENT_CONTENT_REJECTED"
  );
}
