import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportPKCS8, generateKeyPair } from "jose";
import { APNS_BASE_URL, getApnsConfig, deliverApnsPush } from "@/lib/push/apns";

describe("APNs sender", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("envs obrigatórios estão presentes", async () => {
    const { privateKey } = await generateKeyPair("ES256");
    const pkcs8 = await exportPKCS8(privateKey);
    process.env.APNS_TEAM_ID = "TEAM123";
    process.env.APNS_KEY_ID = "KEY123";
    process.env.APNS_PRIVATE_KEY_BASE64 = Buffer.from(pkcs8).toString("base64");
    process.env.APNS_TOPIC = "pt.orya.app";

    const cfg = getApnsConfig();
    expect(cfg.teamId).toBe("TEAM123");
  });

  it("env em falta lança erro", () => {
    delete process.env.APNS_TEAM_ID;
    expect(() => getApnsConfig()).toThrow("Missing env var: APNS_TEAM_ID");
  });

  it("envia push com token-based auth (mock)", async () => {
    const { privateKey } = await generateKeyPair("ES256");
    const pkcs8 = await exportPKCS8(privateKey);
    process.env.APNS_TEAM_ID = "TEAM123";
    process.env.APNS_KEY_ID = "KEY123";
    process.env.APNS_PRIVATE_KEY_BASE64 = Buffer.from(pkcs8).toString("base64");
    process.env.APNS_TOPIC = "pt.orya.app";

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const res = await deliverApnsPush({
      token: "device-token",
      payload: { aps: { alert: "Teste" } },
    });

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`${APNS_BASE_URL}/device-token`);
    expect(options?.headers?.["apns-topic"]).toBe("pt.orya.app");
  });
});
