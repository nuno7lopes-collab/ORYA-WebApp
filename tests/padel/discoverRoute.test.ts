import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaEventFindMany = vi.hoisted(() => vi.fn());
const enforcePublicRateLimit = vi.hoisted(() => vi.fn(async () => null));
const resolvePadelCompetitionState = vi.hoisted(() => vi.fn(() => "PUBLIC"));
const deriveIsFreeEvent = vi.hoisted(() => vi.fn(() => true));
const parsePadelFormat = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findMany: prismaEventFindMany },
  },
}));

vi.mock("@/lib/padel/publicRateLimit", () => ({
  enforcePublicRateLimit: (...args: unknown[]) => enforcePublicRateLimit(...args),
}));

vi.mock("@/domain/padelCompetitionState", () => ({
  resolvePadelCompetitionState: (...args: unknown[]) => resolvePadelCompetitionState(...args),
}));

vi.mock("@/domain/events/derivedIsFree", () => ({
  deriveIsFreeEvent: (...args: unknown[]) => deriveIsFreeEvent(...args),
}));

vi.mock("@/domain/padel/formatCatalog", () => ({
  parsePadelFormat: (...args: unknown[]) => parsePadelFormat(...args),
}));

describe("GET /api/padel/discover", () => {
  beforeEach(() => {
    prismaEventFindMany.mockReset();
    enforcePublicRateLimit.mockClear();
    resolvePadelCompetitionState.mockClear();
    deriveIsFreeEvent.mockClear();
    parsePadelFormat.mockClear();
    prismaEventFindMany.mockResolvedValue([]);
  });

  it("aplica filtro city no where", async () => {
    const { GET } = await import("@/app/api/padel/discover/route");
    const req = new NextRequest("http://localhost/api/padel/discover?city=Porto");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result?.ok ?? body.ok).toBe(true);
    const args = prismaEventFindMany.mock.calls[0]?.[0];
    expect(args?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          addressRef: expect.objectContaining({
            formattedAddress: expect.objectContaining({
              contains: "Porto",
            }),
          }),
        }),
      ]),
    );
  });
});
