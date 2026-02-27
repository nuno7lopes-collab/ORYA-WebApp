import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminUser = vi.hoisted(() => vi.fn());
const listTelemetryIncidents = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdminUser,
}));

vi.mock("@/domain/telemetry/alerts", () => ({
  listTelemetryIncidents,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let GET: typeof import("@/app/api/admin/telemetry/incidents/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireAdminUser.mockReset();
  listTelemetryIncidents.mockReset();
  logError.mockReset();

  GET = (await import("@/app/api/admin/telemetry/incidents/route")).GET;
});

describe("admin telemetry incidents route", () => {
  it("bloqueia quando admin não está autenticado", async () => {
    requireAdminUser.mockResolvedValue({
      ok: false,
      status: 401,
      error: "UNAUTHENTICATED",
    });

    const req = new NextRequest("http://localhost/api/admin/telemetry/incidents");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTHENTICATED");
    expect(listTelemetryIncidents).not.toHaveBeenCalled();
  });

  it("aplica filtros e limites de paginação", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      userEmail: "admin@orya.pt",
    });
    listTelemetryIncidents.mockResolvedValue([
      {
        id: "inc-1",
        status: "OPEN",
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/admin/telemetry/incidents?orgId=42&statuses=OPEN,RESOLVED&severities=ERROR,CRITICAL&q=%20db%20timeout%20&ruleId=rule-1&take=999",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(listTelemetryIncidents).toHaveBeenCalledWith({
      organizationId: 42,
      statuses: ["OPEN", "RESOLVED"],
      severities: ["ERROR", "CRITICAL"],
      query: "db timeout",
      ruleId: "rule-1",
      take: 300,
    });
  });

  it("ignora filtros inválidos", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-2",
      userEmail: "admin2@orya.pt",
    });
    listTelemetryIncidents.mockResolvedValue([]);

    const req = new NextRequest(
      "http://localhost/api/admin/telemetry/incidents?orgId=-1&statuses=INVALID&severities=UNKNOWN&take=0",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listTelemetryIncidents).toHaveBeenCalledWith({
      organizationId: null,
      statuses: undefined,
      severities: undefined,
      ruleId: null,
      query: null,
      take: 100,
    });
  });
});

