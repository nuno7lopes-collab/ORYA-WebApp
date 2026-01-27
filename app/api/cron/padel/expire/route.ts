export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PadelPairingStatus,
  PadelRegistrationStatus,
} from "@prisma/client";
import { expireHolds } from "@/domain/padelPairingHold";
import { INACTIVE_REGISTRATION_STATUSES, transitionPadelRegistrationStatus } from "@/domain/padelRegistration";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

// Expira pairings SPLIT com locked_until ultrapassado: cancela slots e liberta tickets sem refunds automáticos.
// Pode ser executado via cron. Não expõe dados sensíveis, mas requer permissão server-side.
export async function POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  const now = new Date();
  await expireHolds(prisma, now);

  // Emite outbox para segunda cobrança quando a janela expira
  const chargeable = await prisma.padelPairing.findMany({
    where: {
      deadlineAt: { lt: now },
      payment_mode: "SPLIT",
      registration: { status: PadelRegistrationStatus.PENDING_PAYMENT },
      guaranteeStatus: { in: ["ARMED", "SCHEDULED"] },
    },
    select: {
      id: true,
      payment_mode: true,
      registration: { select: { status: true } },
    },
  });

  for (const pairing of chargeable) {
    await prisma.$transaction((tx) =>
      transitionPadelRegistrationStatus(tx, {
        pairingId: pairing.id,
        status: pairing.registration?.status ?? PadelRegistrationStatus.PENDING_PAYMENT,
        paymentMode: pairing.payment_mode,
        emitSecondChargeDue: true,
        reason: "SECOND_CHARGE_DUE",
      }),
    );
  }

  // Se REQUIRES_ACTION e graceUntilAt já passou, cancelar pairing e libertar hold
  const toCancel = await prisma.padelPairing.findMany({
    where: {
      guaranteeStatus: "REQUIRES_ACTION",
      graceUntilAt: { lt: now },
      OR: [
        { registration: { is: null } },
        { registration: { status: { notIn: INACTIVE_REGISTRATION_STATUSES } } },
      ],
    },
    select: { id: true, eventId: true, organizationId: true },
  });
  for (const p of toCancel) {
    await prisma.$transaction((tx) =>
      transitionPadelRegistrationStatus(tx, {
        pairingId: p.id,
        status: PadelRegistrationStatus.EXPIRED,
        reason: "GRACE_EXPIRED",
      }),
    );
  }

  const expired = await prisma.padelPairing.findMany({
    where: {
      payment_mode: "SPLIT",
      pairingStatus: PadelPairingStatus.INCOMPLETE,
      lockedUntil: { lt: now },
    },
    select: { id: true },
  });

  let processed = 0;
  for (const pairing of expired) {
    await prisma.$transaction((tx) =>
      transitionPadelRegistrationStatus(tx, {
        pairingId: pairing.id,
        status: PadelRegistrationStatus.EXPIRED,
      }),
    );
    processed += 1;
  }

  return NextResponse.json({ ok: true, processed, now: now.toISOString() });
}
