export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { toPublicEventCardWithPrice, isPublicEventCardComplete } from "@/domain/events/publicEventCard";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";

type FeedItem = {
  id: string;
  kind: "event";
  createdAt: string;
  organization: {
    id: number;
    name: string;
    username: string | null;
    avatarUrl: string | null;
  };
  event: ReturnType<typeof toPublicEventCardWithPrice> extends infer T
    ? T extends { _priceFromCents: number | null }
      ? Omit<T, "_priceFromCents">
      : T
    : never;
};

async function _GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, limitRaw), 30) : 24;
  const cursor = searchParams.get("cursor");
  const cursorId = cursor ? Number(cursor) : null;
  if (cursor && Number.isNaN(cursorId)) {
    return jsonWrap(
      { ok: false, error: "INVALID_CURSOR" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const orgFollows = await prisma.organization_follows.findMany({
    where: { follower_id: user.id },
    select: { organization_id: true },
  });
  const orgIds = orgFollows.map((row) => row.organization_id);
  if (orgIds.length === 0) {
    return jsonWrap(
      { ok: true, items: [], pagination: { nextCursor: null, hasMore: false } },
      { status: 200 },
    );
  }

  const events = await prisma.event.findMany({
    where: {
      organizationId: { in: orgIds },
      status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
      isDeleted: false,
      organization: { status: "ACTIVE" },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursorId
      ? {
          skip: 1,
          cursor: { id: cursorId },
        }
      : {}),
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      status: true,
      templateType: true,
      ownerUserId: true,
      pricingMode: true,
      addressId: true,
      addressRef: {
        select: { formattedAddress: true, canonical: true, latitude: true, longitude: true },
      },
      coverImageUrl: true,
      createdAt: true,
      organization: {
        select: {
          id: true,
          publicName: true,
          businessName: true,
          username: true,
          brandingAvatarUrl: true,
        },
      },
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
    },
  });

  let nextCursor: number | null = null;
  if (events.length > limit) {
    const next = events.pop();
    nextCursor = next?.id ?? null;
  }

  const items: FeedItem[] = events
    .map((event): FeedItem => {
      const card = toPublicEventCardWithPrice({
        event: {
          id: event.id,
          slug: event.slug,
          title: event.title,
          description: event.description ?? null,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          status: event.status,
          templateType: event.templateType ?? null,
          ownerUserId: event.ownerUserId ?? null,
          organization: event.organization
            ? {
                publicName: event.organization.publicName,
                businessName: event.organization.businessName,
                username: event.organization.username,
              }
            : null,
          addressId: event.addressId ?? null,
          addressRef: event.addressRef ?? null,
          coverImageUrl: event.coverImageUrl ?? null,
          pricingMode: event.pricingMode ?? null,
          ticketTypes: event.ticketTypes ?? [],
        },
      });
      const { _priceFromCents, ...publicCard } = card;
      const orgName =
        event.organization?.publicName ??
        event.organization?.businessName ??
        "Organização ORYA";
      return {
        id: `event_${event.id}`,
        kind: "event",
        createdAt: event.createdAt.toISOString(),
        organization: {
          id: event.organization?.id ?? 0,
          name: orgName,
          username: event.organization?.username ?? null,
          avatarUrl: event.organization?.brandingAvatarUrl ?? null,
        },
        event: publicCard,
      };
    })
    .filter((item) => isPublicEventCardComplete(item.event));

  return jsonWrap(
    {
      ok: true,
      items,
      pagination: { nextCursor: nextCursor ? String(nextCursor) : null, hasMore: Boolean(nextCursor) },
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
