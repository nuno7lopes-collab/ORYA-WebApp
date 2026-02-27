import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminUser = vi.hoisted(() => vi.fn());
const listTelemetryCatalog = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdminUser,
}));

vi.mock("@/domain/telemetry/catalog", () => ({
  listTelemetryCatalog,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let GET: typeof import("@/app/api/admin/telemetry/catalog/route").GET;

beforeEach(async () => {
  vi.resetModules();
  requireAdminUser.mockReset();
  listTelemetryCatalog.mockReset();
  logError.mockReset();

  GET = (await import("@/app/api/admin/telemetry/catalog/route")).GET;
});

describe("admin telemetry catalog route", () => {
  it("bloqueia quando admin não está autenticado", async () => {
    requireAdminUser.mockResolvedValue({
      ok: false,
      status: 401,
      error: "UNAUTHENTICATED",
    });

    const req = new NextRequest("http://localhost/api/admin/telemetry/catalog");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("UNAUTHENTICATED");
  });

  it("filtra por owner e texto de pesquisa", async () => {
    requireAdminUser.mockResolvedValue({
      ok: true,
      userId: "admin-1",
      userEmail: "admin@orya.pt",
    });
    listTelemetryCatalog.mockReturnValue([
      {
        eventName: "checkout.flow.started",
        eventVersion: "1.0.0",
        owner: "commerce",
        description: "Inicio checkout",
        defaultSeverity: "INFO",
        piiRisk: "LOW",
        aliases: ["checkout_started"],
      },
      {
        eventName: "auth.email.succeeded",
        eventVersion: "1.0.0",
        owner: "auth",
        description: "Login email",
        defaultSeverity: "INFO",
        piiRisk: "LOW",
        aliases: [],
      },
    ]);

    const req = new NextRequest(
      "http://localhost/api/admin/telemetry/catalog?owner=commerce&q=checkout",
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.total).toBe(1);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].eventName).toBe("checkout.flow.started");
  });
});

