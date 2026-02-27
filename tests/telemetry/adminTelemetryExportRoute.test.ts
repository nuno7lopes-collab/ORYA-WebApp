import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminUser = vi.hoisted(() => vi.fn());
const auditAdminAction = vi.hoisted(() => vi.fn());
const buildTelemetryExportCsv = vi.hoisted(() => vi.fn());
const buildTelemetryExportPreview = vi.hoisted(() => vi.fn());
const parseTelemetryExportDataset = vi.hoisted(() => vi.fn());
const buildTelemetryExportPdf = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdminUser,
}));

vi.mock("@/lib/admin/audit", () => ({
  auditAdminAction,
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

let GET: typeof import("@/app/api/admin/telemetry/export/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireAdminUser.mockReset();
  auditAdminAction.mockReset();
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

  GET = (await import("@/app/api/admin/telemetry/export/route")).GET;
});

describe("admin telemetry export route", () => {
  it("devolve erro de autenticação quando admin não é válido", async () => {
    requireAdminUser.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
    });

    const req = new NextRequest("http://localhost/api/admin/telemetry/export?dataset=events");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FORBIDDEN");
    expect(buildTelemetryExportCsv).not.toHaveBeenCalled();
  });

  it("devolve 400 para dataset inválido", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      userEmail: "admin@orya.pt",
    });
    parseTelemetryExportDataset.mockReturnValueOnce(null);

    const req = new NextRequest("http://localhost/api/admin/telemetry/export?dataset=unknown");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_DATASET");
    expect(buildTelemetryExportCsv).not.toHaveBeenCalled();
  });

  it("exporta CSV de eventos com filtros e audita ação", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      userEmail: "admin@orya.pt",
    });
    buildTelemetryExportCsv.mockResolvedValue({
      dataset: "events",
      csv: "id,eventName\n1,checkout.flow.started",
      rowCount: 1,
    });

    const req = new NextRequest(
      "http://localhost/api/admin/telemetry/export?dataset=events&orgId=22&hours=72&sourceType=WEB&severity=ERROR&q=checkout",
    );
    const res = await GET(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("telemetry_events_org_22_");
    expect(body).toContain("checkout.flow.started");
    expect(buildTelemetryExportCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset: "events",
        organizationId: 22,
        sourceType: "WEB",
        severity: "ERROR",
        query: "checkout",
        from: expect.any(Date),
        to: expect.any(Date),
      }),
    );
    expect(auditAdminAction).toHaveBeenCalledTimes(1);
  });

  it("devolve 400 para estados de incidente inválidos", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      userEmail: "admin@orya.pt",
    });

    const req = new NextRequest(
      "http://localhost/api/admin/telemetry/export?dataset=incidents&statuses=OPEN,INVALID",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_STATUSES");
    expect(buildTelemetryExportCsv).not.toHaveBeenCalled();
  });

  it("exporta incidentes com filtros de severidade e pesquisa", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      userEmail: "admin@orya.pt",
    });
    buildTelemetryExportCsv.mockResolvedValue({
      dataset: "incidents",
      csv: "id,title\ninc-1,Erro crítico",
      rowCount: 1,
    });

    const req = new NextRequest(
      "http://localhost/api/admin/telemetry/export?dataset=incidents&statuses=OPEN,ACKNOWLEDGED&severity=CRITICAL&q=timeout",
    );
    const res = await GET(req);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain("Erro crítico");
    expect(buildTelemetryExportCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset: "incidents",
        statuses: ["OPEN", "ACKNOWLEDGED"],
        severity: "CRITICAL",
        query: "timeout",
      }),
    );
  });

  it("exporta PDF quando format=pdf", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      userEmail: "admin@orya.pt",
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
      "http://localhost/api/admin/telemetry/export?dataset=events&format=pdf",
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
