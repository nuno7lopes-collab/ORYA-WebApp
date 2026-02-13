import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy org canonical aliasing", () => {
  it("redirects legacy /organizacao/* to canonical /org/:orgId/*", async () => {
    const req = new NextRequest("http://localhost/organizacao/manage?organizationId=42");
    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get("location") ?? "").toContain("/org/42/operations");
  });

  it("returns 410 for legacy /api/organizacao/*", async () => {
    const req = new NextRequest("http://localhost/api/organizacao/events/list?organizationId=42");
    const res = await proxy(req);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("LEGACY_ROUTE_REMOVED");
  });

  it("redirects legacy /organizacao/* using organization cookie fallback", async () => {
    const req = new NextRequest("http://localhost/organizacao/crm", {
      headers: { cookie: "orya_organization=50" },
    });
    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get("location") ?? "").toContain("/org/50/crm");
  });

  it("redirects legacy /organizacao/* without org context to organizations hub", async () => {
    const req = new NextRequest("http://localhost/organizacao/crm");
    const res = await proxy(req);

    expect(res.status).toBe(301);
    expect(res.headers.get("location") ?? "").toContain("/org-hub/organizations");
  });

  it("does not rewrite canonical /org/:orgId/* routes", async () => {
    const req = new NextRequest("http://localhost/org/42/finance?tab=invoices");
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("rejects org context via query/header in /api/org/:orgId", async () => {
    const req = new NextRequest("http://localhost/api/org/42/events?organizationId=42", {
      headers: { "x-orya-org-id": "42" },
    });
    const res = await proxy(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_ORG_CONTEXT_SOURCE");
  });

  it("does not rewrite canonical /api/org/:orgId/* routes", async () => {
    const req = new NextRequest("http://localhost/api/org/42/events/list");
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does not rewrite canonical /org-hub web routes", async () => {
    const req = new NextRequest("http://localhost/org-hub/organizations");
    const res = await proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does not rewrite canonical /api/org-hub or /api/org-system routes", async () => {
    const hubReq = new NextRequest("http://localhost/api/org-hub/organizations");
    const hubRes = await proxy(hubReq);
    expect(hubRes.status).toBe(200);
    expect(hubRes.headers.get("x-middleware-rewrite")).toBeNull();

    const systemReq = new NextRequest("http://localhost/api/org-system/payouts/webhook");
    const systemRes = await proxy(systemReq);
    expect(systemRes.status).toBe(200);
    expect(systemRes.headers.get("x-middleware-rewrite")).toBeNull();
  });
});
