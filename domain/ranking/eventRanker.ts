import { prisma } from "@/lib/prisma";
import { getOrganizationFollowingSet, getUserMutualSet } from "@/domain/social/follows";
import { fallbackInterestTags, normalizeInterestIds } from "@/lib/ranking/interests";
import type { PublicEventCard } from "@/domain/events/publicEventCard";

type RankReason = { code: string; label?: string; weight?: number };

export type RankContext = {
  userId?: string | null;
  favouriteCategories?: string[] | null;
  lat?: number | null;
  lng?: number | null;
  now?: Date;
};

export type RankResult = {
  score: number;
  reasons: RankReason[];
};

type RankedItem = {
  event: PublicEventCard;
  rank: RankResult;
  hidden: boolean;
};

const WEIGHTS = {
  preference: 0.25,
  behavior: 0.35,
  social: 0.2,
  context: 0.15,
  recency: 0.05,
};

const NEGATIVE_MULTIPLIER = 0.1;

const toRad = (value: number) => (value * Math.PI) / 180;
const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const earthRadius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
};

const normalizeTag = (value: string) => value.trim().toLowerCase();

const computePreferenceScore = (event: PublicEventCard, prefs: string[]) => {
  const reasons: RankReason[] = [];
  if (!prefs.length) return { score: 0, reasons };
  const tags = (event.interestTags ?? []).map(normalizeTag);
  const templateFallback = fallbackInterestTags(event.templateType ?? null).map(normalizeTag);
  const tagSet = new Set([...tags, ...templateFallback]);
  const matches = prefs.filter((pref) => tagSet.has(normalizeTag(pref)));
  if (!matches.length) return { score: 0, reasons };
  const score = Math.min(1, matches.length / Math.max(1, prefs.length));
  reasons.push({ code: "PREF_MATCH", label: matches.join(", "), weight: score });
  return { score, reasons };
};

const computeContextScore = (event: PublicEventCard, ctx: RankContext) => {
  const reasons: RankReason[] = [];
  const now = ctx.now ?? new Date();
  const start = event.startsAt ? new Date(event.startsAt) : null;
  const end = event.endsAt ? new Date(event.endsAt) : null;
  let timeScore = 0;
  if (start && !Number.isNaN(start.getTime())) {
    const startMs = start.getTime();
    const diffMinutes = (startMs - now.getTime()) / (1000 * 60);
    if (end && end.getTime() >= now.getTime() && startMs <= now.getTime()) {
      timeScore = 1;
      reasons.push({ code: "CONTEXT_SOON", label: "A acontecer" });
    } else if (diffMinutes <= 90 && diffMinutes > 0) {
      timeScore = 0.9;
      reasons.push({ code: "CONTEXT_SOON", label: "Começa em breve" });
    } else if (diffMinutes <= 24 * 60 && diffMinutes > 0) {
      timeScore = 0.7;
    } else if (diffMinutes <= 7 * 24 * 60 && diffMinutes > 0) {
      timeScore = 0.4;
    }
  }

  let distanceScore = 0;
  if (typeof ctx.lat === "number" && typeof ctx.lng === "number") {
    const lat = event.location?.lat;
    const lng = event.location?.lng;
    if (typeof lat === "number" && typeof lng === "number") {
      const dist = distanceKm({ lat, lng }, { lat: ctx.lat, lng: ctx.lng });
      if (dist <= 2) distanceScore = 1;
      else if (dist <= 5) distanceScore = 0.7;
      else if (dist <= 20) distanceScore = 0.4;
      else distanceScore = 0.1;
      reasons.push({ code: "CONTEXT_NEARBY", label: `${Math.round(dist)} km`, weight: distanceScore });
    }
  }

  const score = (timeScore * 0.6 + distanceScore * 0.4) || 0;
  return { score, reasons };
};

const computeRecencyScore = (event: PublicEventCard, now: Date) => {
  const start = event.startsAt ? new Date(event.startsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return 0;
  const diffHours = Math.abs(start.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours <= 6) return 1;
  if (diffHours <= 24) return 0.7;
  if (diffHours <= 72) return 0.4;
  return 0.1;
};

const aggregateSignals = (signals: Array<{ signalType: string; signalValue: number | null }>) => {
  let score = 0;
  const reasons: RankReason[] = [];
  let sawPurchase = false;
  let sawFavorite = false;
  let sawView = false;
  let sawClick = false;

  for (const signal of signals) {
    switch (signal.signalType) {
      case "PURCHASE":
        score += 1.0;
        sawPurchase = true;
        break;
      case "FAVORITE":
        score += 0.7;
        sawFavorite = true;
        break;
      case "DWELL":
        score += Math.min(0.4, (signal.signalValue ?? 0) / 30_000);
        break;
      case "VIEW":
        score += 0.15;
        sawView = true;
        break;
      case "CLICK":
        score += 0.1;
        sawClick = true;
        break;
      default:
        break;
    }
  }

  if (sawPurchase) reasons.push({ code: "BEHAVIOR_PURCHASE", weight: 1 });
  if (sawFavorite) reasons.push({ code: "BEHAVIOR_FAVORITE", weight: 0.7 });
  if (sawView) reasons.push({ code: "BEHAVIOR_VIEW", weight: 0.15 });
  if (sawClick) reasons.push({ code: "BEHAVIOR_CLICK", weight: 0.1 });

  return { score: Math.min(1, score), reasons };
};

export async function rankEvents(
  events: PublicEventCard[],
  ctx: RankContext,
): Promise<RankedItem[]> {
  if (!events.length) return [];
  const now = ctx.now ?? new Date();
  const prefs = normalizeInterestIds(ctx.favouriteCategories ?? []);
  const userId = ctx.userId ?? null;

  const eventIds = events.map((event) => event.id).filter((id) => Number.isFinite(id));
  const organizationIds = Array.from(
    new Set(events.map((event) => (event as any).organizationId).filter((id): id is number => typeof id === "number")),
  );

  const [signalRows, hideRows, orgFollowSet] = await Promise.all([
    userId
      ? prisma.userEventSignal.findMany({
          where: { userId, eventId: { in: eventIds }, signalType: { in: ["CLICK", "VIEW", "DWELL", "FAVORITE", "PURCHASE"] } },
          select: { eventId: true, signalType: true, signalValue: true },
        })
      : Promise.resolve([]),
    userId
      ? prisma.userEventSignal.findMany({
          where: { userId, signalType: { in: ["HIDE_EVENT", "HIDE_CATEGORY", "HIDE_ORG"] } },
          select: { eventId: true, organizationId: true, metadata: true, signalType: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    userId ? getOrganizationFollowingSet(userId, organizationIds) : Promise.resolve(new Set<number>()),
  ]);

  const signalsByEvent = new Map<number, Array<{ signalType: string; signalValue: number | null }>>();
  signalRows.forEach((row) => {
    if (!row.eventId) return;
    const list = signalsByEvent.get(row.eventId) ?? [];
    list.push({ signalType: row.signalType, signalValue: row.signalValue ?? null });
    signalsByEvent.set(row.eventId, list);
  });

  const hiddenEventIds = new Set<number>();
  const hiddenOrgIds = new Set<number>();
  const hiddenTags = new Set<string>();
  hideRows.forEach((row) => {
    if (row.signalType === "HIDE_EVENT" && row.eventId) hiddenEventIds.add(row.eventId);
    if (row.signalType === "HIDE_ORG" && row.organizationId) hiddenOrgIds.add(row.organizationId);
    if (row.signalType === "HIDE_CATEGORY" && row.metadata && typeof row.metadata === "object") {
      const meta = row.metadata as Record<string, unknown>;
      const tag = typeof meta.tag === "string" ? meta.tag.toLowerCase() : null;
      if (tag) hiddenTags.add(tag);
    }
  });

  let mutualFriendSet = new Set<string>();
  if (userId) {
    const attendees = await prisma.ticket.findMany({
      where: { eventId: { in: eventIds }, ownerUserId: { not: null } },
      select: { ownerUserId: true },
    });
    const uniqueIds = Array.from(new Set(attendees.map((row) => row.ownerUserId).filter(Boolean))) as string[];
    mutualFriendSet = uniqueIds.length ? await getUserMutualSet(userId, uniqueIds) : new Set<string>();
  }

  const mutualByEvent = new Map<number, number>();
  if (mutualFriendSet.size > 0) {
    const rows = await prisma.ticket.findMany({
      where: { eventId: { in: eventIds }, ownerUserId: { in: Array.from(mutualFriendSet) } },
      select: { eventId: true, ownerUserId: true },
    });
    rows.forEach((row) => {
      if (!row.eventId) return;
      mutualByEvent.set(row.eventId, (mutualByEvent.get(row.eventId) ?? 0) + 1);
    });
  }

  return events.map((event) => {
    const reasons: RankReason[] = [];

    const eventTags = (event.interestTags ?? []).map(normalizeTag);
    const fallbackTags = fallbackInterestTags(event.templateType ?? null).map(normalizeTag);
    const combinedTags = new Set([...eventTags, ...fallbackTags]);

    if (hiddenEventIds.has(event.id)) {
      return { event, rank: { score: 0, reasons: [{ code: "NEGATIVE_HIDE_EVENT" }] }, hidden: true };
    }

    const orgId = (event as any).organizationId as number | undefined;
    const negativeReasons: RankReason[] = [];
    let negativeApplied = false;

    if (orgId && hiddenOrgIds.has(orgId)) {
      negativeApplied = true;
      negativeReasons.push({ code: "NEGATIVE_HIDE_ORG" });
    }

    if (hiddenTags.size > 0) {
      for (const tag of combinedTags) {
        if (hiddenTags.has(tag)) {
          negativeApplied = true;
          negativeReasons.push({ code: "NEGATIVE_HIDE_CATEGORY" });
          break;
        }
      }
    }

    const pref = computePreferenceScore(event, prefs);
    reasons.push(...pref.reasons);

    const behavior = aggregateSignals(signalsByEvent.get(event.id) ?? []);
    reasons.push(...behavior.reasons);

    let socialScore = 0;
    if (orgId && orgFollowSet.has(orgId)) {
      socialScore += 0.6;
      reasons.push({ code: "SOCIAL_ORG_FOLLOW", weight: 0.6 });
    }
    const mutualCount = mutualByEvent.get(event.id) ?? 0;
    if (mutualCount > 0) {
      socialScore += Math.min(0.6, mutualCount * 0.2);
      reasons.push({ code: "SOCIAL_FRIENDS_GOING", label: String(mutualCount), weight: Math.min(0.6, mutualCount * 0.2) });
    }
    socialScore = Math.min(1, socialScore);

    const context = computeContextScore(event, ctx);
    reasons.push(...context.reasons);

    if (negativeReasons.length > 0) {
      reasons.push(...negativeReasons);
    }

    const recency = computeRecencyScore(event, now);

    let score =
      pref.score * WEIGHTS.preference +
      behavior.score * WEIGHTS.behavior +
      socialScore * WEIGHTS.social +
      context.score * WEIGHTS.context +
      recency * WEIGHTS.recency;

    if (score > 0 && negativeApplied) {
      score *= NEGATIVE_MULTIPLIER;
    }

    return {
      event,
      rank: {
        score: Number(score.toFixed(6)),
        reasons,
      },
      hidden: false,
    };
  });
}
