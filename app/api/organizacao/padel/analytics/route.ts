export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { buildPadelAnalytics } from "@/domain/padel/analytics";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      organizationId: true,
      startsAt: true,
      endsAt: true,
      padelTournamentConfig: {
        select: {
          numberOfCourts: true,
          padelClubId: true,
          partnerClubIds: true,
        },
      },
      timezone: true,
    },
  });
  if (!event?.organizationId) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const matches = await prisma.eventMatchSlot.findMany({
    where: { eventId },
    select: {
      id: true,
      categoryId: true,
      courtId: true,
      plannedStartAt: true,
      startTime: true,
      plannedDurationMinutes: true,
      actualStartAt: true,
      actualEndAt: true,
      plannedEndAt: true,
      roundType: true,
      roundLabel: true,
    },
  });

  const clubIds = [
    event.padelTournamentConfig?.padelClubId,
    ...(event.padelTournamentConfig?.partnerClubIds ?? []),
  ].filter((id): id is number => Number.isFinite(id as number));
  const courts = clubIds.length
    ? await prisma.padelClubCourt.findMany({
        where: { padelClubId: { in: clubIds }, isActive: true },
        select: { id: true, name: true, padelClubId: true },
        orderBy: [{ padelClubId: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
      })
    : [];

  const sales = await prisma.saleSummary.aggregate({
    where: { eventId, status: "PAID" },
    _sum: {
      totalCents: true,
      platformFeeCents: true,
      netCents: true,
      stripeFeeCents: true,
    },
  });

  const categoryLinks = await prisma.padelEventCategoryLink.findMany({
    where: { eventId },
    select: {
      padelCategoryId: true,
      format: true,
      category: { select: { label: true } },
    },
  });
  const categoryMap = new Map(
    categoryLinks.map((link) => [
      link.padelCategoryId,
      { label: link.category?.label ?? null, format: link.format ?? null },
    ]),
  );

  const saleLines = await prisma.saleLine.findMany({
    where: { eventId, saleSummary: { status: "PAID" } },
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
  });

  const analytics = buildPadelAnalytics({
    event: {
      startsAt: event.startsAt ?? null,
      endsAt: event.endsAt ?? null,
      timezone: event.timezone ?? null,
    },
    matches,
    courts: courts.map((court) => ({ id: court.id, name: court.name ?? null })),
    courtCountFallback:
      event.padelTournamentConfig?.numberOfCourts && event.padelTournamentConfig.numberOfCourts > 0
        ? event.padelTournamentConfig.numberOfCourts
        : 0,
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

  return jsonWrap(
    {
      ok: true,
      ...analytics,
    },
    { status: 200 },
  );
}
export const GET = withApiEnvelope(_GET);
