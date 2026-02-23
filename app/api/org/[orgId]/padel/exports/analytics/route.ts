export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import {
  buildPadelAnalyticsForEventContext,
  loadPadelAnalyticsEventContext,
} from "@/domain/padel/analyticsData";
import { Workbook } from "exceljs";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { OrganizationModule } from "@prisma/client";
import { resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const csvEscape = (value: string | number | null | undefined) => {
  const safe = String(value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
  if (!orgResolution.ok) {
    return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
  }
  const requestOrganizationId = orgResolution.organizationId;

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isInteger(eventId) || eventId <= 0) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await loadPadelAnalyticsEventContext(eventId);
  if (!event || event.organizationId !== requestOrganizationId) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: requestOrganizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId: requestOrganizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const analytics = await buildPadelAnalyticsForEventContext(event);

  const filenameBase = `padel_analytics_${event.slug || eventId}`;
  const format = (req.nextUrl.searchParams.get("format") || "csv").toLowerCase();

  if (format === "xlsx" || format === "excel") {
    const summaryRows = [
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
    ];

    const phaseRows = [
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
    ];

    const courtDayRows = [
      ["date", "court", "matches", "minutes", "occupancy_pct", "window_minutes"],
      ...analytics.courtDayBreakdown.map((row) => [
        row.date,
        row.courtName || row.courtId,
        row.matches,
        row.minutes,
        row.occupancy,
        row.windowMinutes,
      ]),
    ];

    const paymentsCategoryRows = [
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
    ];

    const paymentsPhaseRows = [
      ["phase", "label", "total_cents", "net_cents", "platform_fee_cents", "stripe_fee_cents"],
      ...analytics.paymentsByPhase.map((row) => [
        row.phase,
        row.label,
        row.totalCents,
        row.netCents,
        row.platformFeeCents,
        row.stripeFeeCents,
      ]),
    ];

    const workbook = new Workbook();
    const summarySheet = workbook.addWorksheet("Resumo");
    summaryRows.forEach((row) => summarySheet.addRow(row));

    const phaseSheet = workbook.addWorksheet("Fases");
    phaseRows.forEach((row) => phaseSheet.addRow(row));

    const courtDaySheet = workbook.addWorksheet("Courts_Dia");
    courtDayRows.forEach((row) => courtDaySheet.addRow(row));

    const paymentsCategorySheet = workbook.addWorksheet("Receitas_Categorias");
    paymentsCategoryRows.forEach((row) => paymentsCategorySheet.addRow(row));

    const paymentsPhaseSheet = workbook.addWorksheet("Receitas_Fases");
    paymentsPhaseRows.forEach((row) => paymentsPhaseSheet.addRow(row));

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
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
