import {
  notifyDeadlineExpired,
  notifyOffsessionActionRequired,
  notifyPairingInvite,
  notifyPairingInviteSent,
  notifyPairingReminder,
  notifyPartnerPaid,
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

export async function queueDeadlineExpired(pairingId: number, userIds: string[]) {
  await Promise.all(userIds.map((userId) => notifyDeadlineExpired({ pairingId, userId })));
}

export async function queueOffsessionActionRequired(pairingId: number, userIds: string[]) {
  await Promise.all(userIds.map((userId) => notifyOffsessionActionRequired({ pairingId, userId })));
}
