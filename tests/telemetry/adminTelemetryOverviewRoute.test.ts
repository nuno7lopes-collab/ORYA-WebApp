import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminUser = vi.hoisted(() => vi.fn());
const getTelemetryOverview = vi.hoisted(() => vi.fn());
const listTelemetryIncidents = vi.hoisted(() => vi.fn());
const listTelemetryAlertRules = vi.hoisted(() => vi.fn());
const getTelemetryIncidentKpis = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdminUser,
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

let GET: typeof import("@/app/api/admin/telemetry/overview/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireAdminUser.mockReset();
  getTelemetryOverview.mockReset();
  listTelemetryIncidents.mockReset();
  listTelemetryAlertRules.mockReset();
  getTelemetryIncidentKpis.mockReset();
  logError.mockReset();

  GET = (await import("@/app/api/admin/telemetry/overview/route")).GET;
});

describe("admin telemetry overview route", () => {
  it("bloqueia pedido sem sessão admin", async () => {
    requireAdminUser.mockResolvedValue({
      ok: false,
      status: 401,
      error: "UNAUTHENTICATED",
    });

    const req = new NextRequest("http://localhost/api/admin/telemetry/overview");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTHENTICATED");
  });

  it("devolve overview com incidentKpis", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      userEmail: "admin@orya.pt",
    });
    getTelemetryOverview.mockResolvedValue({
      window: { hours: 72, from: "2026-02-26T00:00:00.000Z", to: "2026-02-27T00:00:00.000Z" },
      totals: { totalEvents: 1200, errorEvents: 24, uniqueActors: 330, errorRateBps: 200 },
      sourceBreakdown: [],
      topEvents: [],
      timeline: [],
      latest: [],
    });
    listTelemetryIncidents.mockResolvedValue([{ id: "inc-1" }]);
    listTelemetryAlertRules.mockResolvedValue([{ id: "rule-1" }]);
    getTelemetryIncidentKpis.mockResolvedValue({
      from: new Date("2026-02-26T00:00:00.000Z"),
      to: new Date("2026-02-27T00:00:00.000Z"),
      windowMinutes: 1440,
      totalIncidents: 9,
      openIncidents: 3,
      acknowledgedIncidents: 2,
      resolvedIncidents: 4,
      acknowledgedSamples: 5,
      resolvedSamples: 4,
      mttaMinutes: 5.2,
      mttrMinutes: 31.1,
      ackSlaMinutes: 15,
      resolveSlaMinutes: 120,
      ackSlaBreaches: 1,
      resolveSlaBreaches: 2,
    });

    const req = new NextRequest("http://localhost/api/admin/telemetry/overview?hours=72&orgId=11");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.overview.totals.totalEvents).toBe(1200);
    expect(body.incidents).toHaveLength(1);
    expect(body.rules).toHaveLength(1);
    expect(body.incidentKpis.totalIncidents).toBe(9);
    expect(getTelemetryOverview).toHaveBeenCalledWith({ organizationId: 11, hours: 72 });
    expect(getTelemetryIncidentKpis).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 11,
        from: expect.any(Date),
        to: expect.any(Date),
      }),
    );
  });
});

