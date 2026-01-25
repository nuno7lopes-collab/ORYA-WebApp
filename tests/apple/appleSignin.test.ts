import { beforeEach, describe, expect, it } from "vitest";
import { SignJWT, createLocalJWKSet, decodeJwt, exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { buildAppleClientSecret, verifyAppleIdToken } from "@/lib/apple/signin";

const APPLE_ISSUER = "https://appleid.apple.com";

async function setAppleEnv() {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const pkcs8 = await exportPKCS8(privateKey);
  const privateKeyBase64 = Buffer.from(pkcs8).toString("base64");

  process.env.APPLE_SIGNIN_SERVICE_ID = "com.orya.web";
  process.env.APPLE_SIGNIN_REDIRECT_URI = "https://app.orya.pt/auth/callback";
  process.env.APPLE_SIGNIN_TEAM_ID = "TEAM123456";
  process.env.APPLE_SIGNIN_KEY_ID = "KEY123456";
  process.env.APPLE_SIGNIN_PRIVATE_KEY_BASE64 = privateKeyBase64;

  const jwk = await exportJWK(publicKey);
  jwk.kid = process.env.APPLE_SIGNIN_KEY_ID;

  return { privateKey, jwk };
}

describe("Apple Sign In helpers", () => {
  beforeEach(() => {
    delete process.env.APPLE_SIGNIN_SERVICE_ID;
    delete process.env.APPLE_SIGNIN_REDIRECT_URI;
    delete process.env.APPLE_SIGNIN_TEAM_ID;
    delete process.env.APPLE_SIGNIN_KEY_ID;
    delete process.env.APPLE_SIGNIN_PRIVATE_KEY_BASE64;
  });

  it("buildAppleClientSecret gera JWT com claims corretas", async () => {
    await setAppleEnv();
    const token = await buildAppleClientSecret();
    const payload = decodeJwt(token);
    const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;

    expect(payload.iss).toBe("TEAM123456");
    expect(payload.sub).toBe("com.orya.web");
    expect(aud).toBe(APPLE_ISSUER);
  });

  it("verifyAppleIdToken valida id_token e extrai sub/email", async () => {
    const { privateKey, jwk } = await setAppleEnv();
    const now = Math.floor(Date.now() / 1000);
    const idToken = await new SignJWT({ email: "user@orya.pt" })
      .setProtectedHeader({ alg: "ES256", kid: jwk.kid })
      .setIssuer(APPLE_ISSUER)
      .setAudience("com.orya.web")
      .setSubject("apple-sub-123")
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .sign(privateKey);

    const jwks = createLocalJWKSet({ keys: [jwk] });
    const verified = await verifyAppleIdToken(idToken, { jwks, audience: "com.orya.web" });

    expect(verified.sub).toBe("apple-sub-123");
    expect(verified.email).toBe("user@orya.pt");
  });
});
