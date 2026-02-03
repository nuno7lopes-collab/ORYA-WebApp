import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { toPublicEventCardWithPrice } from "@/domain/events/publicEventCard";
import { getPublicDiscoverBySlug } from "@/domain/search/publicDiscover";

type Params = { slug: string };

async function _GET(req: NextRequest, context: { params: Params | Promise<Params> }) {
  const { slug } = await context.params;

  if (!slug) {
    return jsonWrap({ errorCode: "BAD_REQUEST", message: "Slug inválido." }, { status: 400 });
  }

  const event = await prisma.event.findFirst({
    where: {
      slug,
      status: { in: ["PUBLISHED", "DATE_CHANGED"] },
      isDeleted: false,
      organization: { status: "ACTIVE" },
    },
    include: {
      organization: { select: { publicName: true } },
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
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!event) {
    const indexed = await getPublicDiscoverBySlug(slug);
    if (!indexed) {
      return jsonWrap({ errorCode: "NOT_FOUND", message: "Evento não encontrado." }, { status: 404 });
    }
    return jsonWrap({ item: indexed });
  }

  const ownerProfile = await prisma.profile.findUnique({
    where: { id: event.ownerUserId },
    select: { fullName: true, username: true },
  });

  const card = toPublicEventCardWithPrice({
    event,
    ownerProfile,
  });

  const { _priceFromCents, ...item } = card;
  return jsonWrap({ item });
}

export const GET = withApiEnvelope(_GET);
