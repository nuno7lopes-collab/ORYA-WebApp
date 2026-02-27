import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireOrgTelemetryAccess = vi.hoisted(() => vi.fn());
const getTelemetryOverview = vi.hoisted(() => vi.fn());
const listTelemetryIncidents = vi.hoisted(() => vi.fn());
const listTelemetryAlertRules = vi.hoisted(() => vi.fn());
const getTelemetryIncidentKpis = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/app/api/org/[orgId]/telemetry/_access", () => ({
  requireOrgTelemetryAccess,
}));

vi.mock("@/domain/telemetry/query", () => ({
  getTelemetryOverview,
}));

vi.mock("@/domain/telemetry/alerts", () => ({
  listTelemetryIncidents,
  listTelemetryAlertRules,
  getTelemetryIncidentKpis,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let GET: typeof import("@/app/api/org/[orgId]/telemetry/overview/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireOrgTelemetryAccess.mockReset();
  getTelemetryOverview.mockReset();
  listTelemetryIncidents.mockReset();
  listTelemetryAlertRules.mockReset();
  getTelemetryIncidentKpis.mockReset();
  logError.mockReset();

  GET = (await import("@/app/api/org/[orgId]/telemetry/overview/route")).GET;
});

describe("org telemetry overview route", () => {
  it("propaga erro de acesso", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "NO_ANALYTICS_ACCESS" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    const req = new NextRequest("http://localhost/api/org/77/telemetry/overview");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NO_ANALYTICS_ACCESS");
  });

  it("devolve overview da organização com KPIs de incidentes", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });
    getTelemetryOverview.mockResolvedValue({
      window: { hours: 24, from: "2026-02-26T00:00:00.000Z", to: "2026-02-27T00:00:00.000Z" },
      totals: { totalEvents: 640, errorEvents: 12, uniqueActors: 180, errorRateBps: 187 },
      sourceBreakdown: [],
      topEvents: [],
      timeline: [],
      latest: [],
    });
    listTelemetryIncidents.mockResolvedValue([{ id: "inc-1", status: "OPEN" }]);
    listTelemetryAlertRules.mockResolvedValue([{ id: "rule-1", isActive: true }]);
    getTelemetryIncidentKpis.mockResolvedValue({
      from: new Date("2026-02-26T00:00:00.000Z"),
      to: new Date("2026-02-27T00:00:00.000Z"),
      windowMinutes: 1440,
      totalIncidents: 4,
      openIncidents: 2,
      acknowledgedIncidents: 1,
      resolvedIncidents: 1,
      acknowledgedSamples: 2,
      resolvedSamples: 1,
      mttaMinutes: 4.5,
      mttrMinutes: 26.2,
      ackSlaMinutes: 15,
      resolveSlaMinutes: 120,
      ackSlaBreaches: 0,
      resolveSlaBreaches: 1,
    });

    const req = new NextRequest("http://localhost/api/org/77/telemetry/overview?hours=24");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.totals.totalEvents).toBe(640);
    expect(body.incidents).toHaveLength(1);
    expect(body.rules).toHaveLength(1);
    expect(body.incidentKpis.mttrMinutes).toBe(26.2);
    expect(getTelemetryOverview).toHaveBeenCalledWith({ organizationId: 77, hours: 24 });
    expect(getTelemetryIncidentKpis).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 77,
        from: expect.any(Date),
        to: expect.any(Date),
      }),
    );
  });
});

