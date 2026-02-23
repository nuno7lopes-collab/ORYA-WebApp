import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resolveOrganizationIdFromRequest, resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";

describe("resolveOrganizationIdFromRequest", () => {
  it("uses canonical /api/org/:orgId path when valid", () => {
    const req = new NextRequest("http://localhost/api/org/42/events/list?organizationId=99");
    expect(resolveOrganizationIdFromRequest(req)).toBe(42);
  });

  it("fails closed when /api/org/:orgId path segment is invalid", () => {
    const req = new NextRequest("http://localhost/api/org/abc/events/list?organizationId=42", {
      headers: { "x-orya-org-id": "42" },
    });
    expect(resolveOrganizationIdFromRequest(req)).toBeNull();
  });

  it("still accepts query organizationId outside /api/org namespace", () => {
    const req = new NextRequest("http://localhost/api/padel/clubs?organizationId=12");
    expect(resolveOrganizationIdFromRequest(req)).toBe(12);
  });
});

describe("resolveRequiredOrganizationIdFromRequest", () => {
  it("returns orgId when canonical org path is valid", () => {
    const req = new NextRequest("http://localhost/api/org/77/events/list");
    expect(resolveRequiredOrganizationIdFromRequest(req)).toEqual({ ok: true, organizationId: 77 });
  });

  it("fails when canonical org path is invalid", () => {
    const req = new NextRequest("http://localhost/api/org/abc/events/list?organizationId=77", {
      headers: { "x-orya-org-id": "77" },
    });
    expect(resolveRequiredOrganizationIdFromRequest(req)).toEqual({ ok: false, reason: "ORG_ID_REQUIRED" });
  });
});
