import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchIndexVisibility, SourceType } from "@prisma/client";
import { consumeSearchIndexEvent } from "@/domain/searchIndex/consumer";

const mocks = vi.hoisted(() => ({
  eventLogFindUnique: vi.fn(),
  searchIndexFindUnique: vi.fn(),
  searchIndexUpsert: vi.fn(),
  searchIndexUpdateMany: vi.fn(),
  eventFindUnique: vi.fn(),
  profileFindUnique: vi.fn(),
  organizationFindUnique: vi.fn(),
  eventFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    eventLog: { findUnique: mocks.eventLogFindUnique },
    searchIndexItem: {
      findUnique: mocks.searchIndexFindUnique,
      upsert: mocks.searchIndexUpsert,
      updateMany: mocks.searchIndexUpdateMany,
    },
    event: { findUnique: mocks.eventFindUnique, findMany: mocks.eventFindMany },
    profile: { findUnique: mocks.profileFindUnique },
    organization: { findUnique: mocks.organizationFindUnique },
  },
}));

beforeEach(() => {
  Object.values(mocks).forEach((fn) => fn.mockReset());
});

describe("searchIndex consumer", () => {
  it("materializa evento PUBLIC", async () => {
    const createdAt = new Date("2025-01-01T10:00:00Z");
    mocks.eventLogFindUnique.mockResolvedValue({
      id: "evt-1",
      organizationId: 1,
      eventType: "event.updated",
      payload: { eventId: 10, sourceType: SourceType.EVENT, sourceId: "10" },
      createdAt,
    });
    mocks.searchIndexFindUnique.mockResolvedValue(null);
    mocks.eventFindUnique.mockResolvedValue({
      id: 10,
      slug: "evento-10",
      title: "Evento",
      description: "Desc",
      startsAt: createdAt,
      endsAt: createdAt,
      status: "PUBLISHED",
      templateType: null,
      pricingMode: "STANDARD",
      isDeleted: false,
      coverImageUrl: null,
      locationName: "Local",
      locationCity: "Lisboa",
      address: null,
      locationFormattedAddress: null,
      latitude: null,
      longitude: null,
      locationSource: null,
      ownerUserId: null,
      organizationId: 1,
      organization: { status: "ACTIVE", publicName: "Org" },
      ticketTypes: [{ price: 0 }],
    });
    mocks.profileFindUnique.mockResolvedValue(null);

    const res = await consumeSearchIndexEvent("evt-1");
    expect(res.ok).toBe(true);
    expect(mocks.searchIndexUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          organizationId: 1,
          sourceType: SourceType.EVENT,
          sourceId: "10",
          visibility: SearchIndexVisibility.PUBLIC,
          isGratis: true,
          priceFromCents: 0,
          lastEventId: "evt-1",
        }),
      }),
    );
  });

  it("dedupe por lastEventId", async () => {
    const createdAt = new Date("2025-02-01T10:00:00Z");
    mocks.eventLogFindUnique.mockResolvedValue({
      id: "evt-2",
      organizationId: 1,
      eventType: "event.updated",
      payload: { eventId: 11, sourceType: SourceType.EVENT, sourceId: "11" },
      createdAt,
    });
    mocks.searchIndexFindUnique.mockResolvedValue({ lastEventId: "evt-2", updatedAt: createdAt });
    mocks.eventFindUnique.mockResolvedValue({
      id: 11,
      slug: "evento-11",
      title: "Evento",
      description: "Desc",
      startsAt: createdAt,
      endsAt: createdAt,
      status: "PUBLISHED",
      templateType: null,
      pricingMode: "STANDARD",
      isDeleted: false,
      coverImageUrl: null,
      locationName: "Local",
      locationCity: "Lisboa",
      address: null,
      locationFormattedAddress: null,
      latitude: null,
      longitude: null,
      locationSource: null,
      ownerUserId: null,
      organizationId: 1,
      organization: { status: "ACTIVE", publicName: "Org" },
      ticketTypes: [{ price: 1000 }],
    });

    const res = await consumeSearchIndexEvent("evt-2");
    expect(res.ok).toBe(true);
    expect(mocks.searchIndexUpsert).not.toHaveBeenCalled();
  });

  it("org status inativo oculta", async () => {
    const createdAt = new Date("2025-03-01T10:00:00Z");
    mocks.eventLogFindUnique.mockResolvedValue({
      id: "evt-3",
      organizationId: 2,
      eventType: "organization.status.updated",
      payload: { organizationId: 2, toStatus: "SUSPENDED" },
      createdAt,
    });
    mocks.organizationFindUnique.mockResolvedValue({ id: 2, status: "SUSPENDED" });

    const res = await consumeSearchIndexEvent("evt-3");
    expect(res.ok).toBe(true);
    expect(mocks.searchIndexUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 2 },
        data: expect.objectContaining({ visibility: SearchIndexVisibility.HIDDEN }),
      }),
    );
  });

  it("oculta quando evento não existe", async () => {
    const createdAt = new Date("2025-04-01T10:00:00Z");
    mocks.eventLogFindUnique.mockResolvedValue({
      id: "evt-4",
      organizationId: 3,
      eventType: "event.cancelled",
      payload: { eventId: 20, sourceType: SourceType.EVENT, sourceId: "20" },
      createdAt,
    });
    mocks.eventFindUnique.mockResolvedValue(null);

    const res = await consumeSearchIndexEvent("evt-4");
    expect(res.ok).toBe(true);
    expect(mocks.searchIndexUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 3,
          sourceType: SourceType.EVENT,
          sourceId: "20",
        },
        data: expect.objectContaining({
          visibility: SearchIndexVisibility.HIDDEN,
          lastEventId: "evt-4",
        }),
      }),
    );
  });

  it("recalcula priceFrom/isGratis com ticketTypes", async () => {
    const createdAt = new Date("2025-05-01T10:00:00Z");
    mocks.eventLogFindUnique.mockResolvedValue({
      id: "evt-5",
      organizationId: 4,
      eventType: "event.updated",
      payload: { eventId: 30, sourceType: SourceType.EVENT, sourceId: "30" },
      createdAt,
    });
    mocks.searchIndexFindUnique.mockResolvedValue({ lastEventId: "old", updatedAt: new Date("2025-04-01T10:00:00Z") });
    mocks.eventFindUnique.mockResolvedValue({
      id: 30,
      slug: "evento-30",
      title: "Evento",
      description: "Desc",
      startsAt: createdAt,
      endsAt: createdAt,
      status: "PUBLISHED",
      templateType: null,
      pricingMode: "STANDARD",
      isDeleted: false,
      coverImageUrl: null,
      locationName: "Local",
      locationCity: "Lisboa",
      address: null,
      locationFormattedAddress: null,
      latitude: null,
      longitude: null,
      locationSource: null,
      ownerUserId: null,
      organizationId: 4,
      organization: { status: "ACTIVE", publicName: "Org" },
      ticketTypes: [{ price: 1500 }, { price: 2500 }],
    });
    mocks.profileFindUnique.mockResolvedValue(null);

    const res = await consumeSearchIndexEvent("evt-5");
    expect(res.ok).toBe(true);
    expect(mocks.searchIndexUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isGratis: false,
          priceFromCents: 1500,
        }),
      }),
    );
  });
});
