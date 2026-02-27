import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireOrgTelemetryAccess = vi.hoisted(() => vi.fn());
const getTelemetryFunnelDefinitionById = vi.hoisted(() => vi.fn());
const parseTelemetryFunnelPatchInput = vi.hoisted(() => vi.fn());
const updateTelemetryFunnelDefinition = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/app/api/org/[orgId]/telemetry/_access", () => ({
  requireOrgTelemetryAccess,
}));

vi.mock("@/domain/telemetry/funnels", () => ({
  getTelemetryFunnelDefinitionById,
  parseTelemetryFunnelPatchInput,
  updateTelemetryFunnelDefinition,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError,
}));

let PATCH: typeof import("@/app/api/org/[orgId]/telemetry/funnels/[id]/route").PATCH;

beforeEach(async () => {
  vi.resetModules();
  requireOrgTelemetryAccess.mockReset();
  getTelemetryFunnelDefinitionById.mockReset();
  parseTelemetryFunnelPatchInput.mockReset();
  updateTelemetryFunnelDefinition.mockReset();
  logError.mockReset();

  PATCH = (await import("@/app/api/org/[orgId]/telemetry/funnels/[id]/route")).PATCH;
});

describe("org telemetry funnels patch route", () => {
  it("bloqueia edição de funil global por organização", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });

    getTelemetryFunnelDefinitionById.mockResolvedValue({
      id: "funnel-global",
      organizationId: null,
      name: "Global",
      steps: [],
      isActive: true,
    });

    const req = new NextRequest("http://localhost/api/org/77/telemetry/funnels/funnel-global", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "funnel-global" }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NOT_FOUND");
    expect(parseTelemetryFunnelPatchInput).not.toHaveBeenCalled();
    expect(updateTelemetryFunnelDefinition).not.toHaveBeenCalled();
  });

  it("permite editar funil da própria organização", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: true,
      organizationId: 77,
      userId: "user-1",
    });

    getTelemetryFunnelDefinitionById.mockResolvedValue({
      id: "funnel-77",
      organizationId: 77,
      name: "Org Funnel",
      steps: [],
      isActive: true,
    });

    parseTelemetryFunnelPatchInput.mockReturnValue({
      ok: true,
      value: { isActive: false },
    });

    updateTelemetryFunnelDefinition.mockResolvedValue({
      id: "funnel-77",
      organizationId: 77,
      name: "Org Funnel",
      description: null,
      steps: [],
      isActive: false,
      createdByUserId: "user-1",
      createdAt: new Date("2026-02-27T10:00:00.000Z"),
      updatedAt: new Date("2026-02-27T11:00:00.000Z"),
    });

    const req = new NextRequest("http://localhost/api/org/77/telemetry/funnels/funnel-77", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "funnel-77" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.item?.id).toBe("funnel-77");
    expect(parseTelemetryFunnelPatchInput).toHaveBeenCalledTimes(1);
    expect(updateTelemetryFunnelDefinition).toHaveBeenCalledWith("funnel-77", {
      isActive: false,
    });
  });

  it("propaga resposta de acesso quando sem permissão", async () => {
    requireOrgTelemetryAccess.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ ok: false, error: "NO_ACCESS" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });

    const req = new NextRequest("http://localhost/api/org/77/telemetry/funnels/funnel-77", {
      method: "PATCH",
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "funnel-77" }) });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("NO_ACCESS");
  });
});
