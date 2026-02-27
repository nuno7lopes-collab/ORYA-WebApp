import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireOrgTelemetryAccess = vi.hoisted(() => vi.fn());
const listTelemetryIncidents = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/app/api/org/[orgId]/telemetry/_access", () => ({
  requireOrgTelemetryAccess,
}));

vi.mock("@/domain/telemetry/alerts", () => ({
  listTelemetryIncidents,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let GET: typeof import("@/app/api/org/[orgId]/telemetry/incidents/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireOrgTelemetryAccess.mockReset();
  listTelemetryIncidents.mockReset();
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
    expect(listTelemetryIncidents).not.toHaveBeenCalled();
  });

  it("aplica filtros no contexto da organização", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });
    listTelemetryIncidents.mockResolvedValue([{ id: "inc-9", status: "ACKNOWLEDGED" }]);

    const req = new NextRequest(
      "http://localhost/api/org/77/telemetry/incidents?statuses=OPEN,ACKNOWLEDGED&severities=WARN,ERROR&q=%20checkout%20&ruleId=rule-3&take=500",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(listTelemetryIncidents).toHaveBeenCalledWith({
      organizationId: 77,
      statuses: ["OPEN", "ACKNOWLEDGED"],
      severities: ["WARN", "ERROR"],
      ruleId: "rule-3",
      query: "checkout",
      take: 300,
    });
  });

  it("usa defaults quando filtros são inválidos", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 88,
      userId: "user-2",
    });
    listTelemetryIncidents.mockResolvedValue([]);

    const req = new NextRequest(
      "http://localhost/api/org/88/telemetry/incidents?statuses=bad&severities=bad&take=-1",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listTelemetryIncidents).toHaveBeenCalledWith({
      organizationId: 88,
      statuses: undefined,
      severities: undefined,
      ruleId: null,
      query: null,
      take: 100,
    });
  });
});

