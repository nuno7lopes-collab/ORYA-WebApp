import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

type PurchaseStatus = "PAID" | "PROCESSING" | "REFUNDED" | "DISPUTED" | "FAILED";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const userId = data.user.id;

  const url = new URL(req.url);
  const includeFree = url.searchParams.get("includeFree") === "true";
  const statusFilter = url.searchParams.get("status");
  const cursorParam = url.searchParams.get("cursor");
  const cursorDate = cursorParam ? new Date(cursorParam) : null;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  // identities for owner lookup
  const identities = await prisma.emailIdentity.findMany({
    where: { userId },
    select: { id: true },
  });
  const identityIds = identities.map((i) => i.id);

  const summaries = await prisma.saleSummary.findMany({
    where: {
      OR: [
        { userId },
        { ownerUserId: userId },
        identityIds.length ? { ownerIdentityId: { in: identityIds } } : undefined,
      ].filter(Boolean) as object[],
      ...(includeFree ? {} : { totalCents: { gt: 0 } }),
      ...(cursorDate && !Number.isNaN(cursorDate.getTime()) ? { createdAt: { lt: cursorDate } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      purchaseId: true,
      paymentIntentId: true,
      totalCents: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      promoCodeSnapshot: true,
      promoLabelSnapshot: true,
      lines: {
        select: {
          id: true,
          event: { select: { title: true, slug: true } },
          ticketType: { select: { name: true } },
        },
      },
    },
  });

  const paymentIntentIds = summaries.map((s) => s.paymentIntentId).filter(Boolean);
  const purchaseIds = summaries.map((s) => s.purchaseId).filter((p): p is string => !!p);
  const paymentEvents =
    paymentIntentIds.length || purchaseIds.length
      ? await prisma.paymentEvent.findMany({
          where: {
            OR: [
              paymentIntentIds.length ? { stripePaymentIntentId: { in: paymentIntentIds } } : undefined,
              purchaseIds.length ? { purchaseId: { in: purchaseIds } } : undefined,
            ].filter(Boolean) as object[],
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            stripePaymentIntentId: true,
            purchaseId: true,
            status: true,
            createdAt: true,
            errorMessage: true,
            source: true,
          },
        })
      : [];
  const paymentEventMap = new Map<string, typeof paymentEvents>();
  paymentEvents.forEach((event) => {
    const key = event.purchaseId || event.stripePaymentIntentId;
    if (!key) return;
    const list = paymentEventMap.get(key);
    if (list) list.push(event);
    else paymentEventMap.set(key, [event]);
  });

  const items = summaries.slice(0, limit).map((s) => {
    const timelineSourceKey = s.purchaseId || s.paymentIntentId;
    const timeline =
      (timelineSourceKey ? paymentEventMap.get(timelineSourceKey) : null)?.map((e) => ({
        id: e.id,
        status: e.status,
        createdAt: e.createdAt,
        source: e.source,
        errorMessage: e.errorMessage,
      })) ?? [];
    const status: PurchaseStatus = timeline.some((t) => t.status === "DISPUTED")
      ? "DISPUTED"
      : timeline.some((t) => t.status === "REFUNDED")
        ? "REFUNDED"
        : timeline.some((t) => t.status === "ERROR" || t.status === "FAILED")
          ? "FAILED"
          : timeline.some((t) => t.status === "OK")
            ? "PAID"
            : "PROCESSING";

    const badge = s.totalCents === 0 ? "FREE" : "SINGLE";

    return {
      id: s.id,
      purchaseId: s.purchaseId,
      totalCents: s.totalCents,
      currency: s.currency,
      createdAt: s.createdAt,
      promoCode: s.promoCodeSnapshot,
      promoLabel: s.promoLabelSnapshot,
      badge,
      status,
      timeline,
      lines: s.lines.map((l) => ({
        id: l.id,
        eventTitle: l.event?.title ?? "",
        eventSlug: l.event?.slug ?? "",
        ticketTypeName: l.ticketType?.name ?? "",
      })),
    };
  });

  const nextCursor = summaries.length > limit ? summaries[limit].createdAt.toISOString() : null;

  // Optional status filtering after mapping (for simplicity)
  const filtered =
    statusFilter && ["PAID", "PROCESSING", "REFUNDED", "DISPUTED", "FAILED"].includes(statusFilter)
      ? items.filter((i) => i.status === statusFilter)
      : items;

  return NextResponse.json({ ok: true, items: filtered, nextCursor }, { status: 200 });
}
