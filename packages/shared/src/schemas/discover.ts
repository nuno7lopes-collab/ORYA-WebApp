import { z } from "zod";

export const PublicEventLocationSchema = z.object({
  city: z.string().nullable().optional(),
  addressId: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  formattedAddress: z.string().nullable().optional(),
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
  padelEventCategoryLinkId: z.number().nullable().optional(),
  padelCategoryLabel: z.string().nullable().optional(),
});

const PublicEventAccessPolicySchema = z.object({
  mode: z.enum(["PUBLIC", "UNLISTED", "INVITE_ONLY"]).optional(),
  guestCheckoutAllowed: z.boolean().optional(),
  inviteTokenAllowed: z.boolean().optional(),
  inviteIdentityMatch: z.enum(["EMAIL", "USERNAME", "BOTH"]).optional(),
  inviteTokenTtlSeconds: z.number().nullable().optional(),
  requiresEntitlementForEntry: z.boolean().optional(),
  checkinMethods: z.array(z.string()).optional(),
  policyVersion: z.number().optional(),
});

const PublicPadelCategorySchema = z.object({
  id: z.number(),
  linkId: z.number(),
  label: z.string().nullable().optional(),
  pricePerPlayerCents: z.number().optional(),
  currency: z.string().optional(),
  capacityTeams: z.number().nullable().optional(),
  capacityPlayers: z.number().nullable().optional(),
  format: z.string().nullable().optional(),
  isEnabled: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

const PublicPadelSnapshotSchema = z.object({
  eventId: z.number(),
  title: z.string(),
  status: z.string(),
  competitionState: z.string(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  clubName: z.string().nullable().optional(),
  clubCity: z.string().nullable().optional(),
  partnerClubs: z
    .array(
      z.object({
        id: z.number(),
        name: z.string().nullable().optional(),
        city: z.string().nullable().optional(),
      }),
    )
    .optional(),
  courts: z
    .array(
      z.object({
        name: z.string(),
        clubName: z.string().nullable().optional(),
        indoor: z.boolean().nullable().optional(),
      }),
    )
    .optional(),
  timeline: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        state: z.enum(["done", "active", "pending"]),
        cancelled: z.boolean().optional(),
        date: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

const PublicPadelMetaSchema = z.object({
  v2Enabled: z.boolean().optional(),
  competitionState: z.string().nullable().optional(),
  registrationStartsAt: z.string().nullable().optional(),
  registrationEndsAt: z.string().nullable().optional(),
  registrationStatus: z.string().nullable().optional(),
  registrationMessage: z.string().nullable().optional(),
  defaultCategoryId: z.number().nullable().optional(),
  categories: z.array(PublicPadelCategorySchema).optional(),
  snapshot: PublicPadelSnapshotSchema.nullable().optional(),
});

const PublicTournamentMetaSchema = z.object({
  id: z.number(),
  format: z.string().nullable().optional(),
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
  templateType: z.string().nullable().optional(),
  accessPolicy: PublicEventAccessPolicySchema.optional(),
  tournament: PublicTournamentMetaSchema.nullable().optional(),
  padel: PublicPadelMetaSchema.nullable().optional(),
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
