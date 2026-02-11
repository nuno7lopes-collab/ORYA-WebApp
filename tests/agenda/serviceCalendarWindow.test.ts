import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  serviceFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: {
      findFirst: mocks.serviceFindFirst,
    },
  },
}));

vi.mock("@/lib/reservas/serviceAssignment", () => ({
  resolveServiceAssignmentMode: () => ({ mode: "PROFESSIONAL", isCourtService: true }),
  getResourceModeBlockedPayload: () => ({ ok: false, error: "RESOURCE_MODE_NOT_ALLOWED", message: "Mode not allowed." }),
}));

vi.mock("@/lib/reservas/serviceAddons", () => ({
  applyAddonTotals: (value: any) => value,
  normalizeAddonSelection: () => null,
  resolveServiceAddonSelection: async () => ({ ok: true, addons: [] }),
}));

vi.mock("@/lib/reservas/servicePackages", () => ({
  applyPackageBase: (value: any) => value,
  parsePackageId: () => null,
  resolveServicePackageSelection: async () => ({ ok: true, package: null }),
}));

vi.mock("@/lib/organizationPayments", () => ({
  getPaidSalesGate: () => ({ ok: true }),
  formatPaidSalesGateMessage: () => "",
}));

vi.mock("@/lib/http/requestContext", () => ({
  getRequestContext: () => ({ requestId: "req_test", correlationId: "corr_test" }),
  buildResponseHeaders: (_ctx: any, existing?: HeadersInit) => {
    const headers = new Headers(existing);
    headers.set("x-request-id", "req_test");
    headers.set("x-correlation-id", "corr_test");
    return headers;
  },
}));

import { GET as CalendarGet } from "@/app/api/servicos/[id]/calendario/route";
import { GET as SlotsGet } from "@/app/api/servicos/[id]/slots/route";

describe("service calendar window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T10:00:00Z"));
    mocks.serviceFindFirst.mockResolvedValue({
      id: 1,
      kind: "COURT",
      durationMinutes: 60,
      organizationId: 10,
      unitPriceCents: 0,
      professionalLinks: [],
      resourceLinks: [],
      organization: {
        timezone: "Europe/Lisbon",
        reservationAssignmentMode: null,
        orgType: "PLATFORM",
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        officialEmail: null,
        officialEmailVerifiedAt: null,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    mocks.serviceFindFirst.mockReset();
  });

  it("bloqueia meses fora da janela (mês atual + 3)", async () => {
    const res = await CalendarGet(
      new NextRequest("http://localhost/api/servicos/1/calendario?month=2026-06"),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errorCode).toBe("RANGE_NOT_ALLOWED");
    expect(json.requestId).toBe("req_test");
  });

  it("bloqueia dias fora da janela", async () => {
    const res = await SlotsGet(
      new NextRequest("http://localhost/api/servicos/1/slots?day=2026-06-01"),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.errorCode).toBe("RANGE_NOT_ALLOWED");
    expect(json.correlationId).toBe("corr_test");
  });
});
