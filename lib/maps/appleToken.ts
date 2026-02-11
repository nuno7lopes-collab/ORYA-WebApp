import crypto from "crypto";
import { getAppleMapsConfig } from "./appleConfig";

let cached: { token: string; expiresAt: number } | null = null;
let cachedAccess: { token: string; expiresAt: number } | null = null;

function base64Url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function mintAppleMapsToken(params?: { now?: Date }) {
  const now = params?.now ?? new Date();
  if (cached && cached.expiresAt > now.getTime() + 5_000) {
    return { token: cached.token, expiresAt: new Date(cached.expiresAt).toISOString() };
  }

  const cfg = getAppleMapsConfig({ allowMissingInDev: false });
  if (!cfg) {
    throw new Error("Apple Maps creds missing");
  }

  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + Math.max(60, Math.min(cfg.ttlSeconds || 900, 3600));

  const header = { alg: "ES256", kid: cfg.keyId, typ: "JWT" };
  const payload = cfg.origin
    ? { iss: cfg.teamId, iat, exp, origin: cfg.origin }
    : { iss: cfg.teamId, iat, exp };

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("SHA256");
  signer.update(data);
  signer.end();

  const signature = signer.sign({ key: cfg.privateKey, dsaEncoding: "ieee-p1363" });
  const token = `${data}.${base64Url(signature)}`;

  cached = { token, expiresAt: exp * 1000 };

  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const payload = parts[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const parsed = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { exp?: unknown };
    return typeof parsed.exp === "number" && Number.isFinite(parsed.exp) ? parsed.exp : null;
  } catch {
    return null;
  }
}

export async function mintAppleMapsAccessToken(params?: { now?: Date }) {
  const now = params?.now ?? new Date();
  if (cachedAccess && cachedAccess.expiresAt > now.getTime() + 5_000) {
    return { token: cachedAccess.token, expiresAt: new Date(cachedAccess.expiresAt).toISOString() };
  }

  const { token: authToken } = mintAppleMapsToken({ now });
  const res = await fetch("https://maps-api.apple.com/v1/token", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APPLE_MAPS_ERROR:${res.status}:${text}`);
  }

  const payload = (await res.json()) as { accessToken?: string };
  const accessToken = payload.accessToken?.trim();
  if (!accessToken) {
    throw new Error("APPLE_MAPS_ERROR:502:{\"error\":{\"message\":\"Missing accessToken from Apple Maps token endpoint\"}}");
  }

  const exp = decodeJwtExp(accessToken);
  const expiresAtMs = exp ? exp * 1000 : now.getTime() + 25 * 60 * 1000;
  cachedAccess = { token: accessToken, expiresAt: expiresAtMs };

  return { token: accessToken, expiresAt: new Date(expiresAtMs).toISOString() };
}
