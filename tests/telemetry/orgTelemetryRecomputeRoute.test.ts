import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireOrgTelemetryAccess = vi.hoisted(() => vi.fn());
const recomputeTelemetryMetricRollups = vi.hoisted(() => vi.fn());
const evaluateTelemetryAlertRules = vi.hoisted(() => vi.fn());
const recomputeTelemetryFunnelResults = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/app/api/org/[orgId]/telemetry/_access", () => ({
  requireOrgTelemetryAccess,
}));

vi.mock("@/domain/telemetry/rollup", () => ({
  recomputeTelemetryMetricRollups,
}));

vi.mock("@/domain/telemetry/alerts", () => ({
  evaluateTelemetryAlertRules,
}));

vi.mock("@/domain/telemetry/funnels", () => ({
  recomputeTelemetryFunnelResults,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let POST: typeof import("@/app/api/org/[orgId]/telemetry/recompute/route").POST;

beforeEach(async () => {
  vi.resetModules();
  requireOrgTelemetryAccess.mockReset();
  recomputeTelemetryMetricRollups.mockReset();
  evaluateTelemetryAlertRules.mockReset();
  recomputeTelemetryFunnelResults.mockReset();
  logError.mockReset();

  POST = (await import("@/app/api/org/[orgId]/telemetry/recompute/route")).POST;
});

describe("org telemetry recompute route", () => {
  it("devolve resposta de acesso quando sem permissões", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "FORBIDDEN" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    const req = new NextRequest("http://localhost/api/org/77/telemetry/recompute", {
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FORBIDDEN");
    expect(recomputeTelemetryMetricRollups).not.toHaveBeenCalled();
  });

  it("executa rollup, avaliação e recompute de funis por defeito", async () => {
    const from = new Date("2026-02-27T10:00:00.000Z");
    const to = new Date("2026-02-27T11:00:00.000Z");

    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });

    recomputeTelemetryMetricRollups.mockResolvedValue({
      from,
      to,
      bucketUnit: "HOUR",
      rows: { totalRows: 1, eventRows: 2, sourceRows: 2, actorRows: 2 },
      written: 7,
    });

    evaluateTelemetryAlertRules.mockResolvedValue({
      evaluatedRules: 3,
      evaluatedOrganizations: 1,
      openedIncidents: 1,
      updatedIncidents: 0,
      resolvedIncidents: 0,
      skippedByCooldown: 0,
      breachesDetected: 1,
      errors: 0,
    });

    recomputeTelemetryFunnelResults.mockResolvedValue({
      from,
      to,
      bucketUnit: "HOUR",
      organizations: 1,
      funnels: 2,
      buckets: 3,
      rowsDeleted: 4,
      rowsWritten: 6,
      skippedFunnels: 0,
      errors: 0,
    });

    const req = new NextRequest(
      "http://localhost/api/org/77/telemetry/recompute?bucket=HOUR&hours=24",
      {
        method: "POST",
      },
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.rollup?.written).toBe(7);
    expect(body.evaluation?.evaluatedRules).toBe(3);
    expect(body.funnels?.rowsWritten).toBe(6);

    expect(recomputeTelemetryMetricRollups).toHaveBeenCalledTimes(1);
    expect(recomputeTelemetryMetricRollups).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 77,
        bucketUnit: "HOUR",
      }),
    );
    expect(evaluateTelemetryAlertRules).toHaveBeenCalledWith({ organizationId: 77 });
    expect(recomputeTelemetryFunnelResults).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 77, bucketUnit: "HOUR" }),
    );
  });

  it("respeita flags evaluate=false e funnels=false", async () => {
    const from = new Date("2026-02-27T10:00:00.000Z");
    const to = new Date("2026-02-27T11:00:00.000Z");

    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });

    recomputeTelemetryMetricRollups.mockResolvedValue({
      from,
      to,
      bucketUnit: "DAY",
      rows: { totalRows: 1, eventRows: 1, sourceRows: 1, actorRows: 1 },
      written: 4,
    });

    const req = new NextRequest(
      "http://localhost/api/org/77/telemetry/recompute?bucket=DAY&hours=48&evaluate=false&funnels=false",
      {
        method: "POST",
      },
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.evaluation).toBeNull();
    expect(body.funnels).toBeNull();
    expect(evaluateTelemetryAlertRules).not.toHaveBeenCalled();
    expect(recomputeTelemetryFunnelResults).not.toHaveBeenCalled();
  });

  it("devolve 500 e faz log quando ocorre erro interno", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });

    recomputeTelemetryMetricRollups.mockRejectedValue(new Error("db down"));

    const req = new NextRequest("http://localhost/api/org/77/telemetry/recompute", {
      method: "POST",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INTERNAL_ERROR");
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
