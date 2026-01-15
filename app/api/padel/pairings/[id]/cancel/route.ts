export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PadelPairingPaymentStatus, PadelPairingStatus, PadelPairingSlotStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { cancelActiveHold } from "@/domain/padelPairingHold";
import { promoteNextPadelWaitlistEntry } from "@/domain/padelWaitlist";
import { checkPadelRegistrationWindow } from "@/domain/padelRegistration";
import { readNumericParam } from "@/lib/routeParams";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

// Cancela pairing Padel v2 (MVP: estados DB; refund efetivo fica para o checkout/refund handler).
// Regras: capitão (created_by_user_id) ou staff OWNER/ADMIN do organization.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: {
      event: { select: { organizationId: true } },
      slots: true,
    },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (pairing.pairingStatus === PadelPairingStatus.CANCELLED) {
    return NextResponse.json({ ok: true, pairing }, { status: 200 });
  }

  // Capitão (created_by_user_id) ou staff OWNER/ADMIN
  const isCaptain = pairing.createdByUserId === user.id;
  let isStaff = false;
  if (!isCaptain) {
    const staff = await prisma.organizationMember.findFirst({
      where: {
        organizationId: pairing.organizationId,
        userId: user.id,
        role: { in: ["OWNER", "CO_OWNER", "ADMIN"] },
      },
      select: { id: true },
    });
    isStaff = Boolean(staff);
  }
  if (!isCaptain && !isStaff) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
  if (
    pairing.payment_mode === "SPLIT" &&
    partnerSlot?.paymentStatus === PadelPairingPaymentStatus.PAID
  ) {
    return NextResponse.json({ ok: false, error: "PARTNER_LOCKED" }, { status: 409 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Marca slots como cancelados
      await tx.padelPairingSlot.updateMany({
        where: { pairingId },
        data: {
          slotStatus: PadelPairingSlotStatus.CANCELLED,
        },
      });

      // Marca pairing cancelado e remove token para impedir novos claims
      const updatedPairing = await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          pairingStatus: PadelPairingStatus.CANCELLED,
          partnerInviteToken: null,
          partnerInviteUsedAt: null,
          partnerLinkToken: null,
          partnerLinkExpiresAt: null,
          lockedUntil: null,
        },
        include: { slots: true },
      });

      await cancelActiveHold(tx, pairingId);

      return updatedPairing;
    });

    const config = await prisma.padelTournamentConfig.findUnique({
      where: { eventId: pairing.eventId },
      select: { advancedSettings: true, splitDeadlineHours: true },
    });
    const event = await prisma.event.findUnique({
      where: { id: pairing.eventId },
      select: { startsAt: true, status: true },
    });
    const advanced = (config?.advancedSettings || {}) as {
      waitlistEnabled?: boolean;
      registrationStartsAt?: string | null;
      registrationEndsAt?: string | null;
      maxEntriesTotal?: number | null;
      competitionState?: string | null;
    };
    if (advanced.waitlistEnabled === true && event) {
      const registrationStartsAt =
        advanced.registrationStartsAt && !Number.isNaN(new Date(advanced.registrationStartsAt).getTime())
          ? new Date(advanced.registrationStartsAt)
          : null;
      const registrationEndsAt =
        advanced.registrationEndsAt && !Number.isNaN(new Date(advanced.registrationEndsAt).getTime())
          ? new Date(advanced.registrationEndsAt)
          : null;
      const maxEntriesTotal =
        typeof advanced.maxEntriesTotal === "number" && Number.isFinite(advanced.maxEntriesTotal)
          ? Math.floor(advanced.maxEntriesTotal)
          : null;
      const registrationCheck = checkPadelRegistrationWindow({
        eventStatus: event.status,
        eventStartsAt: event.startsAt ?? null,
        registrationStartsAt,
        registrationEndsAt,
        competitionState: advanced.competitionState ?? null,
      });
      if (registrationCheck.ok) {
        await prisma.$transaction((tx) =>
          promoteNextPadelWaitlistEntry({
            tx,
            eventId: pairing.eventId,
            categoryId: pairing.categoryId ?? null,
            eventStartsAt: event.startsAt ?? null,
            splitDeadlineHours: config?.splitDeadlineHours ?? undefined,
            maxEntriesTotal,
          }),
        );
      }
    }

    await recordOrganizationAuditSafe({
      organizationId: pairing.organizationId,
      actorUserId: user.id,
      action: "PADEL_PAIRING_CANCELLED",
      metadata: {
        pairingId: pairing.id,
        eventId: pairing.eventId,
        categoryId: pairing.categoryId ?? null,
      },
    });

    // Nota: refund efetivo deve ser tratado no fluxo de checkout/refund (Stripe) posterior.
    return NextResponse.json({ ok: true, pairing: updated }, { status: 200 });
  } catch (err) {
    console.error("[padel/pairings][cancel][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
