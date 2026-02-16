import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { enforceB2CMobileOnly } from "@/app/api/messages/_scope";
import { POST as postAttachmentsPresign } from "@/app/api/messages/attachments/presign/route";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("messages b2c mobile gate", () => {
  const previousMinVersion = process.env.MIN_SUPPORTED_MOBILE_VERSION;

  beforeAll(() => {
    process.env.MIN_SUPPORTED_MOBILE_VERSION = "1.0.0";
  });

  afterAll(() => {
    if (previousMinVersion == null) {
      delete process.env.MIN_SUPPORTED_MOBILE_VERSION;
      return;
    }
    process.env.MIN_SUPPORTED_MOBILE_VERSION = previousMinVersion;
  });

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
  it("enforces mobile gate for b2c attachments presign", async () => {
    const req = new NextRequest("http://localhost/api/messages/attachments/presign?scope=b2c", {
      method: "POST",
      headers: {
        "x-client-platform": "web",
      },
      body: JSON.stringify({ mime: "image/png", size: 1024, checksumSha256: "a".repeat(64) }),
    });

    const response = await postAttachmentsPresign(req);
    expect(response.status).toBe(403);

    const json = await response.json();
    expect(json?.error).toBe("MOBILE_APP_REQUIRED");
  });

  it("keeps attachments presign enabled with security guardrails", () => {
    const handler = readLocal("lib/messages/handlers/chat/attachments/presign/route.ts");
    const messageRoute = readLocal("lib/messages/handlers/chat/messages/route.ts");

    expect(handler).not.toContain("ATTACHMENTS_DISABLED");
    expect(handler).toContain("createSignedUploadUrl");
    expect(handler).toContain("ATTACHMENT_QUOTA_EXCEEDED");
    expect(handler).toContain('scanStatus: "ready"');
    expect(handler).toContain('dlpStatus: "passed"');
    expect(messageRoute).toContain("ATTACHMENT_METADATA_REQUIRED");
    expect(messageRoute).toContain("ATTACHMENT_CHECKSUM_FAILED");
  });
});
