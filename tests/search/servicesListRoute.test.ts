import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaServiceFindMany = vi.hoisted(() => vi.fn());
const prismaWeeklyTemplateFindMany = vi.hoisted(() => vi.fn());
const prismaAvailabilityOverrideFindMany = vi.hoisted(() => vi.fn());
const prismaBookingFindMany = vi.hoisted(() => vi.fn());
const prismaReservationProfessionalFindMany = vi.hoisted(() => vi.fn());
const prismaReservationResourceFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    service: { findMany: prismaServiceFindMany },
    weeklyAvailabilityTemplate: { findMany: prismaWeeklyTemplateFindMany },
    availabilityOverride: { findMany: prismaAvailabilityOverrideFindMany },
    booking: { findMany: prismaBookingFindMany },
    reservationProfessional: { findMany: prismaReservationProfessionalFindMany },
    reservationResource: { findMany: prismaReservationResourceFindMany },
  },
}));

describe("GET /api/servicos/list", () => {
  beforeEach(() => {
    prismaServiceFindMany.mockReset();
    prismaWeeklyTemplateFindMany.mockReset();
    prismaAvailabilityOverrideFindMany.mockReset();
    prismaBookingFindMany.mockReset();
    prismaReservationProfessionalFindMany.mockReset();
    prismaReservationResourceFindMany.mockReset();

    prismaServiceFindMany.mockResolvedValue([]);
    prismaWeeklyTemplateFindMany.mockResolvedValue([]);
    prismaAvailabilityOverrideFindMany.mockResolvedValue([]);
    prismaBookingFindMany.mockResolvedValue([]);
    prismaReservationProfessionalFindMany.mockResolvedValue([]);
    prismaReservationResourceFindMany.mockResolvedValue([]);
  });

  it("aplica city no where do findMany", async () => {
    const { GET } = await import("@/app/api/servicos/list/route");
    const req = new NextRequest("http://localhost/api/servicos/list?city=Porto");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result?.ok ?? body.ok).toBe(true);

    const args = prismaServiceFindMany.mock.calls[0]?.[0];
    expect(args?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              addressRef: expect.objectContaining({
                formattedAddress: expect.objectContaining({ contains: "Porto" }),
              }),
            }),
          ]),
        }),
      ]),
    );
  });
});

