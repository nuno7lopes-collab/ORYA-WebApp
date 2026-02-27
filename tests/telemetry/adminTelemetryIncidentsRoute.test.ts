import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminUser = vi.hoisted(() => vi.fn());
const listTelemetryIncidentsPage = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdminUser,
}));

vi.mock("@/domain/telemetry/alerts", () => ({
  listTelemetryIncidentsPage,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let GET: typeof import("@/app/api/admin/telemetry/incidents/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireAdminUser.mockReset();
  listTelemetryIncidentsPage.mockReset();
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
    expect(listTelemetryIncidentsPage).not.toHaveBeenCalled();
  });

  it("aplica filtros e limites de paginação", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      userEmail: "admin@orya.pt",
    });
    listTelemetryIncidentsPage.mockResolvedValue({
      sort: "TRIGGERED_DESC",
      items: [{ id: "inc-1", status: "OPEN" }],
      pagination: { hasMore: true, nextCursor: "cursor-1" },
    });

    const req = new NextRequest(
      "http://localhost/api/admin/telemetry/incidents?orgId=42&statuses=OPEN,RESOLVED&severities=ERROR,CRITICAL&q=%20db%20timeout%20&ruleId=rule-1&take=999",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.pagination).toEqual({ hasMore: true, nextCursor: "cursor-1" });
    expect(body.sort).toBe("TRIGGERED_DESC");
    expect(listTelemetryIncidentsPage).toHaveBeenCalledWith({
      organizationId: 42,
      statuses: ["OPEN", "RESOLVED"],
      severities: ["ERROR", "CRITICAL"],
      query: "db timeout",
      ruleId: "rule-1",
      cursor: null,
      sort: "TRIGGERED_DESC",
      ackSlaMinutes: undefined,
      resolveSlaMinutes: undefined,
      take: 300,
    });
  });

  it("ignora filtros inválidos", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-2",
      userEmail: "admin2@orya.pt",
    });
    listTelemetryIncidentsPage.mockResolvedValue({
      sort: "TRIGGERED_DESC",
      items: [],
      pagination: { hasMore: false, nextCursor: null },
    });

    const req = new NextRequest(
      "http://localhost/api/admin/telemetry/incidents?orgId=-1&statuses=INVALID&severities=UNKNOWN&take=0",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listTelemetryIncidentsPage).toHaveBeenCalledWith({
      organizationId: null,
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
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-3",
      userEmail: "admin3@orya.pt",
    });
    listTelemetryIncidentsPage.mockResolvedValue({
      sort: "SLA_IMPACT_DESC",
      items: [],
      pagination: { hasMore: false, nextCursor: null },
    });

    const req = new NextRequest(
      "http://localhost/api/admin/telemetry/incidents?sort=SLA_IMPACT_DESC&cursor=abc&ackSlaMinutes=20&resolveSlaMinutes=180",
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(listTelemetryIncidentsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: "SLA_IMPACT_DESC",
        cursor: "abc",
        ackSlaMinutes: 20,
        resolveSlaMinutes: 180,
      }),
    );
  });
});
