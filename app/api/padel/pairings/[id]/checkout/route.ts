export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PadelPaymentMode, PadelPairingPaymentStatus } from "@prisma/client";
import { stripe } from "@/lib/stripeClient";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

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
    include: { slots: true, event: { select: { organizerId: true, slug: true, id: true } } },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (inviteToken && pairing.inviteToken && pairing.inviteToken !== inviteToken) {
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

  try {
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        pairingId: pairing.id,
        slotId: pending?.id ?? "",
        eventId: pairing.event.id,
        ticketTypeId,
        mode: pairing.paymentMode === PadelPaymentMode.FULL ? "PADEL_FULL" : "PADEL_SPLIT",
        userId: user.id,
      },
    });

    // Log minimal event for auditoria
    await prisma.paymentEvent.create({
      data: {
        stripePaymentIntentId: intent.id,
        status: "PROCESSING",
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
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[padel/pairings][checkout][POST]", err);
    return NextResponse.json({ ok: false, error: "INTENT_ERROR" }, { status: 500 });
  }
}
