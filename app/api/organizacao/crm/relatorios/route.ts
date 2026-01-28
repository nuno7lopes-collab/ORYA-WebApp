import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { CrmInteractionType, OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const READ_ROLES = Object.values(OrganizationMemberRole);

const CATEGORY_CONFIG = [
  {
    id: "eventos",
    label: "Eventos",
    types: [CrmInteractionType.EVENT_TICKET, CrmInteractionType.EVENT_CHECKIN],
  },
  {
    id: "reservas",
    label: "Reservas",
    types: [
      CrmInteractionType.BOOKING_CONFIRMED,
      CrmInteractionType.BOOKING_COMPLETED,
      CrmInteractionType.BOOKING_CANCELLED,
    ],
  },
  {
    id: "padel",
    label: "Padel",
    types: [CrmInteractionType.PADEL_TOURNAMENT_ENTRY, CrmInteractionType.PADEL_MATCH_PAYMENT],
  },
  {
    id: "loja",
    label: "Loja",
    types: [CrmInteractionType.STORE_ORDER_PAID, CrmInteractionType.STORE_ORDER_REFUNDED],
  },
  {
    id: "membership",
    label: "Subscricoes",
    types: [
      CrmInteractionType.MEMBERSHIP_STARTED,
      CrmInteractionType.MEMBERSHIP_RENEWED,
      CrmInteractionType.MEMBERSHIP_CANCELLED,
    ],
  },
  {
    id: "manual",
    label: "Manuais",
    types: [CrmInteractionType.MANUAL_ADJUSTMENT],
  },
] as const;

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissoes." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "VIEW",
    });
    if (!crmAccess.ok) {
      return jsonWrap({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const windowDays = 30;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const [totalCustomers, newCustomers, interactionAgg, campaignsSent] = await Promise.all([
      prisma.crmCustomer.count({ where: { organizationId: organization.id } }),
      prisma.crmCustomer.count({ where: { organizationId: organization.id, createdAt: { gte: since } } }),
      prisma.crmInteraction.groupBy({
        by: ["type"],
        where: { organizationId: organization.id, occurredAt: { gte: since } },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
      prisma.crmCampaign.count({ where: { organizationId: organization.id, sentAt: { gte: since } } }),
    ]);

    const typeMap = new Map(
      interactionAgg.map((item) => [
        item.type,
        {
          count: item._count._all,
          amountCents: item._sum.amountCents ?? 0,
        },
      ]),
    );

    const categories = CATEGORY_CONFIG.map((category) => {
      const totals = category.types.reduce(
        (acc, type) => {
          const row = typeMap.get(type);
          acc.count += row?.count ?? 0;
          acc.amountCents += row?.amountCents ?? 0;
          return acc;
        },
        { count: 0, amountCents: 0 },
      );
      return { ...category, ...totals };
    });

    const totals = categories.reduce(
      (acc, category) => {
        acc.interactions += category.count;
        acc.amountCents += category.amountCents;
        return acc;
      },
      { interactions: 0, amountCents: 0 },
    );

    return jsonWrap({
      ok: true,
      windowDays,
      totals,
      customers: {
        total: totalCustomers,
        new: newCustomers,
      },
      campaignsSent,
      categories,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/crm/relatorios error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar relatorios." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);