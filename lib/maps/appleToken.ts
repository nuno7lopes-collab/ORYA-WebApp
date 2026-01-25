import crypto from "crypto";
import { getAppleMapsConfig } from "./appleConfig";

let cached: { token: string; expiresAt: number } | null = null;

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
  const payload = { iss: cfg.teamId, iat, exp };

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
