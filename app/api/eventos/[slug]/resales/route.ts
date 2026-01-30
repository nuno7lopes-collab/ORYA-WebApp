// app/api/eventos/[slug]/resales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ResaleStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

/**
 * F5-9 – Listar revendas disponíveis por evento
 *
 * GET /api/eventos/[slug]/resales
 *
 * Resposta:
 * {
 *   ok: true,
 *   eventId,
 *   slug,
 *   resales: [
 *     {
 *       id,
 *       ticketId,
 *       price,
 *       currency,
 *       status,
 *       seller: { id, username, fullName } | null,
 *       ticketTypeName
 *     },
 *     ...
 *   ]
 * }
 */

type RouteParams = { slug?: string };

async function _GET(
  _req: NextRequest,
  context: { params: RouteParams | Promise<RouteParams> },
) {
  try {
    const resolved = await context.params;
    const slug = resolved?.slug;

    if (!slug || typeof slug !== "string") {
      return jsonWrap(
        { ok: false, error: "MISSING_OR_INVALID_SLUG" },
        { status: 400 }
      );
    }

    // 1. Buscar evento pelo slug
    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
      },
    });

    if (!event) {
      return jsonWrap(
        { ok: false, error: "EVENT_NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2. Buscar revendas LISTED ligadas a este evento
    const resales = await prisma.ticketResale.findMany({
      where: {
        status: ResaleStatus.LISTED,
        ticket: {
          eventId: event.id,
        },
      },
      include: {
        ticket: {
          include: {
            ticketType: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // 3. Buscar perfis dos sellers (para username / fullName)
    const sellerIds = Array.from(
      new Set(resales.map((r) => r.sellerUserId).filter(Boolean))
    ) as string[];

    let sellersMap: Record<
      string,
      { id: string; username: string | null; fullName: string | null }
    > = {};

    if (sellerIds.length > 0) {
      const sellers = await prisma.profile.findMany({
        where: {
          id: { in: sellerIds },
        },
        select: {
          id: true,
          username: true,
          fullName: true,
        },
      });

      sellersMap = sellers.reduce<typeof sellersMap>((acc, s) => {
        acc[s.id] = {
          id: s.id,
          username: s.username,
          fullName: s.fullName,
        };
        return acc;
      }, {});
    }

    // 4. Moldar resposta leve para o frontend
    const payload = resales.map((r) => ({
      id: r.id,
      ticketId: r.ticketId,
      price: r.price,
      currency: r.currency,
      status: r.status,
      seller: sellersMap[r.sellerUserId] ?? null,
      ticketTypeName: r.ticket?.ticketType?.name ?? null,
    }));

    return jsonWrap(
      {
        ok: true,
        eventId: event.id,
        slug: event.slug,
        resales: payload,
      },
      { status: 200 }
    );
  } catch (error) {
    logError("eventos.resales_failed", error);
    return jsonWrap(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
export const GET = withApiEnvelope(_GET);
