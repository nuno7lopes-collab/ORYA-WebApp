export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { EventStatus } from "@prisma/client";
import { getUserFollowStatus } from "@/domain/social/follows";
import { toPublicEventCard, isPublicEventCardComplete } from "@/domain/events/publicEventCard";
import { PUBLIC_EVENT_STATUSES } from "@/domain/events/publicStatus";
import { normalizeUsernameInput } from "@/lib/username";
import { resolveUsernameOwner } from "@/lib/username/resolveUsernameOwner";

const normalizeVisibility = (value: unknown) =>
  value === "PUBLIC" || value === "PRIVATE" || value === "FOLLOWERS" ? value : "PUBLIC";
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

type SupabaseProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  visibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS" | null;
};

const SUPABASE_PROFILE_SELECT = "id, username, full_name, visibility";

async function fetchSupabaseProfileById(
  supabase: ReturnType<typeof createSupabaseServer> extends Promise<infer T> ? T : never,
  userId: string,
): Promise<SupabaseProfileRow | null> {
  const result = await supabase
    .from("profiles")
    .select(SUPABASE_PROFILE_SELECT)
    .eq("id", userId)
    .single();
  if (result.error || !result.data) return null;
  return result.data as SupabaseProfileRow;
}

async function _GET(req: NextRequest) {
  const usernameRaw = req.nextUrl.searchParams.get("username");
  if (!usernameRaw) {
    return jsonWrap({ error: "INVALID_USERNAME" }, { status: 400 });
  }
  const username = normalizeUsernameInput(usernameRaw);
  if (!username) {
    return jsonWrap({ error: "INVALID_USERNAME" }, { status: 400 });
  }

  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerId = user?.id ?? null;

  const resolved = await resolveUsernameOwner(username, {
    includeDeletedUser: false,
    requireActiveOrganization: true,
    backfillGlobalUsername: true,
  });

  if (resolved?.ownerType === "user") {
    const profile = await prisma.profile.findUnique({
      where: { id: resolved.ownerId },
      select: {
        id: true,
        username: true,
        fullName: true,
        visibility: true,
        isDeleted: true,
      },
    });
    if (!profile || profile.isDeleted) {
      return jsonWrap({ error: "NOT_FOUND" }, { status: 404 });
    }
    const isPrivate = profile.visibility !== "PUBLIC";
    const isSelf = viewerId === profile.id;
    const viewerStatus = viewerId ? await getUserFollowStatus(viewerId, profile.id) : null;
    const canView = !isPrivate || isSelf || Boolean(viewerStatus?.isFollowing);
    if (!canView) {
      return jsonWrap({
        type: "user",
        upcoming: [],
        past: [],
        locked: true,
        privacy: { isPrivate, canView },
      });
    }

    const now = new Date();
    const ownerProfile = {
      fullName: profile.fullName ?? null,
      username: profile.username ?? null,
    };
    const publicStatuses: EventStatus[] = PUBLIC_EVENT_STATUSES;
    const baseWhere = {
      ownerUserId: profile.id,
      isDeleted: false,
      status: { in: publicStatuses },
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
      upcoming: upcoming
        .map((event) => toPublicEventCard({ event, ownerProfile }))
        .filter((event) => isPublicEventCardComplete(event)),
      past: past
        .map((event) => toPublicEventCard({ event, ownerProfile }))
        .filter((event) => isPublicEventCardComplete(event)),
      locked: false,
      privacy: { isPrivate, canView },
    });
  }

  if (!resolved && viewerId) {
    const deletedProfile = await prisma.profile.findFirst({
      where: { username: { equals: username, mode: "insensitive" }, isDeleted: true },
      select: { id: true },
    });
    if (deletedProfile) {
      return jsonWrap({ error: "NOT_FOUND" }, { status: 404 });
    }
    const supabaseSelfProfile = await fetchSupabaseProfileById(supabase, viewerId);
    const matchesUsername =
      supabaseSelfProfile?.username &&
      supabaseSelfProfile.username.toLowerCase() === username.toLowerCase();
    if (matchesUsername) {
      const visibility = normalizeVisibility(supabaseSelfProfile.visibility);
      const isPrivate = visibility !== "PUBLIC";
      const isSelf = viewerId === supabaseSelfProfile.id;
      const viewerStatus = viewerId ? await getUserFollowStatus(viewerId, supabaseSelfProfile.id) : null;
      const canView = !isPrivate || isSelf || Boolean(viewerStatus?.isFollowing);
      if (!canView) {
        return jsonWrap({
          type: "user",
          upcoming: [],
          past: [],
          locked: true,
          privacy: { isPrivate, canView },
        });
      }

      const now = new Date();
      const ownerProfile = {
        fullName: supabaseSelfProfile.full_name ?? null,
        username: supabaseSelfProfile.username ?? null,
      };
      const publicStatuses: EventStatus[] = PUBLIC_EVENT_STATUSES;
      const baseWhere = {
        ownerUserId: supabaseSelfProfile.id,
        isDeleted: false,
        status: { in: publicStatuses },
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
        upcoming: upcoming
          .map((event) => toPublicEventCard({ event, ownerProfile }))
          .filter((event) => isPublicEventCardComplete(event)),
        past: past
          .map((event) => toPublicEventCard({ event, ownerProfile }))
          .filter((event) => isPublicEventCardComplete(event)),
        locked: false,
        privacy: { isPrivate, canView },
      });
    }
  }

  if (resolved?.ownerType !== "organization") {
    return jsonWrap({ error: "NOT_FOUND" }, { status: 404 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: resolved.ownerId },
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
    return jsonWrap({ type: "organization", upcoming: [], past: [], locked: false, privacy: { isPrivate: false, canView: true } }, { status: 200 });
  }

  const now = new Date();
  const publicStatuses: EventStatus[] = PUBLIC_EVENT_STATUSES;
  const baseWhere = {
    organizationId: organization.id,
    isDeleted: false,
    status: { in: publicStatuses },
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
    upcoming: upcoming
      .map((event) => toPublicEventCard({ event, ownerProfile }))
      .filter((event) => isPublicEventCardComplete(event)),
    past: past
      .map((event) => toPublicEventCard({ event, ownerProfile }))
      .filter((event) => isPublicEventCardComplete(event)),
    locked: false,
    privacy: { isPrivate: false, canView: true },
  });
}

export const GET = withApiEnvelope(_GET);
