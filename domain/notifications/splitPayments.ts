import {
  notifyDeadlineExpired,
  notifyPairingConfirmed,
  notifyOffsessionActionRequired,
  notifyPairingInvite,
  notifyPairingInviteSent,
  notifyPairingReminder,
  notifyPairingRefund,
  notifyPairingWindowOpen,
  notifyPartnerPaid,
  notifyWaitlistJoined,
  notifyWaitlistPromoted,
} from "@/domain/notifications/producer";

export async function queuePairingInvite(params: {
  pairingId: number;
  tournamentId?: number;
  targetUserId: string;
  inviterUserId?: string;
  token?: string;
}) {
  await notifyPairingInvite(params);
  if (params.inviterUserId) {
    await notifyPairingInviteSent({
      pairingId: params.pairingId,
      targetUserId: params.targetUserId,
      inviterUserId: params.inviterUserId,
      token: params.token,
    });
  }
}

export async function queuePairingReminder(
  pairingId: number,
  targetUserId: string,
  params?: { stage?: string | null; deadlineAt?: string | null },
) {
  return notifyPairingReminder({
    pairingId,
    targetUserId,
    stage: params?.stage ?? null,
    deadlineAt: params?.deadlineAt ?? null,
  });
}

export async function queuePartnerPaid(pairingId: number, captainUserId: string, partnerUserId?: string) {
  return notifyPartnerPaid({ pairingId, captainUserId, partnerUserId });
}

export async function queuePairingWindowOpen(pairingId: number, userIds: string[], deadlineAt?: string | null) {
  await Promise.all(
    userIds.map((userId) =>
      notifyPairingWindowOpen({ pairingId, userId, deadlineAt: deadlineAt ?? null }),
    ),
  );
}

export async function queuePairingConfirmed(pairingId: number, userIds: string[]) {
  await Promise.all(userIds.map((userId) => notifyPairingConfirmed({ pairingId, userId })));
}

export async function queuePairingRefund(
  pairingId: number,
  userIds: string[],
  params?: { refundBaseCents?: number | null; currency?: string | null },
) {
  await Promise.all(
    userIds.map((userId) =>
      notifyPairingRefund({
        pairingId,
        userId,
        refundBaseCents: params?.refundBaseCents ?? null,
        currency: params?.currency ?? null,
      }),
    ),
  );
}

export async function queueDeadlineExpired(pairingId: number, userIds: string[]) {
  await Promise.all(userIds.map((userId) => notifyDeadlineExpired({ pairingId, userId })));
}

export async function queueOffsessionActionRequired(pairingId: number, userIds: string[]) {
  await Promise.all(userIds.map((userId) => notifyOffsessionActionRequired({ pairingId, userId })));
}

export async function queueWaitlistJoined(params: {
  userId: string;
  eventId?: number | null;
  pairingId?: number | null;
  categoryId?: number | null;
}) {
  return notifyWaitlistJoined(params);
}

export async function queueWaitlistPromoted(params: {
  userId: string;
  eventId?: number | null;
  pairingId?: number | null;
  categoryId?: number | null;
}) {
  return notifyWaitlistPromoted(params);
}
