import { z } from "zod";

export const PublicEventLocationSchema = z.object({
  name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  formattedAddress: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  components: z.record(z.string(), z.unknown()).nullable().optional(),
  overrides: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const PublicEventTicketTypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  price: z.number(),
  currency: z.string().nullable().optional(),
  status: z.enum(["ON_SALE", "UPCOMING", "CLOSED", "SOLD_OUT"]).optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  totalQuantity: z.number().nullable().optional(),
  soldQuantity: z.number().nullable().optional(),
  sortOrder: z.number().nullable().optional(),
});

export const PublicEventCardSchema = z.object({
  id: z.number(),
  type: z.literal("EVENT"),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  coverImageUrl: z.string().nullable().optional(),
  isGratis: z.boolean().optional(),
  priceFrom: z.number().nullable().optional(),
  categories: z.array(z.string()).optional(),
  hostName: z.string().nullable().optional(),
  hostUsername: z.string().nullable().optional(),
  status: z.enum(["ACTIVE", "CANCELLED", "PAST", "DRAFT"]).optional(),
  isHighlighted: z.boolean().optional(),
  location: PublicEventLocationSchema.optional(),
  ticketTypes: z.array(PublicEventTicketTypeSchema).optional(),
});

export type PublicEventCard = z.infer<typeof PublicEventCardSchema>;

export const DiscoverPaginationSchema = z.object({
  nextCursor: z.string().nullable().optional(),
  hasMore: z.boolean().optional(),
});

export const DiscoverResponseSchema = z.object({
  items: z.array(PublicEventCardSchema).default([]),
  pagination: DiscoverPaginationSchema.optional(),
});

export type DiscoverResponse = z.infer<typeof DiscoverResponseSchema>;

export const DiscoverDetailResponseSchema = z.object({
  item: PublicEventCardSchema,
});

export type DiscoverDetailResponse = z.infer<typeof DiscoverDetailResponseSchema>;
