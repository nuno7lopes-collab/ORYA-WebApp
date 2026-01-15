import { enqueueNotification } from "@/domain/notifications/outbox";
import type { NotificationTemplate } from "@/domain/notifications/types";
import type { Prisma } from "@prisma/client";

type CommonArgs = {
  userId: string;
  templateVersion?: string;
  payload?: Prisma.InputJsonValue;
};

function buildDedupe(prefix: string, parts: Array<string | number | null | undefined>) {
  return [prefix, ...parts.map((p) => (p === null || p === undefined ? "null" : String(p)))].join(":");
}

async function queue(
  type: NotificationTemplate,
  dedupeKey: string,
  args: CommonArgs & { force?: boolean },
) {
  return enqueueNotification({
    dedupeKey,
    notificationType: type,
    templateVersion: args.templateVersion ?? "v1",
    userId: args.userId,
    payload: args.payload ?? {},
    force: args.force ?? false,
  });
}

export async function notifyPairingInvite(params: {
  pairingId: number;
  tournamentId?: number;
  targetUserId: string;
  inviterUserId?: string;
  token?: string;
}) {
  const dedupeKey = buildDedupe("PAIRING_INVITE", [params.pairingId, params.targetUserId]);
  return queue("PAIRING_INVITE", dedupeKey, {
    userId: params.targetUserId,
    payload: {
      pairingId: params.pairingId,
      tournamentId: params.tournamentId,
      inviterUserId: params.inviterUserId,
      token: params.token,
      viewerRole: "INVITED",
    },
  });
}

export async function notifyPairingInviteSent(params: {
  pairingId: number;
  targetUserId: string;
  inviterUserId: string;
  token?: string;
}) {
  const dedupeKey = buildDedupe("PAIRING_INVITE_SENT", [params.pairingId, params.inviterUserId]);
  return queue("PAIRING_INVITE", dedupeKey, {
    userId: params.inviterUserId,
    payload: {
      pairingId: params.pairingId,
      targetUserId: params.targetUserId,
      inviterUserId: params.inviterUserId,
      token: params.token,
      viewerRole: "CAPTAIN",
    },
  });
}

export async function notifyPairingReminder(params: { pairingId: number; targetUserId: string }) {
  const dedupeKey = buildDedupe("PAIRING_REMINDER", [params.pairingId, params.targetUserId]);
  return queue("PAIRING_REMINDER", dedupeKey, {
    userId: params.targetUserId,
    payload: { pairingId: params.pairingId },
    templateVersion: "v1",
  });
}

export async function notifyPartnerPaid(params: {
  pairingId: number;
  captainUserId: string;
  partnerUserId?: string;
}) {
  const dedupeKey = buildDedupe("PARTNER_PAID", [params.pairingId, params.captainUserId]);
  return queue("PARTNER_PAID", dedupeKey, {
    userId: params.captainUserId,
    payload: { pairingId: params.pairingId, partnerUserId: params.partnerUserId },
  });
}

export async function notifyDeadlineExpired(params: { pairingId: number; userId: string }) {
  const dedupeKey = buildDedupe("DEADLINE_EXPIRED", [params.pairingId, params.userId]);
  return queue("DEADLINE_EXPIRED", dedupeKey, {
    userId: params.userId,
    payload: { pairingId: params.pairingId },
  });
}

export async function notifyOffsessionActionRequired(params: { pairingId: number; userId: string }) {
  const dedupeKey = buildDedupe("OFFSESSION_ACTION_REQUIRED", [params.pairingId, params.userId]);
  return queue("OFFSESSION_ACTION_REQUIRED", dedupeKey, {
    userId: params.userId,
    payload: { pairingId: params.pairingId },
  });
}

export async function notifyNewFollower(params: { targetUserId: string; followerUserId: string }) {
  const dedupeKey = buildDedupe("NEW_FOLLOWER", [params.targetUserId, params.followerUserId]);
  return queue("NEW_FOLLOWER", dedupeKey, {
    userId: params.targetUserId,
    payload: { followerUserId: params.followerUserId },
  });
}

export async function notifyPairingRequestReceived(params: { targetUserId: string; pairingId: number }) {
  const dedupeKey = buildDedupe("PAIRING_REQUEST_RECEIVED", [params.pairingId, params.targetUserId]);
  return queue("PAIRING_REQUEST_RECEIVED", dedupeKey, {
    userId: params.targetUserId,
    payload: { pairingId: params.pairingId },
  });
}

export async function notifyPairingRequestAccepted(params: { targetUserId: string; pairingId: number }) {
  const dedupeKey = buildDedupe("PAIRING_REQUEST_ACCEPTED", [params.pairingId, params.targetUserId]);
  return queue("PAIRING_REQUEST_ACCEPTED", dedupeKey, {
    userId: params.targetUserId,
    payload: { pairingId: params.pairingId },
  });
}

export async function notifyTicketWaitingClaim(params: { userId: string; ticketId: string }) {
  const dedupeKey = buildDedupe("TICKET_WAITING_CLAIM", [params.ticketId, params.userId]);
  return queue("TICKET_WAITING_CLAIM", dedupeKey, {
    userId: params.userId,
    payload: { ticketId: params.ticketId },
  });
}

export async function notifyBracketPublished(params: { userId: string; tournamentId: number }) {
  const dedupeKey = buildDedupe("BRACKET_PUBLISHED", [params.tournamentId, params.userId]);
  return queue("BRACKET_PUBLISHED", dedupeKey, {
    userId: params.userId,
    payload: { tournamentId: params.tournamentId },
  });
}

export async function notifyTournamentEve(params: { userId: string; tournamentId: number }) {
  const dedupeKey = buildDedupe("TOURNAMENT_EVE_REMINDER", [params.tournamentId, params.userId]);
  return queue("TOURNAMENT_EVE_REMINDER", dedupeKey, {
    userId: params.userId,
    payload: { tournamentId: params.tournamentId },
  });
}

export async function notifyMatchResult(params: { userId: string; matchId: number; tournamentId?: number }) {
  const dedupeKey = buildDedupe("MATCH_RESULT", [params.matchId, params.userId]);
  return queue("MATCH_RESULT", dedupeKey, {
    userId: params.userId,
    payload: { matchId: params.matchId, tournamentId: params.tournamentId },
  });
}

export async function notifyNextOpponent(params: { userId: string; matchId: number; tournamentId?: number }) {
  const dedupeKey = buildDedupe("NEXT_OPPONENT", [params.matchId, params.userId]);
  return queue("NEXT_OPPONENT", dedupeKey, {
    userId: params.userId,
    payload: { matchId: params.matchId, tournamentId: params.tournamentId },
  });
}

export async function notifyMatchChanged(params: {
  userId: string;
  matchId: number;
  startAt?: Date | null;
  courtId?: number | null;
}) {
  const dedupeKey = buildDedupe("MATCH_CHANGED", [
    params.matchId,
    params.startAt ? params.startAt.toISOString() : null,
    params.courtId ?? null,
  ]);
  return queue("MATCH_CHANGED", dedupeKey, {
    userId: params.userId,
    payload: { matchId: params.matchId, startAt: params.startAt ?? null, courtId: params.courtId ?? null },
  });
}

export async function notifyEliminated(params: { userId: string; tournamentId: number }) {
  const dedupeKey = buildDedupe("ELIMINATED", [params.tournamentId, params.userId]);
  return queue("ELIMINATED", dedupeKey, {
    userId: params.userId,
    payload: { tournamentId: params.tournamentId },
  });
}

export async function notifyChampion(params: { userId: string; tournamentId: number }) {
  const dedupeKey = buildDedupe("CHAMPION", [params.tournamentId, params.userId]);
  return queue("CHAMPION", dedupeKey, {
    userId: params.userId,
    payload: { tournamentId: params.tournamentId },
  });
}
