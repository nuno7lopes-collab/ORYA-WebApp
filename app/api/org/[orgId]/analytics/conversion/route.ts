import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule, PaymentStatus, SourceType } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const CHECKOUT_SOURCE_TYPES: SourceType[] = [
  SourceType.TICKET_ORDER,
  SourceType.PADEL_REGISTRATION,
  SourceType.BOOKING,
];

const SUCCESS_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCEEDED,
  PaymentStatus.PARTIAL_REFUND,
  PaymentStatus.REFUNDED,
  PaymentStatus.DISPUTED,
  PaymentStatus.CHARGEBACK_WON,
  PaymentStatus.CHARGEBACK_LOST,
];

function parseRange(range: string | null) {
  const now = new Date();
  if (!range || range === "30d") {
    return { range: "30d", from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
  }
  if (range === "7d") {
    return { range: "7d", from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
  }
  if (range === "90d") {
    return { range: "90d", from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), to: now };
  }
  if (range === "all") {
    return { range: "all", from: null as Date | null, to: null as Date | null };
  }
  return { range: "30d", from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
}

function toBps(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000);
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
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
      return jsonWrap({ ok: false, error: "NO_ANALYTICS_ACCESS" }, { status: 403 });
    }

    const url = new URL(req.url);
    const { range, from, to } = parseRange(url.searchParams.get("range"));

    const baseWhere = {
      organizationId: organization.id,
      sourceType: { in: CHECKOUT_SOURCE_TYPES },
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [startedCount, succeededCount, startedBreakdown, succeededBreakdown] = await Promise.all([
      prisma.payment.count({ where: baseWhere }),
      prisma.payment.count({ where: { ...baseWhere, status: { in: SUCCESS_PAYMENT_STATUSES } } }),
      prisma.payment.groupBy({
        by: ["sourceType"],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by: ["sourceType"],
        where: { ...baseWhere, status: { in: SUCCESS_PAYMENT_STATUSES } },
        _count: { _all: true },
      }),
    ]);

    const startedBySource = new Map<string, number>();
    const succeededBySource = new Map<string, number>();

    for (const row of startedBreakdown) {
      startedBySource.set(row.sourceType, row._count._all ?? 0);
    }
    for (const row of succeededBreakdown) {
      succeededBySource.set(row.sourceType, row._count._all ?? 0);
    }

    const sourceTypes = new Set<string>([
      ...Array.from(startedBySource.keys()),
      ...Array.from(succeededBySource.keys()),
    ]);

    const breakdown = Array.from(sourceTypes)
      .sort((a, b) => a.localeCompare(b))
      .map((sourceType) => {
        const started = startedBySource.get(sourceType) ?? 0;
        const succeeded = succeededBySource.get(sourceType) ?? 0;
        return {
          sourceType,
          startedCount: started,
          succeededCount: succeeded,
          conversionRateBps: toBps(succeeded, started),
        };
      });

    const conversionRateBps = toBps(succeededCount, startedCount);

    return jsonWrap(
      {
        ok: true,
        range,
        startedCount,
        succeededCount,
        conversionRateBps,
        conversionRatePct: conversionRateBps / 100,
        breakdown,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[analytics/conversion] erro inesperado", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
