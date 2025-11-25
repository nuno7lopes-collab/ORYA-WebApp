

// app/api/experiencias/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const cityParam = searchParams.get("city") || undefined;
    const searchParam = searchParams.get("search") || undefined;
    const limitParam = searchParams.get("limit");
    const limitNumber = limitParam ? parseInt(limitParam, 10) : 20;
    const take = Number.isNaN(limitNumber)
      ? 20
      : Math.min(Math.max(limitNumber, 1), 50);

    const where: Prisma.EventWhereInput = {
      type: "EXPERIENCE",
      status: "PUBLISHED",
      // Se quiseres só futuras, podes descomentar:
      // startsAt: { gte: new Date() },
    };

    if (cityParam) {
      where.locationCity = {
        contains: cityParam,
        mode: "insensitive",
      };
    }

    if (searchParam) {
      const searchFilter: Prisma.EventWhereInput = {
        OR: [
          {
            title: {
              contains: searchParam,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: searchParam,
              mode: "insensitive",
            },
          },
          {
            locationName: {
              contains: searchParam,
              mode: "insensitive",
            },
          },
        ],
      };

      // AND passa a ser sempre um array homogéneo de EventWhereInput
      where.AND = [searchFilter];
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startsAt: "asc" },
      take,
    });

    const ownerIds = Array.from(
      new Set(
        events
          .map((e) => e.ownerUserId)
          .filter((id): id is string => Boolean(id))
      )
    );

    const owners =
      ownerIds.length > 0
        ? await prisma.profile.findMany({
            where: { id: { in: ownerIds } },
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          })
        : [];

    const ownerMap = new Map(
      owners.map((o) => [
        o.id,
        {
          id: o.id,
          username: o.username,
          fullName: o.fullName,
        },
      ])
    );

    const items = events.map((event) => {
      const owner = ownerMap.get(event.ownerUserId);

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description:
          event.description && event.description.length > 280
            ? event.description.slice(0, 280) + "..."
            : event.description,
        startsAt: event.startsAt,
        locationName: event.locationName,
        locationCity: event.locationCity,
        owner,
      };
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch (err) {
    console.error("GET /api/experiencias/list error:", err);
    return NextResponse.json(
      { items: [], error: "Erro ao carregar experiências." },
      { status: 500 }
    );
  }
}