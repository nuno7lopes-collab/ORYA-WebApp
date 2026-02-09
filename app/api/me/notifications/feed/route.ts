import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { getRequestContext } from "@/lib/http/requestContext";
import { logError } from "@/lib/observability/logger";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { NotificationType, Prisma } from "@prisma/client";
import { getNotificationPrefs } from "@/lib/notifications";
import {
  NOTIFICATION_TYPES_BY_CATEGORY,
  resolveCampaignId,
  resolveNotificationCategory,
  resolveNotificationContent,
  resolvePayloadKind,
  resolveRoleLabel,
  validateNotificationInput,
} from "@/domain/notifications/registry";

const CHAT_TYPES = NOTIFICATION_TYPES_BY_CATEGORY.chat;
const NETWORK_TYPES = NOTIFICATION_TYPES_BY_CATEGORY.network;

const parseCursor = (raw?: string | null) => {
  if (!raw) return null;
  const [createdAtRaw, id] = raw.split("|");
  if (!createdAtRaw || !id) return null;
  const createdAt = new Date(createdAtRaw);
  if (!Number.isFinite(createdAt.getTime())) return null;
  return { createdAt, id };
};

const resolvePayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return {} as Record<string, unknown>;
  return payload as Record<string, unknown>;
};

// resolvePayloadKind / resolveRoleLabel / resolveCampaignId vivem no registry

const shouldFallbackOnError = (err: unknown) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P2021" || err.code === "P2022";
  }
  return false;
};

const buildFallbackPayload = (reason: string) => ({
  ok: true,
  items: [],
  nextCursor: null,
  unreadCount: 0,
  meta: { fallback: reason },
});

export async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  let userId: string | null = null;
  let tab: "all" | "network" = "all";
  let limit = 30;
  let cursorRaw: string | null = null;
  try {
    const user = await requireUser();
    userId = user.id;
    const url = new URL(req.url);
    tab = url.searchParams.get("tab") === "network" ? "network" : "all";
    const limitRaw = Number(url.searchParams.get("limit") ?? 30);
    limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 60) : 30;
    cursorRaw = url.searchParams.get("cursor");
    const cursor = parseCursor(cursorRaw);

    const prefs = await getNotificationPrefs(user.id).catch(() => null);
    const allowSocial = (prefs as any)?.allowSocialNotifications ?? prefs?.allowFollowRequests ?? true;
    const allowEvents = (prefs as any)?.allowEventNotifications ?? prefs?.allowEventReminders ?? true;
    let mutes: Array<{ organizationId: number | null; eventId: number | null }> = [];
    try {
      mutes = await prisma.notificationMute.findMany({
        where: { userId: user.id },
        select: { organizationId: true, eventId: true },
      });
    } catch (err) {
      logError("me.notifications.feed.mutes", err, {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        orgId: ctx.orgId,
        userId,
      });
    }
    const mutedOrgIds = new Set(mutes.map((m) => m.organizationId).filter(Boolean) as number[]);
    const mutedEventIds = new Set(mutes.map((m) => m.eventId).filter(Boolean) as number[]);

    const allTypes = Object.values(NotificationType).filter((type) => !CHAT_TYPES.includes(type));
    const allowedTypesAll = allTypes.filter((type) => {
      const category = resolveNotificationCategory(type);
      if (category === "network") return allowSocial;
      if (category === "events") return allowEvents;
      return false;
    });
    const allowedTypesTab =
      tab === "network" ? allowedTypesAll.filter((type) => NETWORK_TYPES.includes(type)) : allowedTypesAll;

    const muteFilters: Prisma.NotificationWhereInput[] = [];
    if (mutedOrgIds.size > 0) {
      muteFilters.push({
        OR: [{ organizationId: null }, { organizationId: { notIn: Array.from(mutedOrgIds) } }],
      });
    }
    if (mutedEventIds.size > 0) {
      muteFilters.push({
        OR: [{ eventId: null }, { eventId: { notIn: Array.from(mutedEventIds) } }],
      });
    }

    let unreadCount = 0;
    if (allowedTypesAll.length) {
      try {
        unreadCount = await prisma.notification.count({
          where: {
            userId: user.id,
            isRead: false,
            type: { in: allowedTypesAll },
            ...(muteFilters.length ? { AND: muteFilters } : {}),
          },
        });
      } catch (err) {
        logError("me.notifications.feed.unread_count", err, {
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          orgId: ctx.orgId,
          userId,
          tab,
        });
        if (shouldFallbackOnError(err)) {
          return jsonWrap(buildFallbackPayload("unread_count"));
        }
      }
    }

    if (allowedTypesTab.length === 0) {
      return jsonWrap({ ok: true, items: [], nextCursor: null, unreadCount });
    }

    const where: Prisma.NotificationWhereInput = {
      userId: user.id,
      type: { in: allowedTypesTab },
      ...(muteFilters.length ? { AND: muteFilters } : {}),
    };

    if (cursor) {
      const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where.AND = [
        ...existingAnd,
        {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        },
      ];
    }

    let rawNotifications: Prisma.NotificationGetPayload<{
      include: {
        fromUser: { select: { id: true; username: true; fullName: true; avatarUrl: true } };
        organization: {
          select: {
            id: true;
            username: true;
            publicName: true;
            businessName: true;
            brandingAvatarUrl: true;
            brandingCoverUrl: true;
          };
        };
        event: { select: { id: true; title: true; slug: true; coverImageUrl: true; organizationId: true } };
      };
    }>[] = [];
    try {
      rawNotifications = await prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit * 6,
        include: {
          fromUser: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
          organization: {
            select: {
              id: true,
              username: true,
              publicName: true,
              businessName: true,
              brandingAvatarUrl: true,
              brandingCoverUrl: true,
            },
          },
          event: { select: { id: true, title: true, slug: true, coverImageUrl: true, organizationId: true } },
        },
      });
    } catch (err) {
      logError("me.notifications.feed.fetch", err, {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        orgId: ctx.orgId,
        userId,
        tab,
      });
      if (shouldFallbackOnError(err)) {
        return jsonWrap(buildFallbackPayload("fetch_notifications"));
      }
      throw err;
    }

    const notifications = rawNotifications;

    const ticketIds = Array.from(
      new Set(
        notifications
          .map((n) => (typeof n.ticketId === "string" ? n.ticketId : null))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const entitlementByTicketId = new Map<string, string>();
    if (ticketIds.length) {
      try {
        const entitlements = await prisma.entitlement.findMany({
          where: { ticketId: { in: ticketIds } },
          select: { id: true, ticketId: true },
        });
        for (const entitlement of entitlements) {
          if (entitlement.ticketId) {
            entitlementByTicketId.set(entitlement.ticketId, entitlement.id);
          }
        }
      } catch (err) {
        logError("me.notifications.feed.entitlements", err, {
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          orgId: ctx.orgId,
          userId,
          tab,
        });
      }
    }

    const followRequesterIds = Array.from(
      new Set(
        notifications
          .filter((n) => n.type === "FOLLOW_REQUEST" && n.fromUserId)
          .map((n) => n.fromUserId as string),
      ),
    );

    let followRequestRows: Array<{ id: number; requester_id: string }> = [];
    if (followRequesterIds.length) {
      try {
        followRequestRows = await prisma.follow_requests.findMany({
          where: { target_id: user.id, requester_id: { in: followRequesterIds } },
          select: { id: true, requester_id: true },
        });
      } catch (err) {
        logError("me.notifications.feed.follow_requests", err, {
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          orgId: ctx.orgId,
          userId,
        });
      }
    }

    const followRequestMap = new Map(followRequestRows.map((r) => [r.requester_id, r.id] as const));

    type Group = {
      key: string;
      items: typeof notifications;
      actorIds: Set<string>;
      totalCount: number;
    };

    const groups: Group[] = [];
    const groupMap = new Map<string, Group>();
    let lastNotification: (typeof notifications)[number] | null = null;
    const maxGroupItems = 12;

    for (const notification of notifications) {
      const date = new Date(notification.createdAt);
      const dateBucket = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      const payload = resolvePayload(notification.payload);

      const groupable = notification.type === "FOLLOW_ACCEPT" || notification.type === "NEW_EVENT_FROM_FOLLOWED_ORGANIZATION";

      const groupKey = groupable
        ? [
            notification.type,
            notification.type === "NEW_EVENT_FROM_FOLLOWED_ORGANIZATION" ? notification.organizationId ?? "none" : "",
            dateBucket,
          ]
            .filter(Boolean)
            .join(":")
        : `single:${notification.id}`;

      let group = groupMap.get(groupKey);
      if (!group) {
        if (groups.length >= limit) {
          break;
        }
        group = { key: groupKey, items: [], actorIds: new Set(), totalCount: 0 };
        groupMap.set(groupKey, group);
        groups.push(group);
      }
      group.totalCount += 1;
      if (notification.fromUserId) {
        group.actorIds.add(notification.fromUserId);
      }
      if (group.items.length < maxGroupItems) {
        group.items.push(notification);
      }
      lastNotification = notification;
    }

    const items = groups.map((group) => {
      const primary = group.items[0];

      const actorList: Array<{ id: string; name: string; avatarUrl: string | null; username?: string | null }> = [];
      const actorSeen = new Set<string>();
      const orgAvatarTypes = new Set([
        "ORGANIZATION_INVITE",
        "CLUB_INVITE",
        "ORGANIZATION_TRANSFER",
        "NEW_EVENT_FROM_FOLLOWED_ORGANIZATION",
        "EVENT_INVITE",
      ]);
      const useOrgAvatar = orgAvatarTypes.has(primary.type) && Boolean(primary.organization);

      if (useOrgAvatar && primary.organization) {
        actorList.push({
          id: `org:${primary.organization.id}`,
          name: primary.organization.publicName || primary.organization.businessName || "Organização",
          avatarUrl: primary.organization.brandingAvatarUrl ?? null,
          username: primary.organization.username ?? null,
        });
      } else {
        for (const item of group.items) {
          const fromUser = item.fromUser;
          if (fromUser?.id && !actorSeen.has(fromUser.id)) {
            actorSeen.add(fromUser.id);
            actorList.push({
              id: fromUser.id,
              name: fromUser.fullName || fromUser.username || "Utilizador",
              avatarUrl: fromUser.avatarUrl ?? null,
              username: fromUser.username ?? null,
            });
          }
        }
      }

      const actorCount = group.actorIds.size > 0 ? group.actorIds.size : group.totalCount || actorList.length;
      const actors = actorList.slice(0, 3);
      const payload = resolvePayload(primary.payload);
      const payloadKind = resolvePayloadKind(payload);
      const roleLabel = resolveRoleLabel(payload);

      const singleActor = actorCount === 1 ? actors[0] : null;
      const registryInput = {
        type: primary.type,
        title: primary.title ?? null,
        body: primary.body ?? null,
        ctaUrl: primary.ctaUrl ?? null,
        ctaLabel: primary.ctaLabel ?? null,
        fromUserId: primary.fromUserId ?? null,
        organizationId: primary.organizationId ?? null,
        eventId: primary.eventId ?? null,
        ticketId: primary.ticketId ?? null,
        ticketEntitlementId: primary.ticketId ? entitlementByTicketId.get(primary.ticketId) ?? null : null,
        inviteId: primary.inviteId ?? null,
        payload,
        payloadKind,
        roleLabel,
        campaignId: resolveCampaignId(payload),
        actors,
        actorCount,
        followRequestId: singleActor ? followRequestMap.get(singleActor.id) ?? null : null,
        event: primary.event
          ? {
              id: primary.event.id,
              title: primary.event.title,
              slug: primary.event.slug,
              coverImageUrl: primary.event.coverImageUrl ?? null,
              organizationId: primary.event.organizationId ?? null,
            }
          : undefined,
        organization: primary.organization
          ? {
              id: primary.organization.id,
              publicName: primary.organization.publicName,
              businessName: primary.organization.businessName,
              brandingAvatarUrl: primary.organization.brandingAvatarUrl ?? null,
              brandingCoverUrl: primary.organization.brandingCoverUrl ?? null,
            }
          : undefined,
      };

      const content = resolveNotificationContent(registryInput);
      const missing = validateNotificationInput(registryInput);
      if (missing.length) {
        console.warn("[notifications][feed] missing_fields", { notificationId: primary.id, type: primary.type, missing });
      }

      const thumbnailUrl = primary.event?.coverImageUrl ?? primary.organization?.brandingCoverUrl ?? null;

      return {
        id: primary.id,
        type: primary.type,
        category: content.category,
        createdAt: primary.createdAt.toISOString(),
        isRead: group.items.every((item) => item.isRead),
        title: content.title,
        body: content.body,
        actors,
        actorCount,
        thumbnailUrl,
        ctaUrl: content.ctaUrl ?? undefined,
        ctaLabel: content.ctaLabel ?? undefined,
        organizationId: primary.organizationId ?? undefined,
        eventId: primary.eventId ?? undefined,
        payloadKind: payloadKind ?? undefined,
        payload: primary.payload ?? undefined,
        actions: content.actions && content.actions.length > 0 ? content.actions : undefined,
      };
    });

    const nextCursor = lastNotification
      ? `${lastNotification.createdAt.toISOString()}|${lastNotification.id}`
      : null;

    return jsonWrap({ ok: true, items, nextCursor, unreadCount });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    logError("me.notifications.feed", err, {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      orgId: ctx.orgId,
      userId,
      tab,
      limit,
      cursor: cursorRaw,
    });
    if (shouldFallbackOnError(err)) {
      return jsonWrap(buildFallbackPayload("handler"));
    }
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
