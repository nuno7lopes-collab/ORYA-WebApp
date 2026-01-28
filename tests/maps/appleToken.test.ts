import { describe, expect, it, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { GET } from "@/app/api/maps/apple-token/route";

const buildKey = () => {
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  return Buffer.from(pem).toString("base64");
};

const originalEnv = { ...process.env };

describe("apple-token endpoint", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("emite token quando credenciais existem", async () => {
    process.env.NODE_ENV = "test";
    process.env.APPLE_MAPS_TEAM_ID = "T1";
    process.env.APPLE_MAPS_KEY_ID = "K1";
    process.env.APPLE_MAPS_PRIVATE_KEY_BASE64 = buildKey();
    process.env.APPLE_MAPS_TOKEN_TTL_SECONDS = "120";

    const res = await GET(new Request("http://localhost/api/maps/apple-token"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(typeof json.result.token).toBe("string");
    expect(json.result.token.split(".").length).toBe(3);
  });

  it("dev sem credenciais devolve fallback", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.APPLE_MAPS_TEAM_ID;
    delete process.env.APPLE_MAPS_KEY_ID;
    delete process.env.APPLE_MAPS_PRIVATE_KEY_BASE64;

    const res = await GET(new Request("http://localhost/api/maps/apple-token"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.result.provider).toBe("osm");
  });

  it("prod sem credenciais falha", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.APPLE_MAPS_TEAM_ID;
    delete process.env.APPLE_MAPS_KEY_ID;
    delete process.env.APPLE_MAPS_PRIVATE_KEY_BASE64;

    const res = await GET(new Request("http://localhost/api/maps/apple-token"));
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
  });
});
