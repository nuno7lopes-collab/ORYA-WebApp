export type AppleMapsConfig = {
  teamId: string;
  keyId: string;
  privateKey: string;
  origin?: string | null;
  ttlSeconds: number;
};

export function getAppleMapsConfig(options?: { allowMissingInDev?: boolean }) {
  const teamId = process.env.APPLE_MAPS_TEAM_ID ?? process.env.APPLE_SIGNIN_TEAM_ID;
  const keyId = process.env.APPLE_MAPS_KEY_ID;
  const privateKeyBase64 = process.env.APPLE_MAPS_PRIVATE_KEY_BASE64;
  const origin = process.env.APPLE_MAPS_ORIGIN ?? null;
  const ttlRaw = process.env.APPLE_MAPS_TOKEN_TTL_SECONDS;
  const ttlSeconds = Number(ttlRaw || 900);

  const missing = !teamId || !keyId || !privateKeyBase64;
  if (missing) {
    if (process.env.NODE_ENV === "production" || !options?.allowMissingInDev) {
      throw new Error("Apple Maps creds missing");
    }
    return null;
  }

  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf8").trim();
  return { teamId, keyId, privateKey, origin, ttlSeconds } satisfies AppleMapsConfig;
}

export function isAppleMapsConfigured() {
  try {
    return Boolean(getAppleMapsConfig({ allowMissingInDev: true }));
  } catch {
    return false;
  }
}
