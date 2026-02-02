import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { toPublicEventCardWithPrice } from "@/domain/events/publicEventCard";

async function _GET(req: NextRequest, context: { params: { slug: string } }) {
  const slug = context.params.slug;

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
      ticketTypes: { select: { price: true } },
    },
  });

  if (!event) {
    return jsonWrap({ errorCode: "NOT_FOUND", message: "Evento não encontrado." }, { status: 404 });
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
