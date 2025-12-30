import {
  notifyDeadlineExpired,
  notifyOffsessionActionRequired,
  notifyPairingInvite,
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
  return notifyPairingInvite(params);
}

export async function queuePairingReminder(pairingId: number, targetUserId: string) {
  return notifyPairingReminder({ pairingId, targetUserId });
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
