export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPaymentMode,
  PadelRegistrationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { clampDeadlineHours, computeSplitDeadlineAt } from "@/domain/padelDeadlines";
import { INACTIVE_REGISTRATION_STATUSES, mapRegistrationToPairingLifecycle, upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";
import { readNumericParam } from "@/lib/routeParams";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";

// Regulariza uma dupla cancelada por falha de pagamento (SPLIT).
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) {
    return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: {
      slots: true,
      registration: { select: { status: true } },
      event: {
        select: {
          organizationId: true,
          startsAt: true,
          padelTournamentConfig: { select: { splitDeadlineHours: true } },
        },
      },
    },
  });
  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.payment_mode !== PadelPaymentMode.SPLIT) {
    return jsonWrap({ ok: false, error: "NOT_SPLIT_MODE" }, { status: 400 });
  }

  const isCaptain = pairing.createdByUserId === user.id;
  let isStaff = false;
  if (!isCaptain) {
    const membership = await resolveGroupMemberForOrg({
      organizationId: pairing.organizationId,
      userId: user.id,
    });
    isStaff = Boolean(membership && ["OWNER", "CO_OWNER", "ADMIN"].includes(membership.role));
  }
  if (!isCaptain && !isStaff) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const isInactiveRegistration =
    pairing.registration?.status ? INACTIVE_REGISTRATION_STATUSES.includes(pairing.registration.status) : false;
  if (pairing.pairingStatus !== "CANCELLED" || !isInactiveRegistration) {
    return jsonWrap({ ok: false, error: "PAIRING_NOT_CANCELLED" }, { status: 409 });
  }
  if (!["FAILED", "EXPIRED"].includes(pairing.guaranteeStatus)) {
    return jsonWrap({ ok: false, error: "REGULARIZE_NOT_ALLOWED" }, { status: 409 });
  }

  const now = new Date();
  const deadlineAt = computeSplitDeadlineAt(
    now,
    pairing.event?.startsAt ?? null,
    clampDeadlineHours(pairing.event?.padelTournamentConfig?.splitDeadlineHours ?? undefined),
  );
  if (deadlineAt.getTime() <= now.getTime()) {
    return jsonWrap({ ok: false, error: "SPLIT_DEADLINE_PASSED" }, { status: 409 });
  }

  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
  if (!partnerSlot) {
    return jsonWrap({ ok: false, error: "NO_PARTNER_SLOT" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.padelPairingSlot.update({
      where: { id: partnerSlot.id },
      data: {
        slotStatus: PadelPairingSlotStatus.PENDING,
        paymentStatus: PadelPairingPaymentStatus.UNPAID,
        ticketId: null,
      },
    });

    const updatedPairing = await tx.padelPairing.update({
      where: { id: pairing.id },
      data: {
        pairingStatus: "INCOMPLETE",
        guaranteeStatus: "ARMED",
        deadlineAt,
        partnerSwapAllowedUntilAt: deadlineAt,
        secondChargePaymentIntentId: null,
        graceUntilAt: null,
        captainSecondChargedAt: null,
      },
      include: { slots: true },
    });
    await upsertPadelRegistrationForPairing(tx, {
      pairingId: updatedPairing.id,
      organizationId: updatedPairing.organizationId,
      eventId: updatedPairing.eventId,
      status: PadelRegistrationStatus.PENDING_PAYMENT,
    });
    return updatedPairing;
  });

  const lifecycleStatus = mapRegistrationToPairingLifecycle(PadelRegistrationStatus.PENDING_PAYMENT, pairing.payment_mode);
  return jsonWrap({ ok: true, pairing: { ...updated, lifecycleStatus } }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);