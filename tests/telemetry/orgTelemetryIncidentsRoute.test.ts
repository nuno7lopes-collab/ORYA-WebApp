import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireOrgTelemetryAccess = vi.hoisted(() => vi.fn());
const listTelemetryIncidentsPage = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/app/api/org/[orgId]/telemetry/_access", () => ({
  requireOrgTelemetryAccess,
}));

vi.mock("@/domain/telemetry/alerts", () => ({
  listTelemetryIncidentsPage,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let GET: typeof import("@/app/api/org/[orgId]/telemetry/incidents/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireOrgTelemetryAccess.mockReset();
  listTelemetryIncidentsPage.mockReset();
  logError.mockReset();

  GET = (await import("@/app/api/org/[orgId]/telemetry/incidents/route")).GET;
});

describe("org telemetry incidents route", () => {
  it("propaga erro de acesso", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "NO_ANALYTICS_ACCESS" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    const req = new NextRequest("http://localhost/api/org/77/telemetry/incidents");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NO_ANALYTICS_ACCESS");
    expect(listTelemetryIncidentsPage).not.toHaveBeenCalled();
  });

  it("aplica filtros no contexto da organização", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });
    listTelemetryIncidentsPage.mockResolvedValue({
      sort: "TRIGGERED_DESC",
      items: [{ id: "inc-9", status: "ACKNOWLEDGED" }],
      pagination: { hasMore: true, nextCursor: "cursor-9" },
    });

    const req = new NextRequest(
      "http://localhost/api/org/77/telemetry/incidents?statuses=OPEN,ACKNOWLEDGED&severities=WARN,ERROR&q=%20checkout%20&ruleId=rule-3&take=500",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.pagination).toEqual({ hasMore: true, nextCursor: "cursor-9" });
    expect(listTelemetryIncidentsPage).toHaveBeenCalledWith({
      organizationId: 77,
      statuses: ["OPEN", "ACKNOWLEDGED"],
      severities: ["WARN", "ERROR"],
      ruleId: "rule-3",
      query: "checkout",
      cursor: null,
      sort: "TRIGGERED_DESC",
      ackSlaMinutes: undefined,
      resolveSlaMinutes: undefined,
      take: 300,
    });
  });

  it("usa defaults quando filtros são inválidos", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 88,
      userId: "user-2",
    });
    listTelemetryIncidentsPage.mockResolvedValue({
      sort: "TRIGGERED_DESC",
      items: [],
      pagination: { hasMore: false, nextCursor: null },
    });

    const req = new NextRequest(
      "http://localhost/api/org/88/telemetry/incidents?statuses=bad&severities=bad&take=-1",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listTelemetryIncidentsPage).toHaveBeenCalledWith({
      organizationId: 88,
      statuses: undefined,
      severities: undefined,
      ruleId: null,
      query: null,
      cursor: null,
      sort: "TRIGGERED_DESC",
      ackSlaMinutes: undefined,
      resolveSlaMinutes: undefined,
      take: 100,
    });
  });

  it("aceita ordenação SLA e cursor", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 99,
      userId: "user-99",
    });
    listTelemetryIncidentsPage.mockResolvedValue({
      sort: "SLA_IMPACT_DESC",
      items: [],
      pagination: { hasMore: false, nextCursor: null },
    });

    const req = new NextRequest(
      "http://localhost/api/org/99/telemetry/incidents?sort=SLA_IMPACT_DESC&cursor=next-1&ackSlaMinutes=25&resolveSlaMinutes=240",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listTelemetryIncidentsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 99,
        sort: "SLA_IMPACT_DESC",
        cursor: "next-1",
        ackSlaMinutes: 25,
        resolveSlaMinutes: 240,
      }),
    );
  });
});
