export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PadelPairingPaymentStatus, PadelPairingSlotStatus, PadelPaymentMode } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { buildPadelEventSnapshot } from "@/lib/padel/eventSnapshot";

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

// Claim endpoint para convites (Padel v2).
export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const token = params?.token;
  if (!token) return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });

  const pairing = await prisma.padelPairing.findFirst({
    where: { inviteToken: token },
    select: {
      id: true,
      pairingStatus: true,
      inviteExpiresAt: true,
      lockedUntil: true,
      paymentMode: true,
      eventId: true,
      organizerId: true,
    },
  });

  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (pairing.inviteExpiresAt && pairing.inviteExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "INVITE_EXPIRED" }, { status: 410 });
  }

  const ticketTypes = await prisma.ticketType.findMany({
    where: { eventId: pairing.eventId, status: "ON_SALE" },
    select: { id: true, name: true, price: true, currency: true },
    orderBy: { price: "asc" },
  });

  const padelEvent = await buildPadelEventSnapshot(pairing.eventId);

  return NextResponse.json(
    { ok: true, pairing, ticketTypes, organizerId: pairing.organizerId, status: "PREVIEW_ONLY", padelEvent },
    { status: 200 },
  );
}

export async function POST(_: NextRequest, { params }: { params: { token: string } }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const token = params?.token;
  if (!token) return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });

  const pairing = await prisma.padelPairing.findFirst({
    where: { inviteToken: token },
    include: { slots: true },
  });

  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.inviteExpiresAt && pairing.inviteExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "INVITE_EXPIRED" }, { status: 410 });
  }
  if (pairing.pairingStatus === "CANCELLED") {
    return NextResponse.json({ ok: false, error: "PAIRING_CANCELLED" }, { status: 400 });
  }

  const pendingSlot = pairing.slots.find((s) => s.slotStatus === "PENDING");
  if (!pendingSlot) {
    return NextResponse.json({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
  }

  // SPLIT sem pagamento do parceiro: devolve ação para checkout
  if (pairing.paymentMode === PadelPaymentMode.SPLIT && pendingSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
    return NextResponse.json({ ok: false, error: "PAYMENT_REQUIRED", action: "CHECKOUT_PARTNER" }, { status: 402 });
  }

  try {
    const playerProfileId = await ensurePlayerProfile({ organizerId: pairing.organizerId, userId: user.id });
    const updated = await prisma.$transaction(async (tx) => {
      // Se já tem ticket, validar apropriação
      if (pendingSlot.ticketId) {
        const ticket = await tx.ticket.findUnique({ where: { id: pendingSlot.ticketId } });
        if (!ticket) throw new Error("TICKET_NOT_FOUND");
        if (ticket.userId && ticket.userId !== user.id) throw new Error("TICKET_ALREADY_CLAIMED");

        await tx.ticket.update({
          where: { id: pendingSlot.ticketId },
          data: { userId: user.id },
        });
      }

      const updatedPairing = await tx.padelPairing.update({
        where: { id: pairing.id },
        data: {
          slots: {
            update: {
              where: { id: pendingSlot.id },
              data: {
                profileId: user.id,
                playerProfileId,
                slotStatus: PadelPairingSlotStatus.FILLED,
                paymentStatus:
                  pendingSlot.paymentStatus === "PAID"
                    ? pendingSlot.paymentStatus
                    : PadelPairingPaymentStatus.PAID,
              },
            },
          },
        },
        include: { slots: true },
      });

      const stillPending = updatedPairing.slots.some((s) => s.slotStatus === "PENDING");
      if (!stillPending && updatedPairing.pairingStatus !== "COMPLETE") {
        return tx.padelPairing.update({
          where: { id: pairing.id },
          data: { pairingStatus: "COMPLETE" },
          include: { slots: true },
        });
      }

      return updatedPairing;
    });

    return NextResponse.json({ ok: true, pairing: updated }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "TICKET_ALREADY_CLAIMED") {
      return NextResponse.json({ ok: false, error: "TICKET_ALREADY_CLAIMED" }, { status: 409 });
    }
    console.error("[padel/pairings][claim][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
