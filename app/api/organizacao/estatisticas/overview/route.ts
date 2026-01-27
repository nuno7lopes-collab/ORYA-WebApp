// app/api/organizacao/estatisticas/overview/route.ts
// @deprecated Slice 5 cleanup: legacy summaries endpoint (v7 uses ledger).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { EventStatus, OrganizationModule, Prisma, SaleSummaryStatus } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { ACTIVE_PAIRING_REGISTRATION_WHERE } from "@/domain/padelRegistration";
const LEGACY_STATS_DISABLED = true;

/**
 * F6 – Estatísticas do organização (overview)
 *
 * GET /api/organizacao/estatisticas/overview
 *
 * Query params opcionais:
 *  - range: "7d" | "30d" | "all" (default: "30d")
 *
 * Devolve um resumo com:
 *  - totalTickets: nº de bilhetes vendidos no período
 *  - totalRevenueCents: soma de pricePaid no período
 *  - eventsWithSalesCount: nº de eventos com pelo menos 1 venda no período
 *  - activeEventsCount: nº de eventos publicados do organização (no geral)
 */

export async function GET(req: NextRequest) {
  if (LEGACY_STATS_DISABLED) {
    return NextResponse.json({ ok: false, error: "LEGACY_STATS_DISABLED" }, { status: 410 });
  }
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[organização/overview] Erro ao obter user:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "30d"; // 7d | 30d | all
    const templateTypeParam = url.searchParams.get("templateType");
    const templateType =
      typeof templateTypeParam === "string" && templateTypeParam.trim()
        ? templateTypeParam.trim().toUpperCase()
        : null;
    const excludeTemplateTypeParam = url.searchParams.get("excludeTemplateType");
    const excludeTemplateType =
      typeof excludeTemplateTypeParam === "string" && excludeTemplateTypeParam.trim()
        ? excludeTemplateTypeParam.trim().toUpperCase()
        : null;
    const eventTemplateFilter = templateType
      ? { templateType }
      : excludeTemplateType
        ? { NOT: { templateType: excludeTemplateType } }
        : {};
    const isPadelScope = templateType === "PADEL";

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.ANALYTICS,
      required: "VIEW",
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
    }

    // Cálculo do intervalo temporal
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    const now = new Date();

    if (range === "7d") {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      toDate = now;
    } else if (range === "30d") {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      toDate = now;
    } else {
      // "all" -> sem filtro de datas
      fromDate = undefined;
      toDate = undefined;
    }

    // Fonte preferencial: legacy summaries (desativado no v7)
    const createdAtFilter: Prisma.DateTimeFilter<"SaleSummary"> = {};
    if (fromDate) createdAtFilter.gte = fromDate;
    if (toDate) createdAtFilter.lte = toDate;

    const summaries = await prisma.saleSummary.findMany({
      where: {
        ...(Object.keys(createdAtFilter).length > 0
          ? { createdAt: createdAtFilter }
          : {}),
        status: SaleSummaryStatus.PAID,
        event: {
          organizationId: organization.id,
          ...eventTemplateFilter,
        },
      },
      select: {
        id: true,
        eventId: true,
        netCents: true,
        discountCents: true,
        platformFeeCents: true,
        subtotalCents: true,
        lines: {
          select: { quantity: true },
        },
      },
    });

    let totalTickets = summaries.reduce(
      (acc, s) => acc + s.lines.reduce((q, l) => q + (l.quantity ?? 0), 0),
      0,
    );
    const grossCents = summaries.reduce((acc, s) => acc + (s.subtotalCents ?? 0), 0);
    const discountCents = summaries.reduce((acc, s) => acc + (s.discountCents ?? 0), 0);
    const platformFeeCents = summaries.reduce(
      (acc, s) => acc + (s.platformFeeCents ?? 0),
      0,
    );
    const netRevenueCents = summaries.reduce((acc, s) => acc + (s.netCents ?? 0), 0);

    let eventsWithSalesCount = new Set(summaries.map((s) => s.eventId)).size;
    if (isPadelScope) {
      const pairingCreatedFilter: Prisma.DateTimeFilter<"PadelPairing"> = {};
      if (fromDate) pairingCreatedFilter.gte = fromDate;
      if (toDate) pairingCreatedFilter.lte = toDate;
      const pairings = await prisma.padelPairing.findMany({
        where: {
          pairingStatus: { not: "CANCELLED" },
          ...ACTIVE_PAIRING_REGISTRATION_WHERE,
          ...(Object.keys(pairingCreatedFilter).length > 0
            ? { createdAt: pairingCreatedFilter }
            : {}),
          event: {
            organizationId: organization.id,
            ...eventTemplateFilter,
          },
        },
        select: { eventId: true },
      });
      totalTickets = pairings.length;
      eventsWithSalesCount = new Set(pairings.map((pairing) => pairing.eventId)).size;
    }

    // Contar eventos publicados do organização (no geral, não só no período)
    const activeEventsCount = await prisma.event.count({
      where: {
        organizationId: organization.id,
        status: EventStatus.PUBLISHED,
        ...eventTemplateFilter,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        range,
        totalTickets,
        totalRevenueCents: netRevenueCents,
        grossCents,
        discountCents,
        platformFeeCents,
        netRevenueCents,
        eventsWithSalesCount,
        activeEventsCount,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[organização/overview] Erro inesperado:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
