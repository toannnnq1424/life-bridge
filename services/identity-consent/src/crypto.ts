import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

import { Algorithm, hash, verify } from "@node-rs/argon2";
import * as OTPAuth from "otpauth";

export const PASSWORD_HASH_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password.normalize("NFC"), PASSWORD_HASH_OPTIONS);
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  try {
    return await verify(encoded, password.normalize("NFC"), PASSWORD_HASH_OPTIONS);
  } catch {
    return false;
  }
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function digestSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function keyedDigest(key: Buffer, value: string): string {
  return createHmac("sha256", key).update(value, "utf8").digest("hex");
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(16).toString("hex").toUpperCase();
    return raw.match(/.{1,8}/g)?.join("-") ?? raw;
  });
}

export function sealSecret(secret: string, key: Buffer, aad: string): string {
  if (key.length !== 32) {
    throw new Error("IDENTITY_DATA_KEY_INVALID");
  }
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${nonce.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

export interface DataKeyring {
  current: { id: string; key: Buffer };
  previous?: { id: string; key: Buffer };
}

export function sealSecretWithKeyring(secret: string, keys: DataKeyring, aad: string): string {
  return `v2.${keys.current.id}.${sealSecret(secret, keys.current.key, aad).slice(3)}`;
}

export function openSecretWithKeyring(sealed: string, keys: DataKeyring, aad: string): string {
  if (sealed.startsWith("v1.")) return openSecret(sealed, keys.current.key, aad);
  const [version, kid, nonce, encrypted, tag] = sealed.split(".");
  if (version !== "v2" || !kid || !nonce || !encrypted || !tag)
    throw new Error("SEALED_SECRET_INVALID");
  const selected =
    keys.current.id === kid ? keys.current : keys.previous?.id === kid ? keys.previous : undefined;
  if (!selected) throw new Error("SEALED_SECRET_KEY_REVOKED");
  return openSecret(`v1.${nonce}.${encrypted}.${tag}`, selected.key, aad);
}

export function openSecret(sealed: string, key: Buffer, aad: string): string {
  const [version, nonceText, encryptedText, tagText] = sealed.split(".");
  if (version !== "v1" || !nonceText || !encryptedText || !tagText || key.length !== 32) {
    throw new Error("SEALED_SECRET_INVALID");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(nonceText, "base64url"), {
    authTagLength: 16,
  });
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function newTotpSecret(): string {
  return new OTPAuth.Secret({ size: 32 }).base32;
}

export function totpProvisioningUri(loginName: string, secret: string): string {
  return totp(loginName, secret).toString();
}

export function generateTotp(secret: string, timestamp: number): string {
  return totp("account", secret).generate({ timestamp });
}

export function validateTotp(secret: string, token: string, timestamp: number): number | null {
  const delta = totp("account", secret).validate({ token, timestamp, window: 1 });
  return delta === null ? null : Math.floor(timestamp / 30_000) + delta;
}

function totp(label: string, secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: "LifeBridge",
    label,
    algorithm: "SHA256",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}
