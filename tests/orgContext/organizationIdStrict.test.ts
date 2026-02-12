import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resolveOrganizationIdStrict } from "@/lib/organizationId";

describe("resolveOrganizationIdStrict", () => {
  it("resolves organizationId when query and header match", () => {
    const req = new NextRequest("http://localhost/api/test?organizationId=12", {
      headers: { "x-orya-org-id": "12" },
    });
    const result = resolveOrganizationIdStrict({ req, allowFallback: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.organizationId).toBe(12);
    }
  });

  it("fails on conflicting organizationIds", () => {
    const req = new NextRequest("http://localhost/api/test?organizationId=12", {
      headers: { "x-orya-org-id": "13" },
    });
    const result = resolveOrganizationIdStrict({ req, allowFallback: false });
    expect(result).toMatchObject({ ok: false, reason: "CONFLICT" });
  });

  it("fails on invalid organizationId", () => {
    const req = new NextRequest("http://localhost/api/test?organizationId=abc");
    const result = resolveOrganizationIdStrict({ req, allowFallback: false });
    expect(result).toMatchObject({ ok: false, reason: "INVALID", source: "query" });
  });

  it("resolves from body when present", () => {
    const req = new NextRequest("http://localhost/api/test");
    const result = resolveOrganizationIdStrict({
      req,
      body: { organizationId: 55 },
      allowFallback: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.organizationId).toBe(55);
      expect(result.source).toBe("body");
    }
  });

  it("returns missing when no source provided", () => {
    const req = new NextRequest("http://localhost/api/test");
    const result = resolveOrganizationIdStrict({ req, allowFallback: false });
    expect(result).toMatchObject({ ok: false, reason: "MISSING" });
  });
});
