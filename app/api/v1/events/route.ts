/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const q = searchParams.get("q") ?? "";
    const rawDate = searchParams.get("date");
    const rawType = searchParams.get("type");
    const rawSort = searchParams.get("sort");
    const cursorParam = searchParams.get("cursor");
    const limitParam = searchParams.get("limit");

    // ---- Normalização de parâmetros ----
    const dateFilter: "all" | "today" | "upcoming" =
      rawDate === "today" || rawDate === "upcoming" ? rawDate : "all";

    const typeFilter: "all" | "free" | "paid" =
      rawType === "free" || rawType === "paid" ? rawType : "all";

    const sort: "recommended" | "price_asc" | "price_desc" | "newest" =
      rawSort === "price_asc" ||
      rawSort === "price_desc" ||
      rawSort === "newest"
        ? rawSort
        : "recommended";

    const take = limitParam
      ? Math.min(parseInt(limitParam, 10) || 12, 50)
      : 12;

    const now = new Date();

    // ---- Filtros de data ----
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    let dateWhere: any = {};
    if (dateFilter === "today") {
      dateWhere = {
        startDate: { gte: startOfToday, lte: endOfToday },
      };
    } else if (dateFilter === "upcoming") {
      dateWhere = {
        startDate: { gte: now },
      };
    }

    // ---- Filtro free/pago ----
    let typeWhere: any = {};
    if (typeFilter === "free") {
      typeWhere = { isFree: true };
    } else if (typeFilter === "paid") {
      typeWhere = { isFree: false };
    }

        // ---- Search ----
// Nota: com SQLite, não temos `mode: "insensitive"` aqui.
// Fica case-sensitive por agora (dá para melhorar depois com normalização).
const searchWhere: any =
  q.trim().length > 0
    ? {
        OR: [
          { title: { contains: q } },
          { description: { contains: q } },
          { locationName: { contains: q } },
        ],
      }
    : {};

    const where = {
      AND: [dateWhere, typeWhere, searchWhere],
    };

    // ---- Sorting ----
    let orderBy: any = { startDate: "asc" }; // recommended default
    if (sort === "price_asc") {
      orderBy = { basePrice: "asc" };
    } else if (sort === "price_desc") {
      orderBy = { basePrice: "desc" };
    } else if (sort === "newest") {
      orderBy = { createdAt: "desc" };
    }

    // ---- Cursor seguro ----
    let cursorId: number | null = null;
    if (cursorParam !== null && cursorParam !== "") {
      const parsed = Number(cursorParam);
      if (Number.isFinite(parsed)) {
        cursorId = parsed;
      }
    }

    const events = await prisma.event.findMany({
      where,
      orderBy,
      take: take + 1, // +1 para detectar se há próxima página
      ...(cursorId !== null
        ? {
            skip: 1,
            cursor: { id: cursorId },
          }
        : {}),
      include: {
        tickets: {
          include: {
            reservations: true,
          },
        },
        _count: {
          select: {
            tickets: true,
            purchases: true,
          },
        },
      },
    });

    // ---- Paginação ----
    let nextCursor: number | null = null;
    if (events.length > take) {
      const last = events.pop()!;
      nextCursor = last.id;
    }

    // ---- Transformação para payload "feed" ----
    const payload = events.map((event: any) => {
      // Price must only consider waves with real stock (remaining > 0)
      const validPrices = event.tickets
        .map((t: any) => {
          if (t.totalQuantity === null || t.totalQuantity === undefined) {
            return t.price; // unlimited stock → OK
          }

          const activeReservations = t.reservations
            ? t.reservations.filter(
                (r: any) =>
                  r.status === "ACTIVE" &&
                  r.expiresAt &&
                  new Date(r.expiresAt) > now
              )
            : [];

          const reservedQty = activeReservations.reduce(
            (sum: number, r: any) => sum + (r.quantity ?? 0),
            0
          );

          const remaining = t.totalQuantity - t.soldQuantity - reservedQty;

          return remaining > 0 ? t.price : null;
        })
        .filter((p: any) => typeof p === "number");

      const priceFromCents =
        validPrices.length > 0 ? Math.min(...validPrices) : event.basePrice ?? null;

      const priceFrom =
        priceFromCents !== null && priceFromCents !== undefined
          ? priceFromCents / 100
          : null;

      const totalWaves = event.tickets.length;
      const onSaleCount = event.tickets.filter(
        (t: any) => t.available && t.isVisible,
      ).length;
      const soldOutCount = event.tickets.filter((t: any) => {
        if (t.totalQuantity === null || t.totalQuantity === undefined) return false;

        // Calculate reservedQty from reservations array already loaded
        const activeReservations = t.reservations
          ? t.reservations.filter(
              (r: any) =>
                r.status === "ACTIVE" &&
                r.expiresAt &&
                new Date(r.expiresAt) > now
            )
          : [];

        const reservedQty = activeReservations.reduce(
          (sum: number, r: any) => sum + (r.quantity ?? 0),
          0
        );

        const remaining = t.totalQuantity - t.soldQuantity - reservedQty;

        return remaining <= 0;
      }).length;

      const futureStarts = event.tickets
        .filter((t: any) => t.startsAt && t.startsAt > now)
        .map((t: any) => t.startsAt as Date);
      const nextWaveOpensAt = futureStarts.length
        ? futureStarts.sort((a: Date, b: Date) => a.getTime() - b.getTime())[0]
        : null;

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        shortDescription: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        venue: {
          name: event.locationName,
          address: event.address,
          city: null,
          lat: null,
          lng: null,
        },
        coverImageUrl: event.coverImageUrl,
        isFree: event.isFree,
        priceFrom,
        stats: {
          // por enquanto hardcoded; no futuro ligamos a participações reais
          goingCount: 0,
          interestedCount: 0,
        },
        wavesSummary: {
          totalWaves,
          onSaleCount,
          soldOutCount,
          nextWaveOpensAt,
        },
        category: null,
        tags: [] as string[],
      };
    });

    return NextResponse.json(
      {
        events: payload,
        pagination: {
          nextCursor,
          hasMore: nextCursor !== null,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[GET /api/v1/events]", err);

    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
        ? err
        : "Erro desconhecido no servidor.";

    // devolvemos a mensagem real para ser mais fácil debugar se voltar a acontecer
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}