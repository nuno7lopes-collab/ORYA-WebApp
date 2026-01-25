import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/.well-known/apple-app-site-association/route";

describe("apple-app-site-association", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env = { ...env };
  });

  it("responde com config quando envs existem", async () => {
    process.env.APPLE_SIGNIN_TEAM_ID = "TEAM123456";
    process.env.APPLE_SIGNIN_SERVICE_ID = "com.orya.web";

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body?.applinks?.details?.[0]?.appID).toBe("TEAM123456.com.orya.web");
  });

  it("falha com 500 quando envs faltam", async () => {
    delete process.env.APPLE_SIGNIN_TEAM_ID;
    delete process.env.APPLE_SIGNIN_SERVICE_ID;

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
