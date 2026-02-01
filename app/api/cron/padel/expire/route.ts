export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { PadelPairingStatus, PadelRegistrationStatus } from "@prisma/client";
import { expireHolds } from "@/domain/padelPairingHold";
import { INACTIVE_REGISTRATION_STATUSES, transitionPadelRegistrationStatus } from "@/domain/padelRegistration";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";

// Expira pairings SPLIT em T-24h e garante 2ª cobrança / refunds via outbox.
// Pode ser executado via cron. Não expõe dados sensíveis, mas requer permissão server-side.
async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const now = new Date();
    await expireHolds(prisma, now);

    // Expira inscrições sem parceiro (PENDING_PARTNER / MATCHMAKING) ao passar T-24h
    const overduePartners = await prisma.padelPairing.findMany({
      where: {
        deadlineAt: { lt: now },
        payment_mode: "SPLIT",
        registration: { status: { in: [PadelRegistrationStatus.PENDING_PARTNER, PadelRegistrationStatus.MATCHMAKING] } },
      },
      select: { id: true },
    });

    for (const pairing of overduePartners) {
      await prisma.$transaction((tx) =>
        transitionPadelRegistrationStatus(tx, {
          pairingId: pairing.id,
          status: PadelRegistrationStatus.EXPIRED,
          reason: "DEADLINE_EXPIRED",
        }),
      );
    }

    // Emite outbox para segunda cobrança quando a janela expira (T-24h)
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
      select: { id: true },
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
          reason: "LOCK_EXPIRED",
        }),
      );
      processed += 1;
    }

    await recordCronHeartbeat("padel-expire", { status: "SUCCESS", startedAt });
    return jsonWrap({ ok: true, processed, now: now.toISOString() });
  } catch (err) {
    await recordCronHeartbeat("padel-expire", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
