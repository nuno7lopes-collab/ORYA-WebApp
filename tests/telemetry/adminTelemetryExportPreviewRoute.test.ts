import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminUser = vi.hoisted(() => vi.fn());
const buildTelemetryExportPreview = vi.hoisted(() => vi.fn());
const parseTelemetryExportDataset = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdminUser,
}));

vi.mock("@/domain/telemetry/export", () => ({
  buildTelemetryExportPreview,
  parseTelemetryExportDataset,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let GET: typeof import("@/app/api/admin/telemetry/export/preview/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireAdminUser.mockReset();
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

  GET = (await import("@/app/api/admin/telemetry/export/preview/route")).GET;
});

describe("admin telemetry export preview route", () => {
  it("devolve 403 quando admin não tem acesso", async () => {
    requireAdminUser.mockResolvedValue({
      ok: false,
      status: 403,
      error: "FORBIDDEN",
    });

    const req = new NextRequest("http://localhost/api/admin/telemetry/export/preview?dataset=events");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("FORBIDDEN");
  });

  it("devolve preview para dataset válido", async () => {
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
      sampleSize: 20,
      truncated: false,
    });

    const req = new NextRequest(
      "http://localhost/api/admin/telemetry/export/preview?dataset=events&hours=24",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.preview?.dataset).toBe("events");
    expect(body.preview?.headers).toEqual(["eventName", "severity"]);
    expect(buildTelemetryExportPreview).toHaveBeenCalledTimes(1);
  });
});

