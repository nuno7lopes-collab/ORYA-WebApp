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

  it("does not block public availability compatibility routes", async () => {
    const slotsReq = new NextRequest("http://localhost/api/servicos/9/slots?day=2026-03-01");
    const slotsRes = await proxy(slotsReq);
    expect(slotsRes.status).toBe(200);
    expect(slotsRes.headers.get("x-middleware-rewrite")).toBeNull();

    const disponibilidadeReq = new NextRequest("http://localhost/api/servicos/9/disponibilidade?day=2026-03-01");
    const disponibilidadeRes = await proxy(disponibilidadeReq);
    expect(disponibilidadeRes.status).toBe(200);
    expect(disponibilidadeRes.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("returns 410 for removed /api/org/:orgId/payouts/* routes", async () => {
    const req = new NextRequest("http://localhost/api/org/42/payouts/status");
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
      "/org/42/eventos",
      "/org/42/reservas",
      "/org/42/treinadores",
      "/org/42/manage",
      "/org/42/promote",
      "/org/42/torneios",
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

  it("returns 410 for removed finance/analytics legacy sub-routes", async () => {
    const req = new NextRequest("http://localhost/org/42/bookings/services");
    const res = await proxy(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.errorCode).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.namespace).toBe("web");
  });

  it("returns 410 for removed legacy bookings query routes", async () => {
    const legacyQueryPaths = [
      "http://localhost/org/42/bookings?tab=availability",
      "http://localhost/org/42/bookings?bookings=availability",
      "http://localhost/org/42/bookings?bookings=prices",
      "http://localhost/org/42/bookings?bookings=integrations",
    ];
    for (const path of legacyQueryPaths) {
      const req = new NextRequest(path);
      const res = await proxy(req);
      expect(res.status).toBe(410);
      const body = await res.json();
      expect(body.error).toBe("LEGACY_ROUTE_REMOVED");
      expect(body.errorCode).toBe("LEGACY_ROUTE_REMOVED");
      expect(body.namespace).toBe("web");
    }
  });

  it("returns 410 for removed finance/analytics legacy sub-routes", async () => {
    const req = new NextRequest("http://localhost/org/42/finance/subscriptions");
    const res = await proxy(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.errorCode).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.namespace).toBe("web");
  });

  it("returns 410 for removed finance/analytics legacy query keys", async () => {
    const req = new NextRequest("http://localhost/org/42/analytics?tab=analyze&section=vendas&analytics=conversion");
    const res = await proxy(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.errorCode).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.namespace).toBe("web");
  });

  it("returns 410 for shorthand /org/overview using organizationId context", async () => {
    const req = new NextRequest("http://localhost/org/overview?organizationId=42&section=ferramentas");
    const res = await proxy(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.errorCode).toBe("LEGACY_ROUTE_REMOVED");
  });

  it("returns 410 for shorthand /org/overview using organization cookie fallback", async () => {
    const req = new NextRequest("http://localhost/org/overview?section=ferramentas", {
      headers: {
        cookie: "orya_organization=42",
      },
    });
    const res = await proxy(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.errorCode).toBe("LEGACY_ROUTE_REMOVED");
  });

  it("returns 410 for shorthand /org/treinadores", async () => {
    const req = new NextRequest("http://localhost/org/treinadores");
    const res = await proxy(req);

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toBe("LEGACY_ROUTE_REMOVED");
    expect(body.errorCode).toBe("LEGACY_ROUTE_REMOVED");
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
