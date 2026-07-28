import {
  EmergencyOfflineSnapshotSchema,
  type EmergencyOfflineSnapshot,
} from "@lifebridge/contracts";

export const EMERGENCY_OFFLINE_DB = "lifebridge-emergency-offline-v1";
export const EMERGENCY_OFFLINE_STORE = "encrypted-snapshots";
export const EMERGENCY_OFFLINE_ITERATIONS = 600_000;

const PRIMARY_KEY = "primary";
const PENDING_KEY = "pending";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedEmergencyEnvelope {
  id: typeof PRIMARY_KEY | typeof PENDING_KEY;
  envelopeVersion: "P4-S2-envelope-v1";
  routeBinding: string;
  scopeBinding: string;
  planVersion: number;
  contactListRevision: number;
  lastConfirmedAtUtc: string;
  freshUntilUtc: string;
  expiresAtUtc: string;
  savedAtUtc: string;
  salt: string;
  iv: string;
  ciphertext: string;
  checksum: string;
}

export type OfflineReadResult =
  | { state: "missing" | "route_mismatch" | "freshness_expired" | "integrity_failed" }
  | { state: "wrong_passphrase" }
  | {
      state: "offline_recent" | "offline_stale" | "freshness_unknown";
      snapshot: EmergencyOfflineSnapshot;
    };

export function classifyEmergencyOfflineFreshness(input: {
  savedAtUtc: string;
  lastConfirmedAtUtc: string;
  freshUntilUtc: string;
  expiresAtUtc: string;
  now: Date;
}):
  | "offline_recent"
  | "offline_stale"
  | "freshness_unknown"
  | "freshness_expired"
  | "integrity_failed" {
  const nowMs = input.now.getTime();
  const savedMs = Date.parse(input.savedAtUtc);
  const confirmedMs = Date.parse(input.lastConfirmedAtUtc);
  const freshMs = Date.parse(input.freshUntilUtc);
  const expiresMs = Date.parse(input.expiresAtUtc);
  if (![nowMs, savedMs, confirmedMs, freshMs, expiresMs].every(Number.isFinite)) {
    return "integrity_failed";
  }
  if (nowMs >= expiresMs) return "freshness_expired";
  if (nowMs < savedMs - 5 * 60 * 1_000 || nowMs < confirmedMs - 5 * 60 * 1_000) {
    return "freshness_unknown";
  }
  return nowMs <= freshMs ? "offline_recent" : "offline_stale";
}

export async function saveEmergencyOfflineCopy(
  snapshotInput: EmergencyOfflineSnapshot,
  passphrase: string,
  routePath: string,
): Promise<void> {
  requirePassphrase(passphrase);
  const snapshot = EmergencyOfflineSnapshotSchema.parse(snapshotInput);
  const routeBinding = await sha256(routePath);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const savedAtUtc = new Date().toISOString();
  const partial = {
    envelopeVersion: "P4-S2-envelope-v1" as const,
    routeBinding,
    scopeBinding: snapshot.scopeBinding,
    planVersion: snapshot.planVersion,
    contactListRevision: snapshot.contactListRevision,
    lastConfirmedAtUtc: snapshot.lastConfirmedAtUtc,
    freshUntilUtc: snapshot.freshUntilUtc,
    expiresAtUtc: snapshot.expiresAtUtc,
    savedAtUtc,
  };
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad(partial), tagLength: 128 },
    key,
    encoder.encode(JSON.stringify(snapshot)),
  );
  const encodedCiphertext = bytesToBase64(new Uint8Array(ciphertext));
  const envelopeWithoutChecksum = {
    id: PENDING_KEY as typeof PENDING_KEY,
    ...partial,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: encodedCiphertext,
  };
  const pending: EncryptedEmergencyEnvelope = {
    ...envelopeWithoutChecksum,
    checksum: await envelopeChecksum(envelopeWithoutChecksum),
  };

  const database = await openDatabase();
  try {
    await put(database, pending);
    const readBack = await get(database, PENDING_KEY);
    if (!readBack) throw new Error("offline_copy_write_failed");
    await decryptEnvelope(readBack, passphrase);
    await promotePending(database, readBack);
    const confirmed = await get(database, PRIMARY_KEY);
    if (!confirmed) throw new Error("offline_copy_write_failed");
    await decryptEnvelope(confirmed, passphrase);
  } catch (error) {
    await remove(database, PENDING_KEY).catch(() => undefined);
    throw error;
  } finally {
    database.close();
  }
}

export async function readEmergencyOfflineCopy(
  passphrase: string,
  routePath: string,
  now = new Date(),
): Promise<OfflineReadResult> {
  requirePassphrase(passphrase);
  const database = await openDatabase();
  try {
    const envelope = await get(database, PRIMARY_KEY);
    if (!envelope) return { state: "missing" };
    if (envelope.routeBinding !== (await sha256(routePath))) {
      return { state: "route_mismatch" };
    }
    if ((await envelopeChecksum(withoutChecksum(envelope))) !== envelope.checksum) {
      await remove(database, PRIMARY_KEY);
      return { state: "integrity_failed" };
    }
    const freshness = classifyEmergencyOfflineFreshness({
      savedAtUtc: envelope.savedAtUtc,
      lastConfirmedAtUtc: envelope.lastConfirmedAtUtc,
      freshUntilUtc: envelope.freshUntilUtc,
      expiresAtUtc: envelope.expiresAtUtc,
      now,
    });
    if (freshness === "integrity_failed") {
      await remove(database, PRIMARY_KEY);
      return { state: "integrity_failed" };
    }
    if (freshness === "freshness_expired") {
      await remove(database, PRIMARY_KEY);
      return { state: "freshness_expired" };
    }
    let snapshot: EmergencyOfflineSnapshot;
    try {
      snapshot = await decryptEnvelope(envelope, passphrase);
    } catch {
      return { state: "wrong_passphrase" };
    }
    if (
      snapshot.scopeBinding !== envelope.scopeBinding ||
      snapshot.planVersion !== envelope.planVersion ||
      snapshot.contactListRevision !== envelope.contactListRevision ||
      snapshot.lastConfirmedAtUtc !== envelope.lastConfirmedAtUtc ||
      snapshot.freshUntilUtc !== envelope.freshUntilUtc ||
      snapshot.expiresAtUtc !== envelope.expiresAtUtc
    ) {
      await remove(database, PRIMARY_KEY);
      return { state: "integrity_failed" };
    }
    return { state: freshness, snapshot };
  } finally {
    database.close();
  }
}

export async function removeEmergencyOfflineCopy(): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(EMERGENCY_OFFLINE_STORE, "readwrite");
    transaction.objectStore(EMERGENCY_OFFLINE_STORE).delete(PRIMARY_KEY);
    transaction.objectStore(EMERGENCY_OFFLINE_STORE).delete(PENDING_KEY);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function hasEmergencyOfflineCopy(): Promise<boolean> {
  const database = await openDatabase();
  try {
    return Boolean(await get(database, PRIMARY_KEY));
  } finally {
    database.close();
  }
}

export async function purgeEmergencyOfflineCopyIfSuperseded(
  planVersion: number | null,
  contactListRevision: number,
): Promise<boolean> {
  const database = await openDatabase();
  try {
    const envelope = await get(database, PRIMARY_KEY);
    if (!envelope) return false;
    if (
      planVersion === null ||
      envelope.planVersion !== planVersion ||
      envelope.contactListRevision !== contactListRevision
    ) {
      await remove(database, PRIMARY_KEY);
      await remove(database, PENDING_KEY);
      return true;
    }
    return false;
  } finally {
    database.close();
  }
}

export async function registerEmergencyOfflineShell(): Promise<
  "registered" | "unsupported" | "failed"
> {
  if (!("serviceWorker" in navigator) || !globalThis.isSecureContext) return "unsupported";
  try {
    await navigator.serviceWorker.register("/emergency-offline-sw.js", {
      scope: "/households/",
    });
    return "registered";
  } catch {
    return "failed";
  }
}

async function decryptEnvelope(
  envelope: EncryptedEmergencyEnvelope,
  passphrase: string,
): Promise<EmergencyOfflineSnapshot> {
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  if (salt.byteLength !== 16 || iv.byteLength !== 12) throw new Error("invalid_envelope");
  const key = await deriveKey(passphrase, salt);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad(envelope),
      tagLength: 128,
    },
    key,
    base64ToBytes(envelope.ciphertext),
  );
  return EmergencyOfflineSnapshotSchema.parse(JSON.parse(decoder.decode(plaintext)));
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase.normalize("NFC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: EMERGENCY_OFFLINE_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function aad(
  envelope: Pick<
    EncryptedEmergencyEnvelope,
    | "envelopeVersion"
    | "routeBinding"
    | "scopeBinding"
    | "planVersion"
    | "contactListRevision"
    | "lastConfirmedAtUtc"
    | "freshUntilUtc"
    | "expiresAtUtc"
    | "savedAtUtc"
  >,
) {
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

function requirePassphrase(value: string) {
  const length = [...value.normalize("NFC")].length;
  if (length < 12 || length > 128) throw new Error("offline_passphrase_length");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function envelopeChecksum(value: Omit<EncryptedEmergencyEnvelope, "checksum">) {
  const { id, ...contents } = value;
  void id;
  return sha256(JSON.stringify(contents));
}

function withoutChecksum(
  envelope: EncryptedEmergencyEnvelope,
): Omit<EncryptedEmergencyEnvelope, "checksum"> {
  return {
    id: envelope.id,
    envelopeVersion: envelope.envelopeVersion,
    routeBinding: envelope.routeBinding,
    scopeBinding: envelope.scopeBinding,
    planVersion: envelope.planVersion,
    contactListRevision: envelope.contactListRevision,
    lastConfirmedAtUtc: envelope.lastConfirmedAtUtc,
    freshUntilUtc: envelope.freshUntilUtc,
    expiresAtUtc: envelope.expiresAtUtc,
    savedAtUtc: envelope.savedAtUtc,
    salt: envelope.salt,
    iv: envelope.iv,
    ciphertext: envelope.ciphertext,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(EMERGENCY_OFFLINE_DB, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(EMERGENCY_OFFLINE_STORE)) {
        database.createObjectStore(EMERGENCY_OFFLINE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("offline_database_open_failed"));
  });
}

function get(
  database: IDBDatabase,
  key: typeof PRIMARY_KEY | typeof PENDING_KEY,
): Promise<EncryptedEmergencyEnvelope | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(EMERGENCY_OFFLINE_STORE, "readonly");
    const request = transaction.objectStore(EMERGENCY_OFFLINE_STORE).get(key);
    request.onsuccess = () => resolve(request.result as EncryptedEmergencyEnvelope | undefined);
    request.onerror = () => reject(request.error ?? new Error("offline_database_read_failed"));
  });
}

function put(database: IDBDatabase, value: EncryptedEmergencyEnvelope): Promise<void> {
  const transaction = database.transaction(EMERGENCY_OFFLINE_STORE, "readwrite");
  transaction.objectStore(EMERGENCY_OFFLINE_STORE).put(value);
  return transactionDone(transaction);
}

function remove(
  database: IDBDatabase,
  key: typeof PRIMARY_KEY | typeof PENDING_KEY,
): Promise<void> {
  const transaction = database.transaction(EMERGENCY_OFFLINE_STORE, "readwrite");
  transaction.objectStore(EMERGENCY_OFFLINE_STORE).delete(key);
  return transactionDone(transaction);
}

function promotePending(database: IDBDatabase, pending: EncryptedEmergencyEnvelope): Promise<void> {
  const transaction = database.transaction(EMERGENCY_OFFLINE_STORE, "readwrite");
  const store = transaction.objectStore(EMERGENCY_OFFLINE_STORE);
  store.put({ ...pending, id: PRIMARY_KEY });
  store.delete(PENDING_KEY);
  return transactionDone(transaction);
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("offline_database_transaction_aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("offline_database_transaction_failed"));
  });
}

function bytesToBase64(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToHex(value: Uint8Array) {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
