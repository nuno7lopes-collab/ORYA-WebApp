import "server-only";

import crypto from "crypto";
import type { NextRequest } from "next/server";
import { cookies, headers } from "next/headers";
import { getAppEnv } from "@/lib/appEnv";

const COOKIE_NAME = "orya_admin_mfa";
const DEFAULT_TTL_SECONDS = 60 * 60 * 12; // 12h
const CLOCK_SKEW_SECONDS = 60;

type SessionPayload = {
  sub: string;
  iat: number;
  exp: number;
};

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

function getKey() {
  const raw = process.env.ADMIN_TOTP_ENCRYPTION_KEY;
  if (!raw) throw new Error("ADMIN_TOTP_ENCRYPTION_KEY_MISSING");
  return decodeKey(raw);
}

function base64Url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload: string) {
  const key = getKey();
  return base64Url(crypto.createHmac("sha256", key).update(payload).digest());
}

function encodePayload(payload: SessionPayload) {
  return base64Url(JSON.stringify(payload));
}

function decodePayload(encoded: string): SessionPayload | null {
  try {
    const json = Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}

export function shouldRequireAdminMfa(host?: string | null) {
  const env = getAppEnv();
  if (env !== "prod") return false;
  if (process.env.ADMIN_MFA_REQUIRED === "false") return false;
  const safeHost = (host ?? "").split(":")[0].toLowerCase();
  return safeHost === "admin.orya.pt";
}

export function buildMfaSession(userId: string) {
  const ttl = Number.parseInt(process.env.ADMIN_MFA_SESSION_TTL_SECONDS ?? "", 10) || DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: userId, iat: now, exp: now + ttl };
  const encoded = encodePayload(payload);
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyMfaSession(token: string | null | undefined, userId?: string | null) {
  if (!token) return { ok: false as const, reason: "missing" };
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return { ok: false as const, reason: "format" };
  const expected = sign(encoded);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return { ok: false as const, reason: "signature" };
  }
  const payload = decodePayload(encoded);
  if (!payload) return { ok: false as const, reason: "payload" };
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp + CLOCK_SKEW_SECONDS < now) return { ok: false as const, reason: "expired" };
  if (payload.iat - CLOCK_SKEW_SECONDS > now) return { ok: false as const, reason: "iat" };
  if (userId && payload.sub !== userId) return { ok: false as const, reason: "subject" };
  return { ok: true as const, payload };
}

export function readMfaSessionCookie(req?: NextRequest | Request) {
  if (req && "cookies" in req) {
    const value = (req as NextRequest).cookies.get(COOKIE_NAME)?.value;
    return value ?? null;
  }
  try {
    return cookies().get(COOKIE_NAME)?.value ?? null;
  } catch {
    return null;
  }
}

export function readAdminHost(req?: NextRequest | Request) {
  if (req && "headers" in req) {
    const host = (req as NextRequest).headers.get("x-forwarded-host") || (req as NextRequest).headers.get("host");
    return host ?? null;
  }
  try {
    const hdrs = headers();
    return hdrs.get("x-forwarded-host") || hdrs.get("host");
  } catch {
    return null;
  }
}

export function setMfaSessionCookie(response: Response, userId: string) {
  const token = buildMfaSession(userId);
  const secure = process.env.NODE_ENV === "production";
  const cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
  response.headers.append("Set-Cookie", cookie);
}

export function clearMfaSessionCookie(response: Response) {
  const secure = process.env.NODE_ENV === "production";
  const cookie = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
  response.headers.append("Set-Cookie", cookie);
}
