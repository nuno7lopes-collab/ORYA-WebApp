import { describe, expect, it } from "vitest";
import { toPublicEventCardWithPrice } from "@/domain/events/publicEventCard";

const baseEvent = {
  id: 1,
  slug: "seed-event-01",
  title: "Evento teste",
  description: "Descricao",
  startsAt: "2026-03-01T10:00:00.000Z",
  endsAt: "2026-03-01T12:00:00.000Z",
  status: "PUBLISHED",
  templateType: "OTHER",
  ownerUserId: "owner_1",
  addressId: "addr_1",
  addressRef: {
    formattedAddress: "Rua de teste 1, Porto",
    canonical: null,
    latitude: 41.15,
    longitude: -8.61,
  },
  coverImageUrl: null,
  pricingMode: "STANDARD",
  organization: {
    publicName: "Top Padel",
    businessName: "Top Padel Lda",
    username: "toppadel",
    brandingAvatarUrl: null,
  },
  ticketTypes: [
    {
      id: 10,
      name: "Geral",
      description: null,
      price: 1200,
      currency: "EUR",
      status: "ON_SALE",
      startsAt: "2026-02-01T10:00:00.000Z",
      endsAt: "2026-03-01T12:00:00.000Z",
      totalQuantity: 100,
      soldQuantity: 20,
      sortOrder: 0,
    },
  ],
};

describe("publicEventCard organizer avatar", () => {
  it("prioritizes organization branding avatar", () => {
    const card = toPublicEventCardWithPrice({
      event: {
        ...baseEvent,
        organization: {
          ...baseEvent.organization,
          brandingAvatarUrl: "https://cdn.orya.dev/org-avatar.png",
        },
      },
      ownerProfile: {
        fullName: "Owner Name",
        username: "owner",
        avatarUrl: "https://cdn.orya.dev/owner-avatar.png",
      },
    });

    expect(card.hostAvatarUrl).toBe("https://cdn.orya.dev/org-avatar.png");
  });

  it("falls back to owner avatar when organization avatar is missing", () => {
    const card = toPublicEventCardWithPrice({
      event: baseEvent,
      ownerProfile: {
        fullName: "Owner Name",
        username: "owner",
        avatarUrl: "https://cdn.orya.dev/owner-avatar.png",
      },
    });

    expect(card.hostAvatarUrl).toBe("https://cdn.orya.dev/owner-avatar.png");
  });

  it("returns null when both avatars are unavailable", () => {
    const card = toPublicEventCardWithPrice({
      event: baseEvent,
      ownerProfile: {
        fullName: "Owner Name",
        username: "owner",
        avatarUrl: null,
      },
    });

    expect(card.hostAvatarUrl).toBeNull();
  });
});
