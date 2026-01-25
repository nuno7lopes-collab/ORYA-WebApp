import { importPKCS8, SignJWT } from "jose";

type ApnsConfig = {
  teamId: string;
  keyId: string;
  privateKey: string;
  topic: string;
};

export const APNS_BASE_URL = "https://api.push.apple.com/3/device";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value.trim();
}

export function getApnsConfig(): ApnsConfig {
  return {
    teamId: requireEnv("APNS_TEAM_ID"),
    keyId: requireEnv("APNS_KEY_ID"),
    privateKey: Buffer.from(requireEnv("APNS_PRIVATE_KEY_BASE64"), "base64").toString("utf8"),
    topic: requireEnv("APNS_TOPIC"),
  };
}

export async function buildApnsJwt() {
  const cfg = getApnsConfig();
  const key = await importPKCS8(cfg.privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setIssuedAt(now)
    .sign(key);
}

export async function sendApnsPush(params: {
  token: string;
  payload: Record<string, unknown>;
  pushType?: "alert" | "background";
}) {
  const cfg = getApnsConfig();
  const jwt = await buildApnsJwt();
  const pushType = params.pushType ?? "alert";

  const res = await fetch(`${APNS_BASE_URL}/${params.token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": cfg.topic,
      "apns-push-type": pushType,
      "content-type": "application/json",
    },
    body: JSON.stringify(params.payload),
  });

  return { ok: res.ok, status: res.status };
}

export async function deliverApnsPush(params: {
  token: string;
  payload: Record<string, unknown>;
  pushType?: "alert" | "background";
}) {
  return sendApnsPush(params);
}
