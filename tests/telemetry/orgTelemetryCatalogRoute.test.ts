import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireOrgTelemetryAccess = vi.hoisted(() => vi.fn());
const listTelemetryCatalog = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/app/api/org/[orgId]/telemetry/_access", () => ({
  requireOrgTelemetryAccess,
}));

vi.mock("@/domain/telemetry/catalog", () => ({
  listTelemetryCatalog,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let GET: typeof import("@/app/api/org/[orgId]/telemetry/catalog/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireOrgTelemetryAccess.mockReset();
  listTelemetryCatalog.mockReset();
  logError.mockReset();

  GET = (await import("@/app/api/org/[orgId]/telemetry/catalog/route")).GET;
});

describe("org telemetry catalog route", () => {
  it("propaga erro de acesso", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "NO_ANALYTICS_ACCESS" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    const req = new NextRequest("http://localhost/api/org/77/telemetry/catalog");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NO_ANALYTICS_ACCESS");
  });

  it("devolve catálogo filtrado", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });
    listTelemetryCatalog.mockReturnValue([
      {
        eventName: "checkout.flow.started",
        eventVersion: "1.0.0",
        owner: "commerce",
        description: "Inicio checkout",
        defaultSeverity: "INFO",
        piiRisk: "LOW",
        aliases: ["checkout_started"],
      },
      {
        eventName: "auth.email.succeeded",
        eventVersion: "1.0.0",
        owner: "auth",
        description: "Login email",
        defaultSeverity: "INFO",
        piiRisk: "LOW",
        aliases: [],
      },
    ]);

    const req = new NextRequest("http://localhost/api/org/77/telemetry/catalog?q=auth");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].owner).toBe("auth");
  });
});

