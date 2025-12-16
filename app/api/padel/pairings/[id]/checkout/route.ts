export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  Gender,
  PadelEligibilityType,
  PadelPaymentMode,
  PadelPairingPaymentStatus,
  PaymentEventSource,
} from "@prisma/client";
import { stripe } from "@/lib/stripeClient";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import {
  checkoutMetadataSchema,
  createPurchaseId,
  normalizeItemsForMetadata,
} from "@/lib/checkoutSchemas";
import { validateEligibility } from "@/domain/padelEligibility";
import { resolveOwner } from "@/lib/ownership/resolveOwner";
import { queuePartnerPaid } from "@/domain/notifications/splitPayments";

async function ensurePlayerProfile(params: { organizerId: number; userId: string }) {
  const { organizerId, userId } = params;
  const existing = await prisma.padelPlayerProfile.findFirst({
    where: { organizerId, userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true, email: true } });
  const name = profile?.fullName?.trim() || "Jogador Padel";
  const email = profile?.email || null;
  const created = await prisma.padelPlayerProfile.create({
    data: {
      organizerId,
      userId,
      fullName: name,
      displayName: name,
      email: email ?? undefined,
    },
    select: { id: true },
  });
  return created.id;
}
// Cria PaymentIntent para SPLIT (share) ou FULL (dupla inteira).
// Requer ticketTypeId explícito para definir preço/currency (evita suposições).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pairingId = Number(params?.id);
  if (!Number.isFinite(pairingId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ticketTypeId = body && typeof body.ticketTypeId === "number" ? body.ticketTypeId : null;
  const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken : null;
  if (!ticketTypeId) return NextResponse.json({ ok: false, error: "MISSING_TICKET_TYPE" }, { status: 400 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: {
      slots: true,
      event: { select: { organizerId: true, slug: true, id: true } },
    },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (inviteToken && pairing.partnerInviteToken && pairing.partnerInviteToken !== inviteToken) {
    return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 403 });
  }
  if (pairing.pairingStatus === "CANCELLED") {
    return NextResponse.json({ ok: false, error: "PAIRING_CANCELLED" }, { status: 400 });
  }

  const pending =
    pairing.paymentMode === PadelPaymentMode.SPLIT
      ? pairing.slots.find((s) => s.slotStatus === "PENDING")
      : null;
  if (pairing.paymentMode === PadelPaymentMode.SPLIT) {
    if (!pending) {
      return NextResponse.json({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
    }
    if (pending.paymentStatus === PadelPairingPaymentStatus.PAID) {
      return NextResponse.json({ ok: false, error: "SLOT_ALREADY_PAID" }, { status: 400 });
    }
  }
  if (pairing.deadlineAt && pairing.deadlineAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "PAIRING_EXPIRED" }, { status: 410 });
  }

  // Apenas capitão pode iniciar checkout se for "assume resto"; parceiro também pode iniciar, mas validamos que não há ticket já atribuído
  const isCaptain = pairing.createdByUserId === user.id;
  const isPendingOwner = !pending.profileId || pending.profileId === user.id;
  if (!isCaptain && !isPendingOwner) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { price: true, currency: true, eventId: true },
  });
  if (!ticketType || ticketType.eventId !== pairing.eventId) {
    return NextResponse.json({ ok: false, error: "INVALID_TICKET_TYPE" }, { status: 400 });
  }

  // Elegibilidade: garantir que capitão + parceiro (quando definido) respeitam regras
  const tournamentConfig = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: pairing.event.id },
    select: { eligibilityType: true },
  });
  const [captainProfile, partnerProfile] = await Promise.all([
    pairing.player1UserId
      ? prisma.profile.findUnique({ where: { id: pairing.player1UserId }, select: { gender: true } })
      : Promise.resolve(null),
    prisma.profile.findUnique({ where: { id: user.id }, select: { gender: true } }),
  ]);
  const eligibility = validateEligibility(
    (tournamentConfig?.eligibilityType as PadelEligibilityType) ?? PadelEligibilityType.OPEN,
    (captainProfile?.gender as Gender | null) ?? null,
    partnerProfile?.gender as Gender | null,
  );
  if (!eligibility.ok) {
    return NextResponse.json(
      { ok: false, error: eligibility.code },
      { status: eligibility.code === "GENDER_REQUIRED_FOR_TOURNAMENT" ? 403 : 409 },
    );
  }

  // Não permitir checkout se utilizador já tiver pairing ativo no torneio
  const existingActive = await prisma.padelPairing.findFirst({
    where: {
      eventId: pairing.event.id,
      lifecycleStatus: { not: "CANCELLED_INCOMPLETE" },
      OR: [{ player1UserId: user.id }, { player2UserId: user.id }],
      NOT: { id: pairing.id },
    },
    select: { id: true },
  });
  if (existingActive) {
    return NextResponse.json({ ok: false, error: "PAIRING_ALREADY_ACTIVE" }, { status: 409 });
  }

  // Garantir playerProfile ligado ao slot pendente
  if (pending) {
    const playerProfileId = await ensurePlayerProfile({ organizerId: pairing.event.organizerId!, userId: user.id });
    if (!pending.playerProfileId || pending.profileId === user.id || !pending.profileId) {
      await prisma.padelPairingSlot.update({
        where: { id: pending.id },
        data: {
          playerProfileId,
          profileId: user.id,
        },
      });
    }
  }

  const amount = pairing.paymentMode === PadelPaymentMode.FULL ? ticketType.price * 2 : ticketType.price;
  const currency = ticketType.currency || "EUR";
  const paymentScenario = pairing.paymentMode === PadelPaymentMode.FULL ? "GROUP_FULL" : "GROUP_SPLIT";
  const items = [
    {
      ticketTypeId,
      quantity: pairing.paymentMode === PadelPaymentMode.FULL ? 2 : 1,
      unitPriceCents: ticketType.price,
      currency: currency.toUpperCase(),
    },
  ];
  const purchaseId = createPurchaseId();
  const normalizedItems = normalizeItemsForMetadata(items);
  const ownerResolved = await resolveOwner({ sessionUserId: user.id, guestEmail: null });
  const metadataValidation = checkoutMetadataSchema.safeParse({
    paymentScenario,
    purchaseId,
    items: normalizedItems,
    eventId: pairing.event.id,
    eventSlug: pairing.event.slug ?? undefined,
    pairingId: pairing.id,
    owner: {
      ownerUserId: ownerResolved.ownerUserId ?? user.id,
      ownerIdentityId: ownerResolved.ownerIdentityId ?? undefined,
      emailNormalized: ownerResolved.emailNormalized ?? undefined,
    },
  });
  if (!metadataValidation.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_METADATA", details: metadataValidation.error.format() },
      { status: 400 },
    );
  }

  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        pairingId: pairing.id,
        slotId: pending?.id ?? "",
        eventId: pairing.event.id,
        eventSlug: pairing.event.slug ?? "",
        ticketTypeId,
        paymentScenario,
        purchaseId,
        items: JSON.stringify(normalizedItems),
        userId: user.id,
        ownerUserId: ownerResolved.ownerUserId ?? user.id,
        ownerIdentityId: ownerResolved.ownerIdentityId ?? "",
        emailNormalized: ownerResolved.emailNormalized ?? "",
      },
    });

    // Log minimal event for auditoria
    await prisma.paymentEvent.create({
      data: {
        stripePaymentIntentId: intent.id,
        purchaseId,
        status: "PROCESSING",
        source: PaymentEventSource.API,
        dedupeKey: purchaseId,
        attempt: 1,
        eventId: pairing.event.id,
        userId: user.id,
        amountCents: amount,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        purchaseId,
        paymentScenario,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[padel/pairings][checkout][POST]", err);
    return NextResponse.json({ ok: false, error: "INTENT_ERROR" }, { status: 500 });
  }
}
