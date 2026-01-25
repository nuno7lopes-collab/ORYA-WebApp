// app/api/organizacao/estatisticas/time-series/route.ts
// @deprecated Slice 5 cleanup: legacy summaries endpoint (v7 uses ledger).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { Prisma, SaleSummaryStatus } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { isOrgAdminOrAbove } from "@/lib/organizationPermissions";
import { ACTIVE_PAIRING_REGISTRATION_WHERE } from "@/domain/padelRegistration";
const LEGACY_STATS_DISABLED = true;

function parseRangeParams(url: URL) {
  const range = url.searchParams.get("range");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  let from: Date | null = null;
  let to: Date | null = null;

  if (fromParam || toParam) {
    if (fromParam) {
      const d = new Date(fromParam);
      if (!Number.isNaN(d.getTime())) from = d;
    }
    if (toParam) {
      const d = new Date(toParam);
      if (!Number.isNaN(d.getTime())) to = d;
    }
  } else if (range) {
    const now = new Date();
    to = now;
    const base = new Date(now);

    switch (range) {
      case "7d": {
        base.setDate(base.getDate() - 7);
        from = base;
        break;
      }
      case "30d": {
        base.setDate(base.getDate() - 30);
        from = base;
        break;
      }
      case "90d": {
        base.setDate(base.getDate() - 90);
        from = base;
        break;
      }
      default:
        // "all" ou desconhecido -> deixamos from = null (sem limite inferior)
        from = null;
    }
  }

  return { from, to };
}

function formatDayKey(date: Date) {
  // YYYY-MM-DD
  return date.toISOString().slice(0, 10);
}

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
      console.error(
        "[organização/time-series] Erro ao obter utilizador:",
        authError
      );
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const eventIdParam = url.searchParams.get("eventId");
    const { from, to } = parseRangeParams(url);
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

    let eventId: number | null = null;
    if (eventIdParam) {
      const parsed = Number(eventIdParam);
      if (Number.isNaN(parsed)) {
        return NextResponse.json(
          { ok: false, error: "INVALID_EVENT_ID" },
          { status: 400 }
        );
      }
      eventId = parsed;
    }

    // 1) Garantir que o user é um organização ativo com permissões de gestão
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organization || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
    }

    // 2) Preferir fonte de verdade: legacy summaries (desativado no v7)
    const createdAtFilter: Prisma.DateTimeFilter<"SaleSummary"> = {};
    if (from) createdAtFilter.gte = from;
    if (to) createdAtFilter.lte = to;

    const saleSummaries = await prisma.saleSummary.findMany({
      where: {
        ...(Object.keys(createdAtFilter).length > 0
          ? { createdAt: createdAtFilter }
          : {}),
        status: SaleSummaryStatus.PAID,
        event: {
          organizationId: organization.id,
          ...eventTemplateFilter,
        },
        eventId: eventId ?? undefined,
      },
      select: {
        createdAt: true,
        netCents: true,
        subtotalCents: true,
        discountCents: true,
        platformFeeCents: true,
        currency: true,
        lines: {
          select: {
            quantity: true,
          },
        },
      },
    });

    type DayBucket = {
      date: string; // YYYY-MM-DD
      tickets: number;
      revenueCents: number;
      grossCents: number;
      discountCents: number;
      platformFeeCents: number;
      currency: string | null;
    };

    const buckets: Record<string, DayBucket> = {};

    for (const s of saleSummaries) {
      const key = formatDayKey(s.createdAt);
      if (!buckets[key]) {
        buckets[key] = {
          date: key,
          tickets: 0,
          revenueCents: 0,
          grossCents: 0,
          discountCents: 0,
          platformFeeCents: 0,
          currency: s.currency ?? null,
        };
      }
      if (!isPadelScope) {
        const qty = s.lines.reduce((acc, l) => acc + (l.quantity ?? 0), 0);
        buckets[key].tickets += qty;
      }
      buckets[key].revenueCents += s.netCents ?? 0;
      buckets[key].grossCents += s.subtotalCents ?? 0;
      buckets[key].discountCents += s.discountCents ?? 0;
      buckets[key].platformFeeCents += s.platformFeeCents ?? 0;
    }

    if (isPadelScope) {
      const pairingCreatedFilter: Prisma.DateTimeFilter<"PadelPairing"> = {};
      if (from) pairingCreatedFilter.gte = from;
      if (to) pairingCreatedFilter.lte = to;
      const pairings = await prisma.padelPairing.findMany({
        where: {
          pairingStatus: { not: "CANCELLED" },
          ...ACTIVE_PAIRING_REGISTRATION_WHERE,
          ...(Object.keys(pairingCreatedFilter).length > 0
            ? { createdAt: pairingCreatedFilter }
            : {}),
          ...(eventId ? { eventId } : {}),
          event: {
            organizationId: organization.id,
            ...eventTemplateFilter,
          },
        },
        select: { createdAt: true },
      });
      pairings.forEach((pairing) => {
        const key = formatDayKey(pairing.createdAt);
        if (!buckets[key]) {
          buckets[key] = {
            date: key,
            tickets: 0,
            revenueCents: 0,
            grossCents: 0,
            discountCents: 0,
            platformFeeCents: 0,
            currency: null,
          };
        }
        buckets[key].tickets += 1;
      });
    }

    const points = Object.values(buckets).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json(
      {
        ok: true,
        range: {
          from: from ? from.toISOString() : null,
          to: to ? to.toISOString() : null,
        },
        points: points.map((p) => ({
          ...p,
          netCents: p.revenueCents,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[organização/time-series] Erro interno ao gerar série temporal:",
      error
    );
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
