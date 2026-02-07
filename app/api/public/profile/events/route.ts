export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getUserFollowStatus } from "@/domain/social/follows";
import { toPublicEventCard } from "@/domain/events/publicEventCard";

const normalizeUsername = (raw: string) => raw.trim().replace(/^@/, "");
const MAX_LIMIT = 12;

function parseLimit(raw: string | null) {
  if (!raw) return 6;
  const value = Number(raw);
  if (!Number.isFinite(value)) return 6;
  return Math.min(Math.max(value, 1), MAX_LIMIT);
}

const EVENT_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  startsAt: true,
  endsAt: true,
  status: true,
  templateType: true,
  ownerUserId: true,
  addressId: true,
  addressRef: {
    select: {
      formattedAddress: true,
      canonical: true,
      latitude: true,
      longitude: true,
    },
  },
  organization: {
    select: {
      publicName: true,
    },
  },
  coverImageUrl: true,
  pricingMode: true,
  ticketTypes: {
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      currency: true,
      status: true,
      startsAt: true,
      endsAt: true,
      totalQuantity: true,
      soldQuantity: true,
      sortOrder: true,
    },
  },
} as const;

async function _GET(req: NextRequest) {
  const usernameRaw = req.nextUrl.searchParams.get("username");
  if (!usernameRaw) {
    return jsonWrap({ error: "INVALID_USERNAME" }, { status: 400 });
  }
  const username = normalizeUsername(usernameRaw);
  if (!username) {
    return jsonWrap({ error: "INVALID_USERNAME" }, { status: 400 });
  }

  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const profile = await prisma.profile.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      fullName: true,
      visibility: true,
      isDeleted: true,
    },
  });

  if (profile && !profile.isDeleted) {
    if (profile.visibility !== "PUBLIC") {
      if (!viewerId) {
        return jsonWrap({ error: "UNAUTHENTICATED" }, { status: 401 });
      }
      if (viewerId !== profile.id) {
        const status = await getUserFollowStatus(viewerId, profile.id);
        if (!status?.isFollowing) {
          return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
        }
      }
    }

    const now = new Date();
    const ownerProfile = {
      fullName: profile.fullName ?? null,
      username: profile.username ?? null,
    };
    const baseWhere = {
      ownerUserId: profile.id,
      isDeleted: false,
      status: { in: ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"] as const },
    };

    const [upcoming, past] = await Promise.all([
      prisma.event.findMany({
        where: {
          ...baseWhere,
          endsAt: { gte: now },
        },
        orderBy: { startsAt: "asc" },
        take: limit,
        select: EVENT_SELECT,
      }),
      prisma.event.findMany({
        where: {
          ...baseWhere,
          endsAt: { lt: now },
        },
        orderBy: { startsAt: "desc" },
        take: limit,
        select: EVENT_SELECT,
      }),
    ]);

    return jsonWrap({
      type: "user",
      upcoming: upcoming.map((event) => toPublicEventCard({ event, ownerProfile })),
      past: past.map((event) => toPublicEventCard({ event, ownerProfile })),
    });
  }

  const organization = await prisma.organization.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      publicName: true,
      businessName: true,
      status: true,
    },
  });

  if (!organization) {
    return jsonWrap({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (organization.status && organization.status !== "ACTIVE") {
    return jsonWrap({ type: "organization", upcoming: [], past: [] }, { status: 200 });
  }

  const now = new Date();
  const baseWhere = {
    organizationId: organization.id,
    isDeleted: false,
    status: { in: ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"] as const },
  };

  const [upcoming, past] = await Promise.all([
    prisma.event.findMany({
      where: {
        ...baseWhere,
        endsAt: { gte: now },
      },
      orderBy: { startsAt: "asc" },
      take: limit,
      select: EVENT_SELECT,
    }),
    prisma.event.findMany({
      where: {
        ...baseWhere,
        endsAt: { lt: now },
      },
      orderBy: { startsAt: "desc" },
      take: limit,
      select: EVENT_SELECT,
    }),
  ]);

  const ownerProfile = {
    fullName: organization.publicName ?? organization.businessName ?? null,
    username: organization.username ?? null,
  };

  return jsonWrap({
    type: "organization",
    upcoming: upcoming.map((event) => toPublicEventCard({ event, ownerProfile })),
    past: past.map((event) => toPublicEventCard({ event, ownerProfile })),
  });
}

export const GET = withApiEnvelope(_GET);
