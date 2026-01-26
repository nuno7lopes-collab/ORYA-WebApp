import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationModule, SaleSummaryStatus } from "@prisma/client";

const resolveOrganizationId = (req: NextRequest) => {
  const organizationId = resolveOrganizationIdFromRequest(req);
  return { organizationId };
};

async function requireOrganization(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "UNAUTHENTICATED" as const };
  }

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });
  if (!profile) return { error: "PROFILE_NOT_FOUND" as const };

  const { organizationId } = resolveOrganizationId(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationId ?? undefined,
  });

  if (!membership || !organization) {
    return { error: "ORGANIZATION_NOT_FOUND" as const };
  }

  const access = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: membership.userId,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.MARKETING,
    required: "VIEW",
  });
  if (!access.ok) {
    return { error: "ORGANIZATION_NOT_FOUND" as const };
  }

  return { organization, profile, membership };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireOrganization(req);
    if ("error" in ctx) {
      const status =
        ctx.error === "UNAUTHENTICATED" ? 401 : ctx.error === "PROFILE_NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ ok: false, error: ctx.error }, { status });
    }

    const { id } = await params;
    const promoId = Number(id);
    if (!Number.isFinite(promoId)) {
      return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
    }

    const organizationEvents = await prisma.event.findMany({
      where: { organizationId: ctx.organization.id },
      select: { id: true, title: true, slug: true },
    });
    const eventIds = organizationEvents.map((e) => e.id);

    const promo = await prisma.promoCode.findUnique({
      where: { id: promoId },
      include: {
        redemptions: {
          orderBy: { usedAt: "desc" },
          take: 25,
        },
      },
    });

    if (!promo) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    if (promo.organizationId && promo.organizationId !== ctx.organization.id) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    if (!promo.organizationId && promo.eventId) {
      if (!eventIds.includes(promo.eventId)) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    } else if (!promo.organizationId && !promo.eventId) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const purchaseIds = Array.from(
      new Set(
        promo.redemptions
          .map((redemption) => redemption.purchaseId)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
      ),
    );
    const paidPurchaseIds = new Set<string>();
    if (purchaseIds.length) {
      const paidSummaries = await prisma.saleSummary.findMany({
        where: {
          purchaseId: { in: purchaseIds },
          status: SaleSummaryStatus.PAID,
          eventId: { in: eventIds },
        },
        select: { purchaseId: true },
      });
      paidSummaries.forEach((summary) => {
        if (summary.purchaseId) paidPurchaseIds.add(summary.purchaseId);
      });
    }

    const redemptions = purchaseIds.length
      ? promo.redemptions.filter((redemption) => redemption.purchaseId && paidPurchaseIds.has(redemption.purchaseId))
      : promo.redemptions;

    // Métrica simples de novos vs recorrentes: compara a data do primeiro sale_summary do user
    const firstRedemptionPerUser = new Map<string, Date>();
    redemptions.forEach((r) => {
      if (!r.userId) return;
      const prev = firstRedemptionPerUser.get(r.userId);
      if (!prev || r.usedAt < prev) {
        firstRedemptionPerUser.set(r.userId, r.usedAt);
      }
    });
    let newUsers = 0;
    let returningUsers = 0;
    if (firstRedemptionPerUser.size > 0) {
      const firstPurchases = await prisma.saleSummary.groupBy({
        by: ["userId"],
        where: {
          userId: { in: Array.from(firstRedemptionPerUser.keys()) },
          eventId: { in: eventIds },
          status: SaleSummaryStatus.PAID,
        },
        _min: { createdAt: true },
      });
      const firstPurchaseMap = new Map<string, Date>();
      firstPurchases.forEach((row) => {
        if (row.userId && row._min.createdAt) {
          firstPurchaseMap.set(row.userId, row._min.createdAt);
        }
      });

      firstRedemptionPerUser.forEach((firstUse, uid) => {
        const firstSale = firstPurchaseMap.get(uid);
        if (!firstSale || firstSale.getTime() >= firstUse.getTime() - 1000) {
          newUsers += 1;
        } else {
          returningUsers += 1;
        }
      });
    }

    const saleLines = await prisma.saleLine.findMany({
      where: {
        eventId: { in: eventIds },
        OR: [{ promoCodeId: promo.id }, { promoCodeSnapshot: promo.code }],
        saleSummary: { status: SaleSummaryStatus.PAID },
      },
      select: {
        quantity: true,
        grossCents: true,
        discountPerUnitCents: true,
        netCents: true,
        eventId: true,
      },
    });

    const agg = saleLines.reduce(
      (acc, l) => {
        const qty = l.quantity ?? 0;
        acc.tickets += qty;
        acc.grossCents += l.grossCents ?? 0;
        acc.discountCents += (l.discountPerUnitCents ?? 0) * qty;
        acc.netCents += l.netCents ?? 0;
        return acc;
      },
      { tickets: 0, grossCents: 0, discountCents: 0, netCents: 0 },
    );

    const usersUnique = new Set<string>();
    redemptions.forEach((r) => {
      if (r.userId) usersUnique.add(r.userId);
      else if (r.guestEmail) usersUnique.add(r.guestEmail.toLowerCase());
    });

    const history = redemptions.map((r) => ({
      id: r.id,
      usedAt: r.usedAt,
      discountCents: 0,
      items: 0,
      userLabel: r.userId ? "Utilizador ORYA" : r.guestEmail || "Guest",
      event: null,
    }));

    // Top eventos por usos
    const eventUses = new Map<number, number>();
    saleLines.forEach((l) => {
      if (!l.eventId) return;
      eventUses.set(l.eventId, (eventUses.get(l.eventId) ?? 0) + (l.quantity ?? 0));
    });
    const topEvents = Array.from(eventUses.entries())
      .map(([id, uses]) => {
        const meta = organizationEvents.find((e) => e.id === id);
        return { id, title: meta?.title ?? "Evento", slug: meta?.slug ?? null, uses };
      })
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 5);

    return NextResponse.json(
      {
        ok: true,
        promo: {
          id: promo.id,
          code: promo.code,
          type: promo.type,
          value: promo.value,
          active: promo.active,
          autoApply: promo.autoApply,
          validFrom: promo.validFrom,
          validUntil: promo.validUntil,
          minQuantity: promo.minQuantity,
          minTotalCents: promo.minTotalCents,
          maxUses: promo.maxUses,
          perUserLimit: promo.perUserLimit,
          eventId: promo.eventId,
          organizationId: promo.organizationId,
          createdAt: promo.createdAt,
          updatedAt: promo.updatedAt,
        },
        stats: {
          usesTotal: redemptions.length,
          usersUnique: usersUnique.size,
          tickets: agg.tickets,
          grossCents: agg.grossCents,
          discountCents: agg.discountCents,
          netCents: agg.netCents,
          newUsers,
          returningUsers,
        },
        topEvents,
        history,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/promo/:id][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
