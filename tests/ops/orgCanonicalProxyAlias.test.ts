import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("proxy org canonical hard-cut", () => {
  it("returns 410 for legacy /organizacao/*", async () => {
    const req = new NextRequest("http://localhost/organizacao/manage?organizationId=42");
    const res = await proxy(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.errorCode).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.namespace).toBe("web");
  });

  it("returns 410 for legacy /api/organizacao/*", async () => {
    const req = new NextRequest("http://localhost/api/organizacao/events/list?organizationId=42");
    const res = await proxy(req);
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.errorCode).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.namespace).toBe("api");
  });

  it("returns 410 for removed PT legacy slugs under /org/:orgId", async () => {
    const legacyPaths = [
      "/org/42/financas",
      "/org/42/checkin",
      "/org/42/loja",
      "/org/42/manage",
      "/org/42/promote",
      "/org/42/tournaments",
      "/org/42/padel",
      "/org/42/padel/torneios",
      "/org/42/crm/clientes",
      "/org/42/crm/segmentos",
      "/org/42/crm/campanhas",
      "/org/42/crm/relatorios",
    ];
    for (const path of legacyPaths) {
      const req = new NextRequest(`http://localhost${path}`);
      const res = await proxy(req);
      expect(res.status).toBe(410);
    }
  });

  it("does not rewrite canonical /org/:orgId/* routes", async () => {
    const req = new NextRequest("http://localhost/org/42/finance/subscriptions");
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
