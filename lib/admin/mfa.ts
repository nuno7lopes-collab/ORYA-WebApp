import "server-only";

import crypto from "crypto";
import { authenticator } from "otplib";
import { prisma } from "@/lib/prisma";

const DEFAULT_RECOVERY_COUNT = 8;
const DEFAULT_RECOVERY_LEN = 10;

type RecoveryRecord = {
  salt: string;
  hash: string;
  usedAt?: string | null;
};

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function encodeBase32(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function generateSecret(bytes = 20) {
  return encodeBase32(crypto.randomBytes(bytes));
}

function decodeKey(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("ADMIN_TOTP_ENCRYPTION_KEY_EMPTY");
  const isHex = /^[0-9a-fA-F]+$/.test(trimmed);
  if (isHex && trimmed.length === 64) {
    return Buffer.from(trimmed, "hex");
  }
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 32) return buf;
  } catch {
    // fall through
  }
  const buf = Buffer.from(trimmed, "utf8");
  if (buf.length === 32) return buf;
  throw new Error("ADMIN_TOTP_ENCRYPTION_KEY_INVALID");
}

function getEncryptionKey() {
  const raw = process.env.ADMIN_TOTP_ENCRYPTION_KEY;
  if (!raw) throw new Error("ADMIN_TOTP_ENCRYPTION_KEY_MISSING");
  return decodeKey(raw);
}

function normalizeCode(value: string) {
  return value.replace(/[\s-]/g, "").trim();
}

function encryptSecret(secret: string) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    secretEnc: enc.toString("base64"),
    secretIv: iv.toString("base64"),
    secretTag: tag.toString("base64"),
  };
}

function decryptSecret(params: { secretEnc: string; secretIv: string; secretTag: string }) {
  const key = getEncryptionKey();
  const iv = Buffer.from(params.secretIv, "base64");
  const tag = Buffer.from(params.secretTag, "base64");
  const enc = Buffer.from(params.secretEnc, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
  return plain.toString("utf8");
}

function generateRecoveryCodes(count = DEFAULT_RECOVERY_COUNT) {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const buf = crypto.randomBytes(Math.ceil(DEFAULT_RECOVERY_LEN / 2));
    const raw = buf.toString("hex").slice(0, DEFAULT_RECOVERY_LEN).toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

function hashRecovery(code: string, salt: string) {
  return crypto.createHash("sha256").update(`${salt}:${normalizeCode(code)}`).digest("hex");
}

function buildRecoveryRecords(codes: string[]): RecoveryRecord[] {
  return codes.map((code) => {
    const salt = crypto.randomBytes(8).toString("hex");
    return { salt, hash: hashRecovery(code, salt), usedAt: null };
  });
}

export async function getMfaStatus(userId: string) {
  const record = await prisma.adminMfa.findFirst({
    where: { userId },
    select: { enabledAt: true, recoveryCodes: true, updatedAt: true },
  });
  const recovery = Array.isArray(record?.recoveryCodes) ? (record?.recoveryCodes as RecoveryRecord[]) : [];
  const unused = recovery.filter((code) => !code.usedAt).length;
  return {
    enabled: Boolean(record?.enabledAt),
    pending: Boolean(record && !record.enabledAt),
    updatedAt: record?.updatedAt?.toISOString() ?? null,
    recoveryUnused: unused,
    configMissing: !process.env.ADMIN_TOTP_ENCRYPTION_KEY,
  };
}

export async function enrollMfa(userId: string, userEmail?: string | null) {
  const existing = await prisma.adminMfa.findFirst({ where: { userId } });
  if (existing?.enabledAt) {
    throw new Error("MFA_ALREADY_ENABLED");
  }
  if (existing) {
    throw new Error("MFA_ALREADY_PENDING");
  }

  const secret = generateSecret();
  const issuer = process.env.ADMIN_TOTP_ISSUER ?? "ORYA";
  const label = userEmail ?? `admin:${userId}`;
  const otpauth = authenticator.keyuri(label, issuer, secret);
  const recoveryCodes = generateRecoveryCodes();
  const recoveryRecords = buildRecoveryRecords(recoveryCodes);
  const encrypted = encryptSecret(secret);

  await prisma.adminMfa.upsert({
    where: { userId },
    update: {
      secretEnc: encrypted.secretEnc,
      secretIv: encrypted.secretIv,
      secretTag: encrypted.secretTag,
      recoveryCodes: recoveryRecords,
      enabledAt: null,
    },
    create: {
      userId,
      secretEnc: encrypted.secretEnc,
      secretIv: encrypted.secretIv,
      secretTag: encrypted.secretTag,
      recoveryCodes: recoveryRecords,
      enabledAt: null,
    },
  });

  return { otpauth, recoveryCodes };
}

export async function verifyMfaCode(params: { userId: string; code?: string | null; recoveryCode?: string | null }) {
  const record = await prisma.adminMfa.findFirst({
    where: { userId: params.userId },
  });
  if (!record) return { ok: false as const, error: "MFA_NOT_ENROLLED" };

  if (params.recoveryCode) {
    const recovery = Array.isArray(record.recoveryCodes) ? (record.recoveryCodes as RecoveryRecord[]) : [];
    const normalized = normalizeCode(params.recoveryCode);
    const idx = recovery.findIndex((item) => !item.usedAt && hashRecovery(normalized, item.salt) === item.hash);
    if (idx === -1) return { ok: false as const, error: "MFA_RECOVERY_INVALID" };
    recovery[idx] = { ...recovery[idx], usedAt: new Date().toISOString() };
    await prisma.adminMfa.update({
      where: { id: record.id },
      data: { recoveryCodes: recovery, enabledAt: record.enabledAt ?? new Date() },
    });
    return { ok: true as const, usedRecovery: true };
  }

  const code = params.code ? normalizeCode(params.code) : "";
  if (!code) return { ok: false as const, error: "MFA_CODE_REQUIRED" };
  const secret = decryptSecret({
    secretEnc: record.secretEnc,
    secretIv: record.secretIv,
    secretTag: record.secretTag,
  });
  const isValid = authenticator.check(code, secret);
  if (!isValid) return { ok: false as const, error: "MFA_CODE_INVALID" };
  if (!record.enabledAt) {
    await prisma.adminMfa.update({
      where: { id: record.id },
      data: { enabledAt: new Date() },
    });
  }
  return { ok: true as const, usedRecovery: false };
}

function buildIssuerLabel(userId: string, userEmail?: string | null) {
  const issuer = process.env.ADMIN_TOTP_ISSUER ?? "ORYA";
  const label = userEmail ?? `admin:${userId}`;
  return { issuer, label };
}

async function rotateMfaSecret(record: { id: string; userId: string }, userEmail?: string | null) {
  const newSecret = generateSecret();
  const recoveryCodes = generateRecoveryCodes();
  const recoveryRecords = buildRecoveryRecords(recoveryCodes);
  const encrypted = encryptSecret(newSecret);

  await prisma.adminMfa.update({
    where: { id: record.id },
    data: {
      secretEnc: encrypted.secretEnc,
      secretIv: encrypted.secretIv,
      secretTag: encrypted.secretTag,
      recoveryCodes: recoveryRecords,
      enabledAt: null,
    },
  });

  const { issuer, label } = buildIssuerLabel(record.userId, userEmail);
  const otpauth = authenticator.keyuri(label, issuer, newSecret);

  return { otpauth, recoveryCodes };
}

export async function resetMfa(params: { userId: string; code?: string | null; userEmail?: string | null }) {
  const record = await prisma.adminMfa.findFirst({
    where: { userId: params.userId },
  });
  if (!record) throw new Error("MFA_NOT_ENROLLED");

  const code = params.code ? normalizeCode(params.code) : "";
  if (!code) return { ok: false as const, error: "MFA_CODE_REQUIRED" };

  const secret = decryptSecret({
    secretEnc: record.secretEnc,
    secretIv: record.secretIv,
    secretTag: record.secretTag,
  });
  const isValid = authenticator.check(code, secret);
  if (!isValid) return { ok: false as const, error: "MFA_CODE_INVALID" };
  const payload = await rotateMfaSecret(record, params.userEmail ?? null);
  return { ok: true as const, payload };
}

export async function forceResetMfa(params: { userId: string; userEmail?: string | null }) {
  const record = await prisma.adminMfa.findFirst({
    where: { userId: params.userId },
  });
  if (!record) throw new Error("MFA_NOT_ENROLLED");
  const payload = await rotateMfaSecret(record, params.userEmail ?? null);
  return { ok: true as const, payload };
}
