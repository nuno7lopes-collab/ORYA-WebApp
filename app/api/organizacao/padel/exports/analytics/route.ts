export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { buildPadelAnalytics } from "@/domain/padel/analytics";
import { utils, write } from "xlsx";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const csvEscape = (value: string | number | null | undefined) => {
  const safe = String(value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      organizationId: true,
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
  if (!event?.organizationId) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

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
      plannedEndAt: true,
      plannedDurationMinutes: true,
      actualStartAt: true,
      actualEndAt: true,
      startTime: true,
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

  const saleLines = await prisma.saleLine.findMany({
    where: { eventId, saleSummary: { status: "PAID" } },
    select: {
      grossCents: true,
      netCents: true,
      platformFeeCents: true,
      ticketType: {
        select: {
          padelEventCategoryLink: {
            select: {
              padelCategoryId: true,
              format: true,
              category: { select: { label: true } },
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
    saleLines: saleLines.map((line) => ({
      grossCents: line.grossCents ?? 0,
      netCents: line.netCents ?? 0,
      platformFeeCents: line.platformFeeCents ?? 0,
      categoryId: line.ticketType?.padelEventCategoryLink?.padelCategoryId ?? null,
      categoryLabel: line.ticketType?.padelEventCategoryLink?.category?.label ?? null,
      format: line.ticketType?.padelEventCategoryLink?.format ?? null,
    })),
  });

  const filenameBase = `padel_analytics_${event.slug || eventId}`;
  const format = (req.nextUrl.searchParams.get("format") || "csv").toLowerCase();

  if (format === "xlsx" || format === "excel") {
    const summarySheet = utils.aoa_to_sheet([
      ["metric", "value"],
      ["occupancy_pct", analytics.occupancy],
      ["avg_match_minutes", analytics.avgMatchMinutes],
      ["avg_delay_minutes", analytics.avgDelayMinutes],
      ["delayed_matches", analytics.delayedMatches],
      ["matches", analytics.matches],
      ["courts", analytics.courts],
      ["window_minutes", analytics.windowMinutes],
      ["scheduled_minutes", analytics.scheduledMinutes],
      ["payments_total_cents", analytics.payments.totalCents],
      ["payments_platform_fee_cents", analytics.payments.platformFeeCents],
      ["payments_stripe_fee_cents", analytics.payments.stripeFeeCents],
      ["payments_net_cents", analytics.payments.netCents],
    ]);

    const phaseSheet = utils.aoa_to_sheet([
      ["phase", "label", "matches", "avg_match_minutes", "avg_delay_minutes", "delayed_matches", "total_minutes"],
      ...analytics.phaseStats.map((phase) => [
        phase.phase,
        phase.label,
        phase.matches,
        phase.avgMatchMinutes,
        phase.avgDelayMinutes,
        phase.delayedMatches,
        phase.totalMinutes,
      ]),
    ]);

    const courtDaySheet = utils.aoa_to_sheet([
      ["date", "court", "matches", "minutes", "occupancy_pct", "window_minutes"],
      ...analytics.courtDayBreakdown.map((row) => [
        row.date,
        row.courtName || row.courtId,
        row.matches,
        row.minutes,
        row.occupancy,
        row.windowMinutes,
      ]),
    ]);

    const paymentsCategorySheet = utils.aoa_to_sheet([
      [
        "category",
        "format",
        "total_cents",
        "net_cents",
        "platform_fee_cents",
        "stripe_fee_cents",
      ],
      ...analytics.paymentsByCategory.map((row) => [
        row.label,
        row.format ?? "",
        row.totalCents,
        row.netCents,
        row.platformFeeCents,
        row.stripeFeeCents,
      ]),
    ]);

    const paymentsPhaseSheet = utils.aoa_to_sheet([
      ["phase", "label", "total_cents", "net_cents", "platform_fee_cents", "stripe_fee_cents"],
      ...analytics.paymentsByPhase.map((row) => [
        row.phase,
        row.label,
        row.totalCents,
        row.netCents,
        row.platformFeeCents,
        row.stripeFeeCents,
      ]),
    ]);

    const book = utils.book_new();
    utils.book_append_sheet(book, summarySheet, "Resumo");
    utils.book_append_sheet(book, phaseSheet, "Fases");
    utils.book_append_sheet(book, courtDaySheet, "Courts_Dia");
    utils.book_append_sheet(book, paymentsCategorySheet, "Receitas_Categorias");
    utils.book_append_sheet(book, paymentsPhaseSheet, "Receitas_Fases");
    const buffer = write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  const rows: Array<Array<string | number>> = [
    ["section", "key", "value"],
    ["summary", "occupancy_pct", analytics.occupancy],
    ["summary", "avg_match_minutes", analytics.avgMatchMinutes],
    ["summary", "avg_delay_minutes", analytics.avgDelayMinutes],
    ["summary", "delayed_matches", analytics.delayedMatches],
    ["summary", "matches", analytics.matches],
    ["summary", "courts", analytics.courts],
    ["summary", "window_minutes", analytics.windowMinutes],
    ["summary", "scheduled_minutes", analytics.scheduledMinutes],
    ["summary", "payments_total_cents", analytics.payments.totalCents],
    ["summary", "payments_platform_fee_cents", analytics.payments.platformFeeCents],
    ["summary", "payments_stripe_fee_cents", analytics.payments.stripeFeeCents],
    ["summary", "payments_net_cents", analytics.payments.netCents],
    [],
    ["section", "phase", "label", "matches", "avg_match_minutes", "avg_delay_minutes", "delayed_matches", "total_minutes"],
    ...analytics.phaseStats.map((phase) => [
      "phase",
      phase.phase,
      phase.label,
      phase.matches,
      phase.avgMatchMinutes,
      phase.avgDelayMinutes,
      phase.delayedMatches,
      phase.totalMinutes,
    ]),
    [],
    ["section", "date", "court", "matches", "minutes", "occupancy_pct", "window_minutes"],
    ...analytics.courtDayBreakdown.map((row) => [
      "court_day",
      row.date,
      row.courtName || row.courtId,
      row.matches,
      row.minutes,
      row.occupancy,
      row.windowMinutes,
    ]),
    [],
    ["section", "category", "format", "total_cents", "net_cents", "platform_fee_cents", "stripe_fee_cents"],
    ...analytics.paymentsByCategory.map((row) => [
      "payments_category",
      row.label,
      row.format ?? "",
      row.totalCents,
      row.netCents,
      row.platformFeeCents,
      row.stripeFeeCents,
    ]),
    [],
    ["section", "phase", "label", "total_cents", "net_cents", "platform_fee_cents", "stripe_fee_cents"],
    ...analytics.paymentsByPhase.map((row) => [
      "payments_phase",
      row.phase,
      row.label,
      row.totalCents,
      row.netCents,
      row.platformFeeCents,
      row.stripeFeeCents,
    ]),
  ];

  const csv = rows.map((line) => line.map(csvEscape).join(",")).join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
    },
  });
}
export const GET = withApiEnvelope(_GET);