import bcrypt from "bcryptjs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getServerEnv } from "./env";

const IV_LENGTH = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashed: string) {
  return bcrypt.compare(password, hashed);
}

export function encryptText(value: string) {
  const { ENCRYPTION_KEY } = getServerEnv();
  const iv = randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptText(value: string | null) {
  if (!value) return null;

  const { ENCRYPTION_KEY } = getServerEnv();
  const payload = Buffer.from(value, "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = payload.subarray(IV_LENGTH + 16);
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]).toString("utf8");
}
