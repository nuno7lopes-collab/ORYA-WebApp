import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireOrgTelemetryAccess = vi.hoisted(() => vi.fn());
const buildTelemetryExportPreview = vi.hoisted(() => vi.fn());
const parseTelemetryExportDataset = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/app/api/org/[orgId]/telemetry/_access", () => ({
  requireOrgTelemetryAccess,
}));

vi.mock("@/domain/telemetry/export", () => ({
  buildTelemetryExportPreview,
  parseTelemetryExportDataset,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let GET: typeof import("@/app/api/org/[orgId]/telemetry/export/preview/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireOrgTelemetryAccess.mockReset();
  buildTelemetryExportPreview.mockReset();
  parseTelemetryExportDataset.mockReset();
  logError.mockReset();

  parseTelemetryExportDataset.mockImplementation((value: string | null | undefined) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["events", "incidents", "rules", "funnels", "funnel_results"].includes(normalized)) {
      return normalized;
    }
    return null;
  });

  GET = (await import("@/app/api/org/[orgId]/telemetry/export/preview/route")).GET;
});

describe("org telemetry export preview route", () => {
  it("propaga erro de acesso", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "NO_ANALYTICS_ACCESS" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    const req = new NextRequest("http://localhost/api/org/77/telemetry/export/preview?dataset=events");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NO_ANALYTICS_ACCESS");
  });

  it("devolve preview para organização", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });
    buildTelemetryExportPreview.mockResolvedValue({
      dataset: "events",
      headers: ["eventName", "severity"],
      rows: [["checkout.flow.started", "INFO"]],
      rowCount: 1,
      sampleSize: 20,
      truncated: false,
    });

    const req = new NextRequest(
      "http://localhost/api/org/77/telemetry/export/preview?dataset=events&hours=24",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.preview?.dataset).toBe("events");
    expect(body.preview?.headers).toEqual(["eventName", "severity"]);
    expect(buildTelemetryExportPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 77,
        dataset: "events",
      }),
    );
  });
});

