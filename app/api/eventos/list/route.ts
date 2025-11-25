import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 12;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");

  const take = limitParam
    ? Math.min(parseInt(limitParam, 10) || DEFAULT_PAGE_SIZE, 50)
    : DEFAULT_PAGE_SIZE;

  type EventListItem = {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    startsAt: string | null;
    locationName: string | null;
    locationCity: string | null;
    priceFromCents: number | null;
  };

  let items: EventListItem[] = [];
  let nextCursor: number | null = null;

  try {
    const query: Prisma.EventFindManyArgs = {
      orderBy: { startsAt: "asc" },
      take: take + 1, // +1 para sabermos se há mais páginas
    };

    if (cursor) {
      const cursorId = Number(cursor);
      if (Number.isNaN(cursorId)) {
        return NextResponse.json(
          { items: [], pagination: { nextCursor: null, hasMore: false } },
          { status: 400 },
        );
      }
      query.skip = 1;
      query.cursor = { id: cursorId };
    }

    const events = await prisma.event.findMany(query);

    if (events.length > take) {
      const next = events.pop();
      nextCursor = next?.id ?? null;
    }

    items = events.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      description: e.description ?? null,
      startsAt: e.startsAt
        ? (typeof e.startsAt === "string"
            ? e.startsAt
            : e.startsAt.toISOString?.() ?? null)
        : null,
      locationName: e.locationName ?? null,
      locationCity: e.locationCity ?? null,
      priceFromCents: e.priceFromCents ?? null,
    }));
  } catch (error) {
    console.error("[api/eventos/list] Erro ao carregar eventos, fallback para lista vazia:", error);
    items = [];
    nextCursor = null;
  }

  return NextResponse.json({
    items,
    pagination: {
      nextCursor,
      hasMore: nextCursor !== null,
    },
  });
}
