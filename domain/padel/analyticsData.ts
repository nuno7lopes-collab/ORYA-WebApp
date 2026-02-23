import { prisma } from "@/lib/prisma";
import { buildPadelAnalytics, PadelAnalyticsResult } from "@/domain/padel/analytics";

export type PadelAnalyticsEventContext = {
  id: number;
  organizationId: number;
  slug: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  timezone: string | null;
  courtCountFallback: number;
  clubIds: number[];
};

const normalizeClubIds = (clubIds: Array<number | null | undefined>) => {
  const deduped = new Set<number>();
  clubIds.forEach((clubId) => {
    if (Number.isFinite(clubId as number)) deduped.add(Number(clubId));
  });
  return Array.from(deduped.values());
};

export async function loadPadelAnalyticsEventContext(eventId: number): Promise<PadelAnalyticsEventContext | null> {
  if (!Number.isInteger(eventId) || eventId <= 0) return null;
  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      id: true,
      organizationId: true,
      templateType: true,
      slug: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      padelTournamentConfig: {
        select: {
          numberOfCourts: true,
          padelClubId: true,
          partnerClubIds: true,
        },
      },
    },
  });
  if (!event?.organizationId || event.templateType !== "PADEL") return null;

  const clubIds = normalizeClubIds([
    event.padelTournamentConfig?.padelClubId,
    ...(event.padelTournamentConfig?.partnerClubIds ?? []),
  ]);

  return {
    id: event.id,
    organizationId: event.organizationId,
    slug: event.slug ?? null,
    startsAt: event.startsAt ?? null,
    endsAt: event.endsAt ?? null,
    timezone: event.timezone ?? null,
    courtCountFallback:
      event.padelTournamentConfig?.numberOfCourts && event.padelTournamentConfig.numberOfCourts > 0
        ? event.padelTournamentConfig.numberOfCourts
        : 0,
    clubIds,
  };
}

export async function buildPadelAnalyticsForEventContext(
  event: PadelAnalyticsEventContext,
): Promise<PadelAnalyticsResult> {
  const [matches, courts, sales, categoryLinks, saleLines] = await Promise.all([
    prisma.eventMatchSlot.findMany({
      where: { eventId: event.id },
      select: {
        id: true,
        categoryId: true,
        courtId: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        actualStartAt: true,
        actualEndAt: true,
        startTime: true,
        roundType: true,
        roundLabel: true,
      },
    }),
    event.clubIds.length
      ? prisma.padelClubCourt.findMany({
          where: { padelClubId: { in: event.clubIds }, isActive: true },
          select: { id: true, name: true },
          orderBy: [{ padelClubId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    prisma.saleSummary.aggregate({
      where: { eventId: event.id, status: "PAID" },
      _sum: {
        totalCents: true,
        platformFeeCents: true,
        netCents: true,
        stripeFeeCents: true,
      },
    }),
    prisma.padelEventCategoryLink.findMany({
      where: { eventId: event.id },
      select: {
        padelCategoryId: true,
        format: true,
        category: { select: { label: true } },
      },
    }),
    prisma.saleLine.findMany({
      where: { eventId: event.id, saleSummary: { status: "PAID" } },
      select: {
        grossCents: true,
        netCents: true,
        platformFeeCents: true,
        padelRegistrationLine: {
          select: {
            padelRegistration: {
              select: {
                pairing: { select: { categoryId: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const categoryMap = new Map(
    categoryLinks.map((link) => [
      link.padelCategoryId,
      { label: link.category?.label ?? null, format: link.format ?? null },
    ]),
  );

  return buildPadelAnalytics({
    event: {
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timezone: event.timezone,
    },
    matches,
    courts: courts.map((court) => ({ id: court.id, name: court.name ?? null })),
    courtCountFallback: event.courtCountFallback,
    salesTotals: {
      totalCents: sales._sum.totalCents ?? 0,
      platformFeeCents: sales._sum.platformFeeCents ?? 0,
      stripeFeeCents: sales._sum.stripeFeeCents ?? 0,
      netCents: sales._sum.netCents ?? 0,
    },
    saleLines: saleLines.map((line) => {
      const categoryId = line.padelRegistrationLine?.padelRegistration?.pairing?.categoryId ?? null;
      const categoryMeta = categoryId ? categoryMap.get(categoryId) : null;
      return {
        grossCents: line.grossCents ?? 0,
        netCents: line.netCents ?? 0,
        platformFeeCents: line.platformFeeCents ?? 0,
        categoryId,
        categoryLabel: categoryMeta?.label ?? null,
        format: categoryMeta?.format ?? null,
      };
    }),
  });
}
