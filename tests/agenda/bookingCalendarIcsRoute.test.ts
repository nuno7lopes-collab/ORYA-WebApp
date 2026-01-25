import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/me/reservas/[id]/calendar.ics/route";
import { prisma } from "@/lib/prisma";

const ensureAuthenticatedMock = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({})),
}));

vi.mock("@/lib/security", () => ({
  ensureAuthenticated: (...args: any[]) => ensureAuthenticatedMock(...args),
  isUnauthenticatedError: (err: any) => err?.message === "UNAUTHENTICATED",
}));

vi.mock("@/lib/appBaseUrl", () => ({
  getAppBaseUrl: () => "https://orya.test",
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findFirst: vi.fn(),
    },
  },
}));

const prismaMock = vi.mocked(prisma);

describe("booking calendar ICS route", () => {
  beforeEach(() => {
    ensureAuthenticatedMock.mockReset();
    prismaMock.booking.findFirst.mockReset();
  });

  it("bloqueia quando não autenticado", async () => {
    ensureAuthenticatedMock.mockRejectedValue(new Error("UNAUTHENTICATED"));

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "456" }),
    });

    expect(res.status).toBe(401);
  });

  it("devolve ICS para o owner", async () => {
    ensureAuthenticatedMock.mockResolvedValue({ id: "user-1" });
    prismaMock.booking.findFirst.mockResolvedValue({
      id: 456,
      startsAt: new Date("2025-01-02T10:00:00Z"),
      durationMinutes: 60,
      locationText: "Court 1",
      service: { title: "Reserva Padel", defaultLocationText: null },
      organization: { publicName: "Clube ORYA", businessName: null },
    } as any);

    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "456" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("UID:orya:reserva:456@orya");
    expect(text).toContain("SUMMARY:Reserva — Reserva Padel");
  });
});
