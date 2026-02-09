// lib/qr.ts
// ORYA QR Generator v1 — preparado para ORYA2 payload

import QRCode from "qrcode";
import crypto from "crypto";
import { env } from "@/lib/env";

export type QRPayload = {
  v: string;          // versão do QR
  t: string;          // token único (qrToken)
  ts?: number;        // timestamp opcional
};

export type QROptions = {
  theme?: "light" | "dark";
};

export async function generateQR(
  payload: QRPayload | string,
  options: QROptions = {}
): Promise<string> {
  const json = typeof payload === "string" ? payload : JSON.stringify(payload);

  const theme =
    options.theme === "dark"
      ? {
          dark: "#FFFFFF",
          light: "#000000",
        }
      : {
          dark: "#000000",
          light: "#FFFFFF",
        };

  return await QRCode.toDataURL(json, {
    width: 512,
    margin: 2,
    color: theme,
  });
}

// ------------------------------
// ORYA2 — payload & assinatura
// ------------------------------

export type ORYA2Payload = {
  v: 2; // versão do payload
  typ: "ticket";
  alg: "HS256";
  tok: string; // qrToken
  tid: string; // ticketId
  eid: number; // eventId
  uid: string | null; // userId
  ts: number; // emitido (epoch seconds)
  exp: number; // expiração (epoch seconds)
  seed?: string; // seed opcional para QR dinâmico
  rot?: number; // janela de rotação (ex: Date.now()/15000)
};

const ORYA2_PREFIX = "ORYA2:" as const;

function hmacSignPayloadB64(payloadB64: string): string {
  const hmac = crypto.createHmac("sha256", env.qrSecretKey);
  hmac.update(payloadB64);
  return hmac.digest("base64url");
}

export type SignTicketInput = {
  qrToken: string;
  ticketId: string;
  eventId: number;
  userId: string | null;
  issuedAtSec: number;
  expSec: number;
  seed?: string;
  rot?: number;
};

/**
 * Gera uma string ORYA2:<payload>.<signature>
 * a partir dos dados do bilhete.
 */
export function signTicketToORYA2(input: SignTicketInput): string {
  const payload: ORYA2Payload = {
    v: 2,
    typ: "ticket",
    alg: "HS256",
    tok: input.qrToken,
    tid: input.ticketId,
    eid: input.eventId,
    uid: input.userId,
    ts: input.issuedAtSec,
    exp: input.expSec,
    ...(input.seed ? { seed: input.seed } : {}),
    ...(typeof input.rot === "number" ? { rot: input.rot } : {}),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson).toString("base64url");
  const sigB64 = hmacSignPayloadB64(payloadB64);

  return `${ORYA2_PREFIX}${payloadB64}.${sigB64}`;
}

export type VerifyORYA2Result =
  | { ok: true; payload: ORYA2Payload }
  | { ok: false; reason: string };

/**
 * Faz parse + validação criptográfica de um token ORYA2.
 */
export function parseAndVerifyORYA2(token: string): VerifyORYA2Result {
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "MISSING_TOKEN" };
  }

  if (!token.startsWith(ORYA2_PREFIX)) {
    return { ok: false, reason: "INVALID_PREFIX" };
  }

  const stripped = token.slice(ORYA2_PREFIX.length);
  const parts = stripped.split(".");
  if (parts.length !== 2) {
    return { ok: false, reason: "INVALID_FORMAT_PARTS" };
  }

  const [payloadB64, sigB64] = parts;

  let payloadJson: unknown;
  try {
    const jsonString = Buffer.from(payloadB64, "base64url").toString("utf8");
    payloadJson = JSON.parse(jsonString);
  } catch {
    return { ok: false, reason: "INVALID_PAYLOAD_B64_OR_JSON" };
  }

  const p = payloadJson as Partial<ORYA2Payload>;
  const requiredKeys: (keyof ORYA2Payload)[] = [
    "v",
    "typ",
    "alg",
    "tok",
    "tid",
    "eid",
    "uid",
    "ts",
    "exp",
  ];

  for (const key of requiredKeys) {
    if (p[key] === undefined || p[key] === null) {
      return { ok: false, reason: `MISSING_FIELD_${String(key)}` };
    }
  }

  if (p.v !== 2 || p.typ !== "ticket" || p.alg !== "HS256") {
    return { ok: false, reason: "INVALID_VERSION_OR_TYPE" };
  }

  const expectedSig = hmacSignPayloadB64(payloadB64);
  if (expectedSig !== sigB64) {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof p.exp === "number" && p.exp < nowSec) {
    return { ok: false, reason: "TICKET_EXPIRED" };
  }

  return { ok: true, payload: p as ORYA2Payload };
}

export type BuildQrTokenParams = {
  ticketId: string;
  eventId: number;
  userId: string | null;
  qrToken: string;
  lifetimeSeconds?: number;
  seed?: string;
  useRotationWindow?: boolean;
};

export function buildQrToken(input: BuildQrTokenParams): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const lifetime =
    typeof input.lifetimeSeconds === "number" && input.lifetimeSeconds > 0
      ? input.lifetimeSeconds
      : 60 * 60 * 8; // 8h por defeito

  const expSec = nowSec + lifetime;
  const rot = input.useRotationWindow
    ? Math.floor(Date.now() / 15000)
    : undefined;

  return signTicketToORYA2({
    qrToken: input.qrToken,
    ticketId: input.ticketId,
    eventId: input.eventId,
    userId: input.userId,
    issuedAtSec: nowSec,
    expSec,
    seed: input.seed,
    rot,
  });
}

export function parseQrToken(token: string): VerifyORYA2Result {
  return parseAndVerifyORYA2(token);
}

export function isQrTokenExpired(token: string, nowSec?: number): boolean {
  const res = parseAndVerifyORYA2(token);
  if (!res.ok) {
    // Se o token for inválido ou expirar, consideramos expirado
    return true;
  }

  const now = nowSec ?? Math.floor(Date.now() / 1000);
  return typeof res.payload.exp === "number" && res.payload.exp < now;
}
