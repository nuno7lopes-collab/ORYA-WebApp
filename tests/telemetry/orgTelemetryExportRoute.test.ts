import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireOrgTelemetryAccess = vi.hoisted(() => vi.fn());
const buildTelemetryExportCsv = vi.hoisted(() => vi.fn());
const buildTelemetryExportPreview = vi.hoisted(() => vi.fn());
const parseTelemetryExportDataset = vi.hoisted(() => vi.fn());
const buildTelemetryExportPdf = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/app/api/org/[orgId]/telemetry/_access", () => ({
  requireOrgTelemetryAccess,
}));

vi.mock("@/domain/telemetry/export", () => ({
  buildTelemetryExportCsv,
  buildTelemetryExportPreview,
  parseTelemetryExportDataset,
}));

vi.mock("@/lib/telemetry/exportPdf", () => ({
  buildTelemetryExportPdf,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let GET: typeof import("@/app/api/org/[orgId]/telemetry/export/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireOrgTelemetryAccess.mockReset();
  buildTelemetryExportCsv.mockReset();
  buildTelemetryExportPreview.mockReset();
  parseTelemetryExportDataset.mockReset();
  buildTelemetryExportPdf.mockReset();
  logError.mockReset();

  parseTelemetryExportDataset.mockImplementation((value: string | null | undefined) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["events", "incidents", "rules", "funnels", "funnel_results"].includes(normalized)) {
      return normalized;
    }
    return null;
  });

  GET = (await import("@/app/api/org/[orgId]/telemetry/export/route")).GET;
});

describe("org telemetry export route", () => {
  it("propaga resposta de acesso quando não autorizado", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "NO_ANALYTICS_ACCESS" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    const req = new NextRequest("http://localhost/api/org/77/telemetry/export?dataset=events");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NO_ANALYTICS_ACCESS");
    expect(buildTelemetryExportCsv).not.toHaveBeenCalled();
  });

  it("devolve 400 para dataset inválido", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });
    parseTelemetryExportDataset.mockReturnValueOnce(null);

    const req = new NextRequest("http://localhost/api/org/77/telemetry/export?dataset=abc");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_DATASET");
    expect(buildTelemetryExportCsv).not.toHaveBeenCalled();
  });

  it("exporta CSV da organização com filtros válidos", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });
    buildTelemetryExportCsv.mockResolvedValue({
      dataset: "events",
      csv: "id,eventName\n1,checkout.flow.started",
      rowCount: 1,
    });

    const req = new NextRequest(
      "http://localhost/api/org/77/telemetry/export?dataset=events&hours=24&sourceType=MOBILE&severity=WARN",
    );
    const res = await GET(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("telemetry_events_org_77_");
    expect(body).toContain("checkout.flow.started");
    expect(buildTelemetryExportCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset: "events",
        organizationId: 77,
        sourceType: "MOBILE",
        severity: "WARN",
        from: expect.any(Date),
        to: expect.any(Date),
      }),
    );
  });

  it("devolve 400 para sourceType inválido", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });

    const req = new NextRequest(
      "http://localhost/api/org/77/telemetry/export?dataset=events&sourceType=DESCONHECIDO",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_SOURCE_TYPE");
    expect(buildTelemetryExportCsv).not.toHaveBeenCalled();
  });

  it("exporta PDF da organização", async () => {
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
      sampleSize: 1,
      truncated: false,
    });
    buildTelemetryExportPdf.mockResolvedValue(Buffer.from("%PDF-1.4 mock"));

    const req = new NextRequest(
      "http://localhost/api/org/77/telemetry/export?dataset=events&format=pdf",
    );
    const res = await GET(req);
    const body = await res.arrayBuffer();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    expect(res.headers.get("content-disposition")).toContain(".pdf");
    expect(body.byteLength).toBeGreaterThan(0);
    expect(buildTelemetryExportPreview).toHaveBeenCalledTimes(1);
    expect(buildTelemetryExportPdf).toHaveBeenCalledTimes(1);
  });
});
