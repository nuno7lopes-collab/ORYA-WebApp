import { createRemoteJWKSet, decodeJwt, jwtVerify, SignJWT, importPKCS8, createLocalJWKSet } from "jose";

type AppleSigninConfig = {
  serviceId: string;
  redirectUri: string;
  teamId: string;
  keyId: string;
  privateKey: string;
};

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = new URL("https://appleid.apple.com/auth/keys");

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value.trim();
}

export function getAppleSigninConfig(): AppleSigninConfig {
  return {
    serviceId: requireEnv("APPLE_SIGNIN_SERVICE_ID"),
    redirectUri: requireEnv("APPLE_SIGNIN_REDIRECT_URI"),
    teamId: requireEnv("APPLE_SIGNIN_TEAM_ID"),
    keyId: requireEnv("APPLE_SIGNIN_KEY_ID"),
    privateKey: Buffer.from(
      requireEnv("APPLE_SIGNIN_PRIVATE_KEY_BASE64"),
      "base64",
    ).toString("utf8"),
  };
}

export async function buildAppleClientSecret() {
  const cfg = getAppleSigninConfig();
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 5 * 60; // 5 min
  const key = await importPKCS8(cfg.privateKey, "ES256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setSubject(cfg.serviceId)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(key);
}

export async function verifyAppleIdToken(
  idToken: string,
  options?: { jwks?: ReturnType<typeof createLocalJWKSet>; audience?: string },
) {
  const cfg = getAppleSigninConfig();
  const audience = options?.audience ?? cfg.serviceId;
  const jwks = options?.jwks ?? createRemoteJWKSet(APPLE_JWKS_URL);

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: APPLE_ISSUER,
    audience,
  });

  return {
    sub: String(payload.sub ?? ""),
    email: typeof payload.email === "string" ? payload.email : null,
  };
}

export function decodeAppleIdToken(idToken: string) {
  return decodeJwt(idToken);
}
