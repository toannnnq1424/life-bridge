const DB_NAME = "lifebridge-emergency-offline-v1";
const STORE_NAME = "encrypted-snapshots";
const ITERATIONS = 600000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ui = {
  locale: "vi",
  form: document.querySelector("#unlock-form"),
  passphrase: document.querySelector("#passphrase"),
  state: document.querySelector("#state-panel"),
  content: document.querySelector("#protected-content"),
  remove: document.querySelector("#remove-copy"),
  removeResult: document.querySelector("#remove-result"),
  localeButton: document.querySelector("#locale-button"),
  title: document.querySelector("#title"),
  sourceTitle: document.querySelector("#source-title"),
  sourceCopy: document.querySelector("#source-copy"),
  safetyTitle: document.querySelector("#safety-title"),
  safetyCopy: document.querySelector("#safety-copy"),
  unlockTitle: document.querySelector("#unlock-title"),
  unlockHint: document.querySelector("#unlock-hint"),
  passphraseLabel: document.querySelector('label[for="passphrase"]'),
  openCopy: document.querySelector("#open-copy"),
  localTitle: document.querySelector("#local-title"),
  footerCopy: document.querySelector("#footer-copy"),
};

const text = {
  vi: {
    recent: "Trong khoảng đọc 24 giờ đã được phê duyệt — vẫn không phải trạng thái trực tiếp.",
    stale:
      "Bản sao đã cũ hơn 24 giờ. Quyền hiện tại và cập nhật chưa được kiểm tra; hãy kết nối lại trước khi dựa vào thay đổi mới.",
    unknown:
      "Không thể tin cậy đồng hồ thiết bị. Độ mới không xác định; bản sao không phải trạng thái trực tiếp.",
    wrong: "Không thể mở bản sao. Kiểm tra cụm mật khẩu hoặc xóa và tạo lại khi trực tuyến.",
    expired: "Bản sao đã hết hạn sau 72 giờ. Nội dung đã bị ẩn và bản sao đã được xóa.",
    missing:
      "Không có bản sao ngoại tuyến dùng được trên thiết bị này. Điều này không có nghĩa là không có kế hoạch.",
    mismatch: "Bản sao đã lưu thuộc một tuyến hộ gia đình khác và sẽ không được hiển thị.",
    integrity: "Không thể xác minh bản sao đã lưu. Nội dung đã bị ẩn và bản sao đã được xóa.",
    removed: "Bản sao ngoại tuyến đã được xóa khỏi thiết bị.",
    plan: "Các bước trong kế hoạch",
    contacts: "Liên hệ đã cấu hình",
    facts: "Dữ kiện xác nhận",
    version: "Phiên bản kế hoạch",
    contactVersion: "Lần sửa danh bạ",
    confirmed: "Lần cuối máy chủ xác nhận",
    source: "Nguồn",
    call: "Mở chức năng gọi trên thiết bị",
    callBoundary:
      "LifeBridge không thực hiện, xác nhận hoặc bảo đảm cuộc gọi và không điều phối dịch vụ khẩn cấp.",
    title: "Kế hoạch khẩn cấp đã lưu",
    sourceTitle: "Bản sao ngoại tuyến — không trực tiếp",
    sourceCopy:
      "Bản sao ngoại tuyến đã lưu — không phải trạng thái trực tiếp. Không thể kiểm tra quyền hiện tại hoặc cập nhật khi ngoại tuyến.",
    safetyTitle: "Giới hạn an toàn",
    safetyCopy:
      "LifeBridge chỉ hiển thị kế hoạch do người tham gia rà soát và máy chủ xác nhận. Ứng dụng không chẩn đoán, xếp hạng mức độ khẩn cấp, liên hệ bất kỳ ai hoặc điều phối dịch vụ khẩn cấp.",
    unlockTitle: "Mở bản sao đã mã hóa",
    unlockHint:
      "Cụm mật khẩu ngoại tuyến khác mật khẩu tài khoản, không được gửi đi hoặc có thể khôi phục. Có thể dán từ trình quản lý mật khẩu.",
    passphrase: "Cụm mật khẩu ngoại tuyến",
    open: "Mở bản sao",
    localTitle: "Hành động trên thiết bị",
    remove: "Xóa bản sao đã lưu khỏi thiết bị",
    footer: "Mọi thay đổi đều bị chặn khi ngoại tuyến và không bao giờ được xếp hàng.",
  },
  en: {
    recent: "Within the approved 24-hour reading window — still not live.",
    stale:
      "This copy is more than 24 hours old. Current permission and updates were not checked; reconnect before relying on newer changes.",
    unknown: "The device clock is not trusted. Freshness is unknown and the copy is not live.",
    wrong: "The copy could not be opened. Check the passphrase, or remove and recreate it online.",
    expired: "The copy expired after 72 hours. Content was hidden and the saved copy was removed.",
    missing: "No usable offline copy exists on this device. This does not mean there is no plan.",
    mismatch: "The saved copy belongs to a different household route and will not be shown.",
    integrity: "The saved copy could not be verified. Content was hidden and the copy was removed.",
    removed: "Saved offline copy removed from this device.",
    plan: "Plan steps",
    contacts: "Configured contacts",
    facts: "Confirmation facts",
    version: "Plan version",
    contactVersion: "Contact-list revision",
    confirmed: "Last server confirmation",
    source: "Source",
    call: "Open device calling function",
    callBoundary:
      "LifeBridge does not place, confirm, or guarantee a call and does not dispatch emergency services.",
    title: "Saved emergency plan",
    sourceTitle: "Offline copy — not live",
    sourceCopy:
      "Saved offline copy — not live state. Current permission and updates cannot be checked while offline.",
    safetyTitle: "Safety boundary",
    safetyCopy:
      "LifeBridge only displays a participant-reviewed, server-confirmed plan. It does not diagnose, rank urgency, contact anyone, or dispatch emergency services.",
    unlockTitle: "Open encrypted copy",
    unlockHint:
      "The offline passphrase is not the account password, is never sent, and cannot be recovered. Pasting from a password manager is allowed.",
    passphrase: "Offline passphrase",
    open: "Open copy",
    localTitle: "On-device actions",
    remove: "Remove saved copy from this device",
    footer: "All changes are blocked offline and are never queued.",
  },
};

ui.localeButton.addEventListener("click", () => {
  ui.locale = ui.locale === "vi" ? "en" : "vi";
  renderLocale();
});

renderLocale();

ui.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearProtected();
  const passphrase = ui.passphrase.value.normalize("NFC");
  if ([...passphrase].length < 12 || [...passphrase].length > 128) {
    showState("wrong", "error");
    return;
  }
  const envelope = await readRecord();
  if (!envelope) {
    showState("missing", "error");
    return;
  }
  if (envelope.routeBinding !== (await sha256(location.pathname))) {
    showState("mismatch", "error");
    return;
  }
  const checksum = envelope.checksum;
  const without = { ...envelope };
  delete without.checksum;
  delete without.id;
  if ((await sha256(JSON.stringify(without))) !== checksum) {
    await removeRecord();
    showState("integrity", "error");
    return;
  }
  const now = Date.now();
  const values = [
    Date.parse(envelope.savedAtUtc),
    Date.parse(envelope.lastConfirmedAtUtc),
    Date.parse(envelope.freshUntilUtc),
    Date.parse(envelope.expiresAtUtc),
  ];
  if (!values.every(Number.isFinite)) {
    await removeRecord();
    showState("integrity", "error");
    return;
  }
  if (now >= values[3]) {
    await removeRecord();
    showState("expired", "error");
    return;
  }
  try {
    const snapshot = await decrypt(envelope, passphrase);
    validateSnapshot(snapshot, envelope);
    const state =
      now < values[0] - 300000 || now < values[1] - 300000
        ? "unknown"
        : now <= values[2]
          ? "recent"
          : "stale";
    showState(state, state === "recent" ? "info" : "stale");
    renderSnapshot(snapshot);
    ui.passphrase.value = "";
  } catch {
    showState("wrong", "error");
  }
});

ui.remove.addEventListener("click", async () => {
  clearProtected();
  await removeRecord();
  ui.removeResult.textContent = text[ui.locale].removed;
  ui.removeResult.focus?.();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearProtected();
});
window.addEventListener("pagehide", clearProtected);

function showState(key, kind) {
  ui.state.className = `state-panel state-${kind}`;
  ui.state.textContent = text[ui.locale][key];
  ui.state.focus();
}

function renderLocale() {
  const value = text[ui.locale];
  document.documentElement.lang = ui.locale;
  ui.localeButton.textContent = ui.locale === "vi" ? "English" : "Tiếng Việt";
  ui.title.textContent = value.title;
  ui.sourceTitle.textContent = value.sourceTitle;
  ui.sourceCopy.textContent = value.sourceCopy;
  ui.safetyTitle.textContent = value.safetyTitle;
  ui.safetyCopy.textContent = value.safetyCopy;
  ui.unlockTitle.textContent = value.unlockTitle;
  ui.unlockHint.textContent = value.unlockHint;
  ui.passphraseLabel.textContent = value.passphrase;
  ui.openCopy.textContent = value.open;
  ui.localTitle.textContent = value.localTitle;
  ui.remove.textContent = value.remove;
  ui.footerCopy.textContent = value.footer;
}

function renderSnapshot(snapshot) {
  clearProtected();
  const card = document.createElement("article");
  card.className = "protected-card";

  card.append(heading(text[ui.locale].plan));
  const steps = document.createElement("ol");
  snapshot.steps.forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step.text;
    steps.append(item);
  });
  card.append(steps, heading(text[ui.locale].contacts));

  const contacts = document.createElement("ol");
  snapshot.contacts.forEach((contact) => {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = contact.displayLabel;
    const call = document.createElement("a");
    call.className = "call-link";
    call.href = `tel:${contact.dialString}`;
    call.textContent = `${text[ui.locale].call}: ${contact.dialString}`;
    item.append(label, document.createElement("br"), call);
    contacts.append(item);
  });
  const boundary = document.createElement("p");
  boundary.textContent = text[ui.locale].callBoundary;
  card.append(contacts, boundary, heading(text[ui.locale].facts));

  const facts = document.createElement("dl");
  addFact(facts, text[ui.locale].version, String(snapshot.planVersion));
  addFact(facts, text[ui.locale].contactVersion, String(snapshot.contactListRevision));
  addFact(
    facts,
    text[ui.locale].confirmed,
    `${snapshot.displayLocalTime} ${snapshot.displayUtcOffset} (${snapshot.displayTimeZone}); UTC ${snapshot.lastConfirmedAtUtc}`,
  );
  addFact(facts, text[ui.locale].source, `${snapshot.source} / ${snapshot.contractVersion}`);
  card.append(facts);
  ui.content.append(card);
  ui.content.hidden = false;
}

function heading(value) {
  const node = document.createElement("h2");
  node.textContent = value;
  return node;
}

function addFact(list, name, value) {
  const term = document.createElement("dt");
  const detail = document.createElement("dd");
  term.textContent = name;
  detail.textContent = value;
  list.append(term, detail);
}

function clearProtected() {
  ui.content.replaceChildren();
  ui.content.hidden = true;
}

async function decrypt(envelope, passphrase) {
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  if (salt.byteLength !== 16 || iv.byteLength !== 12) throw new Error("invalid");
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: aad(envelope), tagLength: 128 },
    key,
    base64ToBytes(envelope.ciphertext),
  );
  return JSON.parse(decoder.decode(plaintext));
}

function aad(envelope) {
  return encoder.encode(
    JSON.stringify({
      envelopeVersion: envelope.envelopeVersion,
      routeBinding: envelope.routeBinding,
      scopeBinding: envelope.scopeBinding,
      planVersion: envelope.planVersion,
      contactListRevision: envelope.contactListRevision,
      lastConfirmedAtUtc: envelope.lastConfirmedAtUtc,
      freshUntilUtc: envelope.freshUntilUtc,
      expiresAtUtc: envelope.expiresAtUtc,
      savedAtUtc: envelope.savedAtUtc,
    }),
  );
}

function validateSnapshot(snapshot, envelope) {
  if (
    snapshot.contractVersion !== "P4-S2-offline-v1" ||
    snapshot.source !== "care-coordination" ||
    snapshot.scopeBinding !== envelope.scopeBinding ||
    snapshot.planVersion !== envelope.planVersion ||
    snapshot.contactListRevision !== envelope.contactListRevision ||
    snapshot.lastConfirmedAtUtc !== envelope.lastConfirmedAtUtc ||
    snapshot.freshUntilUtc !== envelope.freshUntilUtc ||
    snapshot.expiresAtUtc !== envelope.expiresAtUtc ||
    !Array.isArray(snapshot.steps) ||
    snapshot.steps.length < 1 ||
    snapshot.steps.length > 8 ||
    !Array.isArray(snapshot.contacts) ||
    snapshot.contacts.length < 1 ||
    snapshot.contacts.length > 10
  ) {
    throw new Error("invalid");
  }
}

function readRecord() {
  return databaseOperation("readonly", (store) => store.get("primary"));
}

function removeRecord() {
  return databaseOperation("readwrite", (store) => {
    store.delete("primary");
    store.delete("pending");
  });
}

function databaseOperation(mode, action) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE_NAME)) {
        open.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction(STORE_NAME, mode);
      const result = action(transaction.objectStore(STORE_NAME));
      if (result && "onsuccess" in result) {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error);
      } else {
        transaction.oncomplete = () => resolve(undefined);
      }
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.addEventListener("complete", () => database.close());
    };
  });
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
