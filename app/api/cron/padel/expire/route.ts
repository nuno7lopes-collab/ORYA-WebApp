export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelPairingJoinMode,
  PadelRegistrationStatus,
} from "@prisma/client";
import { expireHolds } from "@/domain/padelPairingHold";
import { INACTIVE_REGISTRATION_STATUSES, transitionPadelRegistrationStatus, upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { queueDeadlineExpired } from "@/domain/notifications/splitPayments";
import { queueImportantUpdateEmail } from "@/domain/notifications/email";

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

    // Move pairings SPLIT para matchmaking após janela de 1h (T-48 + 1h)
    const toMatchmake = await prisma.padelPairing.findMany({
      where: {
        payment_mode: "SPLIT",
        pairingStatus: { not: "CANCELLED" },
        graceUntilAt: { lt: now },
        deadlineAt: { gt: now },
        pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
        registration: { status: { in: [PadelRegistrationStatus.PENDING_PARTNER, PadelRegistrationStatus.PENDING_PAYMENT] } },
      },
      select: {
        id: true,
        organizationId: true,
        eventId: true,
        slots: {
          select: {
            id: true,
            slot_role: true,
            paymentStatus: true,
            slotStatus: true,
          },
        },
      },
      take: 500,
    });

    for (const pairing of toMatchmake) {
      const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
      if (!partnerSlot) continue;
      await prisma.$transaction(async (tx) => {
        await tx.padelPairing.update({
          where: { id: pairing.id },
          data: {
            pairingStatus: "INCOMPLETE",
            pairingJoinMode: PadelPairingJoinMode.LOOKING_FOR_PARTNER,
            isPublicOpen: true,
            player2UserId: null,
            partnerInviteToken: null,
            partnerLinkToken: null,
            partnerLinkExpiresAt: null,
            partnerInvitedAt: null,
            partnerInviteUsedAt: null,
            partnerAcceptedAt: null,
            partnerPaidAt: null,
            partnerSwapAllowedUntilAt: null,
            graceUntilAt: null,
            guaranteeStatus: "ARMED",
            slots: {
              update: {
                where: { id: partnerSlot.id },
                data: {
                  profileId: null,
                  playerProfileId: null,
                  ticketId: null,
                  invitedContact: null,
                  invitedUserId: null,
                  slotStatus: PadelPairingSlotStatus.PENDING,
                  paymentStatus: PadelPairingPaymentStatus.UNPAID,
                },
              },
            },
          },
        });
        await upsertPadelRegistrationForPairing(tx, {
          pairingId: pairing.id,
          organizationId: pairing.organizationId,
          eventId: pairing.eventId,
          status: PadelRegistrationStatus.MATCHMAKING,
          reason: "WINDOW_1H_EXPIRED",
        });
      });
    }

    // Expira inscrições sem parceiro (PENDING_PARTNER / MATCHMAKING) ao passar T-24h
    const overduePartners = await prisma.padelPairing.findMany({
      where: {
        deadlineAt: { lt: now },
        payment_mode: "SPLIT",
        pairingStatus: { not: "CANCELLED" },
        registration: {
          status: {
            in: [
              PadelRegistrationStatus.PENDING_PARTNER,
              PadelRegistrationStatus.PENDING_PAYMENT,
              PadelRegistrationStatus.MATCHMAKING,
            ],
          },
        },
      },
      select: {
        id: true,
        eventId: true,
        organizationId: true,
        player1UserId: true,
        player2UserId: true,
        event: { select: { title: true, slug: true, organizationId: true } },
        slots: { select: { profileId: true, invitedUserId: true } },
      },
    });

    for (const pairing of overduePartners) {
      await prisma.$transaction((tx) =>
        transitionPadelRegistrationStatus(tx, {
          pairingId: pairing.id,
          status: PadelRegistrationStatus.EXPIRED,
          reason: "DEADLINE_EXPIRED",
        }),
      );
      const userIds = new Set<string>();
      if (pairing.player1UserId) userIds.add(pairing.player1UserId);
      if (pairing.player2UserId) userIds.add(pairing.player2UserId);
      pairing.slots.forEach((slot) => {
        if (slot.profileId) userIds.add(slot.profileId);
        if (slot.invitedUserId) userIds.add(slot.invitedUserId);
      });
      if (userIds.size > 0) {
        await queueDeadlineExpired(pairing.id, Array.from(userIds));
        const eventTitle = pairing.event?.title?.trim() || "Torneio Padel";
        const ticketUrl = pairing.event?.slug ? `/eventos/${pairing.event.slug}` : "/eventos";
        await Promise.all(
          Array.from(userIds).map((userId) =>
            queueImportantUpdateEmail({
              dedupeKey: `email:padel:deadline-expired:${pairing.id}:${userId}`,
              userId,
              eventTitle,
              message: "O prazo da dupla expirou e a inscrição foi cancelada.",
              ticketUrl,
              correlations: {
                eventId: pairing.eventId,
                organizationId: pairing.organizationId ?? pairing.event?.organizationId ?? null,
                pairingId: pairing.id,
              },
            }),
          ),
        );
      }
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
