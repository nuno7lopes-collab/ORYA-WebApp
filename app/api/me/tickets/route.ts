// app/api/me/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

// DTO usado pelo frontend
export type UserTicket = {
  id: string;
  quantity: number; // sempre 1 (um registo por bilhete)
  pricePaid: number; // líquido em cêntimos
  grossCents?: number;
  discountCents?: number;
  platformFeeCents?: number;
  netCents?: number;
  currency: string; // ex: EUR
  purchasedAt: string;
  badge: "FREE" | "RESALE" | "SPLIT" | "FULL" | "SINGLE";
  nextAction: "NONE" | "PAY_PARTNER" | "CONFIRM_GUARANTEE";
  purchaseId: string | null;
  isTournament?: boolean;

  qrToken: string | null;
  resaleId?: string | null;
  resaleStatus?: string | null;
  resalePrice?: number | null;
  resaleCurrency?: string | null;

  event: {
    id: number;
    slug: string;
    title: string;
    startDate: string;
    endDate: string;
    locationName: string;
    coverImageUrl: string | null;
    resaleMode?: "ALWAYS" | "AFTER_SOLD_OUT" | "DISABLED";
    isSoldOut?: boolean;
  };

  ticket: {
    id: string;
    name: string;
    description: string | null;
  };
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
    const cursorParam = url.searchParams.get("cursor");
    const cursorDate = cursorParam ? new Date(cursorParam) : null;

    // 1) Obter utilizador autenticado via Supabase (cookies de server)
    const supabase = await createSupabaseServer();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated", tickets: [] },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    const identities = await prisma.emailIdentity.findMany({
      where: { userId },
      select: { id: true },
    });
    const identityIds = identities.map((i) => i.id);

    // 2) Buscar bilhetes desse utilizador (ou associados ao seu email identity)
    const userTickets = await prisma.ticket.findMany({
      where: {
        OR: [
          { userId },
          { ownerUserId: userId },
          identityIds.length ? { ownerIdentityId: { in: identityIds } } : undefined,
        ].filter(Boolean) as object[],
        ...(cursorDate && !Number.isNaN(cursorDate.getTime())
          ? { purchasedAt: { lt: cursorDate } }
          : {}),
      },
      orderBy: { purchasedAt: "desc" },
      take: limit + 1,
      select: {
        id: true,
        eventId: true,
        ticketTypeId: true,
        purchasedAt: true,
        pricePaid: true,
        totalPaidCents: true,
        currency: true,
        qrSecret: true,
        resalePrice: true,
        resaleCurrency: true,
        resaleMode: true,
        platformFeeCents: true,
        qrCode: true,
        stripePaymentIntentId: true,
        totalPaid: true,
        resaleId: true,
        resaleStatus: true,
        qrSecretUnprotected: true,
        resalePayoutId: true,
        padelSplitShareCents: true,
        tournamentEntryId: true,
        event: {
          include: {
            ticketTypes: true,
          },
        },
        ticketType: true,
        resales: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        pairing: {
          select: {
            payment_mode: true,
            lifecycleStatus: true,
            guaranteeStatus: true,
            deadlineAt: true,
            graceUntilAt: true,
          },
        },
      },
    });

    const hasMore = userTickets.length > limit;
    const trimmedTickets = hasMore ? userTickets.slice(0, limit) : userTickets;

    // Buscar sale_summaries/lines por PaymentIntent para preencher breakdown
  const paymentIntentIds = Array.from(
    new Set(
      trimmedTickets
        .map((t) => t.stripePaymentIntentId)
        .filter((id): id is string => Boolean(id))
    )
  );
    const saleSummaries = paymentIntentIds.length
      ? await prisma.saleSummary.findMany({
          where: { paymentIntentId: { in: paymentIntentIds } },
          select: {
            paymentIntentId: true,
            subtotalCents: true,
            discountCents: true,
            platformFeeCents: true,
            netCents: true,
            promoLabelSnapshot: true,
            promoCodeSnapshot: true,
            lines: {
              select: {
                ticketTypeId: true,
                quantity: true,
                grossCents: true,
                netCents: true,
                discountPerUnitCents: true,
                platformFeeCents: true,
              },
            },
          },
        })
      : [];
    const summaryMap = new Map<string, (typeof saleSummaries)[number]>();
    saleSummaries.forEach((s) => summaryMap.set(s.paymentIntentId, s));

    // Pré-calcular sold out por evento para suportar o modo AFTER_SOLD_OUT
    const eventSoldOutMap = new Map<number, boolean>();

    const isEventSoldOut = (
      eventId: number,
      ticketTypes: { totalQuantity: number | null | undefined; soldQuantity: number }[],
    ) => {
      if (eventSoldOutMap.has(eventId)) return eventSoldOutMap.get(eventId)!;

      const list = ticketTypes ?? [];
      const hasUnlimited = list.some(
        (tt) => tt.totalQuantity === null || tt.totalQuantity === undefined,
      );

      const soldOut =
        !hasUnlimited &&
        list.length > 0 &&
        list.every((tt) => {
          if (tt.totalQuantity === null || tt.totalQuantity === undefined)
            return false;
          return tt.soldQuantity >= tt.totalQuantity;
        });

      eventSoldOutMap.set(eventId, soldOut);
      return soldOut;
    };

    // 3) Devolver 1 registo por bilhete (sem agrupar) para não perder QR únicos
    const tickets: UserTicket[] = trimmedTickets
      .filter((t) => t.event && t.ticketType)
      .map((t) => {
        const event = t.event!;
        const ticketType = t.ticketType!;
        const resale = t.resales?.[0];
        const pairing = t.pairing ?? null;
        const resaleMode =
          (event as { resaleMode?: "ALWAYS" | "AFTER_SOLD_OUT" | "DISABLED" | null }).resaleMode ??
          "ALWAYS";
        const ticketTypesForSoldOut =
          Array.isArray(event.ticketTypes) && event.ticketTypes.length > 0
            ? event.ticketTypes.map((tt) => ({
                totalQuantity: tt.totalQuantity,
                soldQuantity: tt.soldQuantity,
              }))
            : [];
        const soldOut = isEventSoldOut(event.id, ticketTypesForSoldOut);
        let grossCents = t.pricePaid ?? 0;
        let discountCents = 0;
        let feeCents = t.platformFeeCents ?? 0;
        let netCents = t.pricePaid ?? 0;

        if (t.stripePaymentIntentId) {
          const summary = summaryMap.get(t.stripePaymentIntentId);
          if (summary) {
            const line = summary.lines.find((l) => l.ticketTypeId === t.ticketTypeId);
            if (line && (line.quantity ?? 0) > 0) {
              const qty = line.quantity || 1;
              grossCents = Math.round(line.grossCents / qty);
              netCents = Math.round(line.netCents / qty);
              feeCents = Math.round((line.platformFeeCents ?? 0) / qty);
              discountCents = line.discountPerUnitCents ?? Math.max(0, grossCents - netCents - feeCents);
            } else {
              // fallback proporcional simples: usar net/fees do summary quando não há line match
              grossCents = summary.subtotalCents;
              discountCents = summary.discountCents;
              feeCents = summary.platformFeeCents;
              netCents = summary.netCents;
            }
          }
        }
        const summaryPromo =
          (t.stripePaymentIntentId ? summaryMap.get(t.stripePaymentIntentId)?.promoLabelSnapshot : null) ??
          (t.stripePaymentIntentId ? summaryMap.get(t.stripePaymentIntentId)?.promoCodeSnapshot : null) ??
          null;
        const summaryPurchaseId =
          t.stripePaymentIntentId ? summaryMap.get(t.stripePaymentIntentId)?.paymentIntentId : null;

        let badge: UserTicket["badge"] = "SINGLE";
        if ((t.totalPaidCents ?? t.pricePaid ?? 0) === 0) badge = "FREE";
        if (resale) badge = "RESALE";
        if (pairing?.payment_mode === "SPLIT") badge = "SPLIT";
        if (pairing?.payment_mode === "FULL") badge = "FULL";

        let nextAction: UserTicket["nextAction"] = "NONE";
        if (pairing?.lifecycleStatus === "PENDING_PARTNER_PAYMENT") nextAction = "PAY_PARTNER";
        if (pairing?.guaranteeStatus === "REQUIRES_ACTION") nextAction = "CONFIRM_GUARANTEE";

        return {
          id: t.id,
          quantity: 1,
          pricePaid: t.pricePaid ?? 0,
          grossCents,
          discountCents,
          platformFeeCents: feeCents,
          netCents,
          currency: t.currency ?? "EUR",
          promoLabel: summaryPromo,
          purchasedAt: t.purchasedAt.toISOString(),
          purchaseId: summaryPurchaseId ?? t.stripePaymentIntentId ?? null,
          badge,
          nextAction,
          isTournament: Boolean((t as { tournamentEntryId?: number | null }).tournamentEntryId),
          qrToken: t.qrSecret ?? null,
          resaleId: resale?.id ?? null,
          resaleStatus: resale?.status ?? null,
          resalePrice: resale?.price ?? null,
          resaleCurrency: resale?.currency ?? null,
          event: {
            id: event.id,
            slug: event.slug,
            title: event.title,
            startDate: event.startsAt?.toISOString?.() ?? "",
            endDate: event.endsAt?.toISOString?.() ?? "",
            locationName: event.locationName ?? "",
            coverImageUrl: event.coverImageUrl ?? null,
            resaleMode,
            isSoldOut: soldOut,
          },
          ticket: {
            id: String(ticketType.id),
            name: ticketType.name ?? "Bilhete",
            description: ticketType.description ?? null,
          },
        };
      });

    return NextResponse.json(
      {
        success: true,
        tickets,
        nextCursor: hasMore ? tickets[tickets.length - 1]?.purchasedAt ?? null : null,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/me/tickets] Erro inesperado:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao carregar bilhetes do utilizador.",
        tickets: [],
      },
      { status: 500 }
    );
  }
}
