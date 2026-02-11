import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getUserFollowingSet } from "@/domain/social/follows";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";

export const runtime = "nodejs";

const clampLimit = (value: number) => Math.min(Math.max(value, 1), 12);
const MAX_REASON_EVENTS = 24;

async function _GET(req: NextRequest) {
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 8);
  const limit = clampLimit(Number.isFinite(limitRaw) ? limitRaw : 8);

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const followingSet = await getUserFollowingSet(user.id);
  const followingIds = Array.from(followingSet).filter(Boolean);
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const activeEventStatuses = PUBLIC_EVENT_DISCOVER_STATUSES;

  const publicWhere = {
    isDeleted: false,
    visibility: "PUBLIC" as const,
    username: { not: null },
    NOT: { username: "" },
  };

  const [ticketEvents, favoriteEvents] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        event: {
          status: { in: activeEventStatuses },
          isDeleted: false,
          startsAt: { gte: now, lte: windowEnd },
        },
      },
      select: {
        eventId: true,
        event: { select: { id: true, title: true, slug: true, startsAt: true } },
      },
      distinct: ["eventId"],
      orderBy: { event: { startsAt: "asc" } },
      take: MAX_REASON_EVENTS,
    }),
    prisma.eventFavorite.findMany({
      where: {
        userId: user.id,
        event: {
          status: { in: activeEventStatuses },
          isDeleted: false,
          startsAt: { gte: now, lte: windowEnd },
        },
      },
      select: {
        eventId: true,
        event: { select: { id: true, title: true, slug: true, startsAt: true } },
      },
      orderBy: { event: { startsAt: "asc" } },
      take: MAX_REASON_EVENTS,
    }),
  ]);

  const eventMeta = new Map<number, { id: number; title: string; slug: string; startsAt: Date }>();
  ticketEvents.forEach((row) => {
    if (row.event) eventMeta.set(row.event.id, row.event);
  });
  favoriteEvents.forEach((row) => {
    if (row.event) eventMeta.set(row.event.id, row.event);
  });

  const reasonMap = new Map<
    string,
    { type: "SAME_EVENT_TICKET" | "SAME_EVENT_FAVORITE"; event: { id: number; title: string; slug: string; startsAt: Date } }
  >();

  const ticketEventIds = ticketEvents.map((row) => row.eventId).slice(0, MAX_REASON_EVENTS);
  const favoriteEventIds = favoriteEvents.map((row) => row.eventId).slice(0, MAX_REASON_EVENTS);

  const [ticketRows, favoriteRows] = await Promise.all([
    ticketEventIds.length > 0
      ? prisma.ticket.findMany({
          where: {
            eventId: { in: ticketEventIds },
            status: "ACTIVE",
            userId: { not: null },
          },
          select: { userId: true, eventId: true },
          distinct: ["userId", "eventId"],
        })
      : Promise.resolve([]),
    favoriteEventIds.length > 0
      ? prisma.eventFavorite.findMany({
          where: {
            eventId: { in: favoriteEventIds },
            userId: { not: user.id },
          },
          select: { userId: true, eventId: true },
        })
      : Promise.resolve([]),
  ]);

  ticketRows.forEach((row) => {
    const otherId = row.userId;
    if (!otherId || otherId === user.id) return;
    if (followingSet.has(otherId)) return;
    if (reasonMap.has(otherId)) return;
    const event = eventMeta.get(row.eventId);
    if (!event) return;
    reasonMap.set(otherId, { type: "SAME_EVENT_TICKET", event });
  });

  favoriteRows.forEach((row) => {
    const otherId = row.userId;
    if (!otherId || otherId === user.id) return;
    if (followingSet.has(otherId)) return;
    if (reasonMap.has(otherId)) return;
    const event = eventMeta.get(row.eventId);
    if (!event) return;
    reasonMap.set(otherId, { type: "SAME_EVENT_FAVORITE", event });
  });

  const reasonUserIds = Array.from(reasonMap.keys());
  const reasonProfiles = reasonUserIds.length
    ? await prisma.profile.findMany({
        where: {
          ...publicWhere,
          id: {
            in: reasonUserIds,
            notIn: followingIds.length > 0 ? followingIds : undefined,
            not: user.id,
          },
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
          updatedAt: true,
        },
      })
    : [];

  const reasonItems = reasonProfiles
    .map((profile) => ({
      profile,
      reason: reasonMap.get(profile.id) ?? null,
    }))
    .filter((item) => Boolean(item.reason))
    .sort((a, b) => {
      const aRank = a.reason?.type === "SAME_EVENT_TICKET" ? 0 : 1;
      const bRank = b.reason?.type === "SAME_EVENT_TICKET" ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return b.profile.updatedAt.getTime() - a.profile.updatedAt.getTime();
    });

  const reasonSuggestions = reasonItems.map((item) => ({
    id: item.profile.id,
    username: item.profile.username,
    fullName: item.profile.fullName,
    avatarUrl: item.profile.avatarUrl,
    mutualsCount: 0,
    isFollowing: false,
    reason: item.reason
      ? {
          type: item.reason.type,
          event: {
            id: item.reason.event.id,
            title: item.reason.event.title,
            slug: item.reason.event.slug,
            startsAt: item.reason.event.startsAt.toISOString(),
          },
        }
      : null,
  }));

  const reasonIds = reasonSuggestions.map((item) => item.id);
  const excludedIds = [user.id, ...followingIds, ...reasonIds].filter(Boolean);

  const baseWhere = {
    ...publicWhere,
    id: { notIn: excludedIds.length > 0 ? excludedIds : undefined },
  };

  const remaining = Math.max(0, limit - reasonSuggestions.length);
  const primary = remaining
    ? await prisma.profile.findMany({
        where: {
          ...baseWhere,
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          avatarUrl: true,
        },
        orderBy: { updatedAt: "desc" },
        take: remaining,
      })
    : [];

  const combined = [
    ...reasonSuggestions,
    ...primary.map((item) => ({
      id: item.id,
      username: item.username,
      fullName: item.fullName,
      avatarUrl: item.avatarUrl,
      mutualsCount: 0,
      isFollowing: false,
      reason: null,
    })),
  ].slice(0, limit);
  const suggestedIds = combined.map((item) => item.id);

  const mutualsMap = new Map<string, number>();
  if (suggestedIds.length > 0 && followingIds.length > 0) {
    const mutualRows = await prisma.follows.groupBy({
      by: ["follower_id"],
      where: {
        follower_id: { in: suggestedIds },
        following_id: { in: followingIds },
      },
      _count: { _all: true },
    });

    mutualRows.forEach((row) => {
      mutualsMap.set(row.follower_id, row._count._all);
    });
  }

  const items = combined.map((item) => ({
    ...item,
    mutualsCount: mutualsMap.get(item.id) ?? item.mutualsCount ?? 0,
  }));

  return jsonWrap({ ok: true, items }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
