import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { enforceB2CMobileOnly } from "@/app/api/messages/_scope";
import { POST as postAttachmentsPresign } from "@/app/api/messages/attachments/presign/route";

describe("messages b2c mobile gate", () => {
  it("allows org scope without mobile headers", () => {
    const req = new NextRequest("http://localhost/api/messages/messages?scope=org", {
      method: "POST",
    });
    const result = enforceB2CMobileOnly(req);
    expect(result).toBeNull();
  });

  it("blocks b2c non-mobile clients", async () => {
    const req = new NextRequest("http://localhost/api/messages/messages?scope=b2c", {
      method: "POST",
      headers: {
        "x-client-platform": "web",
      },
    });
    const result = enforceB2CMobileOnly(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
    const json = await result?.json();
    expect(json?.error).toBe("MOBILE_APP_REQUIRED");
  });

  it("enforces version gate for b2c mobile clients", async () => {
    const req = new NextRequest("http://localhost/api/messages/messages?scope=b2c", {
      method: "POST",
      headers: {
        "x-client-platform": "mobile",
      },
    });
    const result = enforceB2CMobileOnly(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(426);
    const json = await result?.json();
    expect(json?.error).toBe("UPGRADE_REQUIRED");
  });

  it("allows b2c mobile clients with valid version", () => {
    const req = new NextRequest("http://localhost/api/messages/messages?scope=b2c", {
      method: "POST",
      headers: {
        "x-client-platform": "mobile",
        "x-app-version": "1.0.0",
      },
    });
    const result = enforceB2CMobileOnly(req);
    expect(result).toBeNull();
  });
});

describe("messages attachments contract", () => {
  it("keeps attachments presign endpoint disabled", async () => {
    const req = new NextRequest("http://localhost/api/messages/attachments/presign", {
      method: "POST",
      body: JSON.stringify({ mime: "image/png" }),
    });

    const response = await postAttachmentsPresign(req);
    expect(response.status).toBe(410);

    const json = await response.json();
    expect(json?.error).toBe("ATTACHMENTS_DISABLED");
  });
});
