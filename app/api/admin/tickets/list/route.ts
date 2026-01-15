import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import type { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

function parsePositiveInt(raw: string | null, fallback: number) {
  if (!raw) return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "ALL").toUpperCase();
    const intent = (url.searchParams.get("intent") || "").trim();
    const slug = (url.searchParams.get("slug") || "").trim();
    const userQuery = (url.searchParams.get("userQuery") || "").trim();
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSizeRaw = parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(pageSizeRaw, MAX_PAGE_SIZE);
    const skip = (page - 1) * pageSize;

    const where: Prisma.TicketWhereInput = {};
    if (status !== "ALL") {
      where.status = status;
    }
    if (intent) {
      where.stripePaymentIntentId = { contains: intent, mode: "insensitive" };
    }
    if (slug) {
      where.event = { slug: { contains: slug, mode: "insensitive" } };
    }
    let filteredUserIds: string[] | null = null;
    if (userQuery) {
      const profiles = await prisma.profile.findMany({
        where: {
          OR: [
            { username: { contains: userQuery, mode: "insensitive" } },
            { fullName: { contains: userQuery, mode: "insensitive" } },
            { users: { email: { contains: userQuery, mode: "insensitive" } } },
          ],
        },
        select: { id: true },
        take: 50,
      });
      filteredUserIds = profiles.map((p) => p.id);
      if (filteredUserIds.length === 0) {
        return NextResponse.json(
          { ok: true, tickets: [], page, pageSize, total: 0 },
          { status: 200 },
        );
      }
      where.userId = { in: filteredUserIds };
    }
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { purchaseId: { contains: q, mode: "insensitive" } },
        { stripePaymentIntentId: { contains: q, mode: "insensitive" } },
        { event: { title: { contains: q, mode: "insensitive" } } },
        { event: { slug: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, tickets] = await prisma.$transaction([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        orderBy: { purchasedAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          status: true,
          purchasedAt: true,
          pricePaid: true,
          totalPaidCents: true,
          platformFeeCents: true,
          currency: true,
          stripePaymentIntentId: true,
          userId: true,
          ownerUserId: true,
          event: { select: { id: true, title: true, slug: true, startsAt: true } },
          ticketType: { select: { id: true, name: true } },
          saleSummary: { select: { status: true } },
        },
      }),
    ]);

    const userIds = Array.from(
      new Set(
        tickets
          .map((ticket) => ticket.userId ?? ticket.ownerUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const profiles = userIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, fullName: true, users: { select: { email: true } } },
        })
      : [];
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    const payload = tickets.map((ticket) => ({
      userId: ticket.userId ?? ticket.ownerUserId ?? null,
      id: ticket.id,
      status: ticket.status,
      purchasedAt: ticket.purchasedAt,
      currency: ticket.currency,
      stripePaymentIntentId: ticket.stripePaymentIntentId,
      platformFeeCents: ticket.platformFeeCents,
      totalPaidCents: ticket.totalPaidCents,
      pricePaidCents: ticket.pricePaid,
      paymentEventStatus: ticket.saleSummary?.status ?? null,
      event: ticket.event
        ? {
            id: ticket.event.id,
            title: ticket.event.title,
            slug: ticket.event.slug,
            startsAt: ticket.event.startsAt,
          }
        : null,
      ticketType: ticket.ticketType
        ? { id: ticket.ticketType.id, name: ticket.ticketType.name }
        : null,
      user: (() => {
        const resolvedUserId = ticket.userId ?? ticket.ownerUserId ?? null;
        if (!resolvedUserId) return null;
        const profile = profileById.get(resolvedUserId) ?? null;
        return {
          id: resolvedUserId,
          email: profile?.users?.email ?? null,
          profile: {
            username: profile?.username ?? null,
            fullName: profile?.fullName ?? null,
          },
        };
      })(),
    }));

    return NextResponse.json(
      { ok: true, tickets: payload, page, pageSize, total },
      { status: 200 },
    );
  } catch (err) {
    console.error("[admin/tickets/list]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
