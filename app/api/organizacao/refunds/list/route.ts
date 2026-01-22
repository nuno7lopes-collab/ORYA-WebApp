import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { isOrgAdminOrAbove } from "@/lib/organizationPermissions";
import type { Prisma } from "@prisma/client";
import { RefundReason } from "@prisma/client";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const url = new URL(req.url);
    const cursorRaw = url.searchParams.get("cursor");
    const cursor = cursorRaw ? Number(cursorRaw) : null;
    const q = url.searchParams.get("q")?.trim() ?? "";
    const reasonParam = url.searchParams.get("reason")?.trim().toUpperCase() ?? "";
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const fromDate = fromParam ? new Date(fromParam) : null;
    const toDate = toParam ? new Date(toParam) : null;

    const events = await prisma.event.findMany({
      where: { organizationId: organization.id },
      select: { id: true, title: true },
    });
    if (!events.length) {
      return NextResponse.json({ ok: true, items: [], pagination: { nextCursor: null, hasMore: false } }, { status: 200 });
    }
    const eventIds = events.map((event) => event.id);
    const eventById = new Map(events.map((event) => [event.id, event]));

    const where: Prisma.RefundWhereInput = {
      eventId: { in: eventIds },
    };
    const reason = (["CANCELLED", "DELETED", "DATE_CHANGED"] as string[]).includes(reasonParam)
      ? (reasonParam as RefundReason)
      : null;
    if (reason) {
      where.reason = reason;
    }
    const refundedAtFilter: Prisma.DateTimeNullableFilter = {};
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      refundedAtFilter.gte = fromDate;
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      refundedAtFilter.lte = toDate;
    }
    if (Object.keys(refundedAtFilter).length) {
      where.refundedAt = refundedAtFilter;
    }
    if (q) {
      where.OR = [
        { purchaseId: { contains: q, mode: "insensitive" } },
        { paymentIntentId: { contains: q, mode: "insensitive" } },
      ];
    }

    const items = await prisma.refund.findMany({
      where,
      orderBy: { id: "desc" },
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > PAGE_SIZE;
    const trimmed = hasMore ? items.slice(0, PAGE_SIZE) : items;
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;

    const purchaseIds = Array.from(
      new Set(trimmed.map((item) => item.purchaseId).filter((id): id is string => Boolean(id))),
    );
    const saleSummaries = purchaseIds.length
      ? await prisma.saleSummary.findMany({
          where: { purchaseId: { in: purchaseIds } },
          select: { purchaseId: true, currency: true },
        })
      : [];
    const currencyByPurchase = new Map(
      saleSummaries.map((summary) => [summary.purchaseId ?? "", summary.currency ?? "EUR"]),
    );

    const mapped = trimmed.map((refund) => {
      const event = eventById.get(refund.eventId);
      return {
        id: refund.id,
        eventId: refund.eventId,
        eventTitle: event?.title ?? "Evento",
        purchaseId: refund.purchaseId,
        paymentIntentId: refund.paymentIntentId,
        baseAmountCents: refund.baseAmountCents,
        feesExcludedCents: refund.feesExcludedCents,
        currency: refund.purchaseId ? currencyByPurchase.get(refund.purchaseId) ?? "EUR" : "EUR",
        reason: refund.reason,
        refundedAt: refund.refundedAt,
        createdAt: refund.createdAt,
      };
    });

    return NextResponse.json(
      { ok: true, items: mapped, pagination: { nextCursor, hasMore } },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizacao/refunds/list]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
