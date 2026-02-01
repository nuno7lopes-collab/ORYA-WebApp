import {
  EventStatus,
  PadelPairingJoinMode,
  PadelPaymentMode,
  PadelRegistrationStatus,
  PadelTournamentLifecycleStatus,
  SourceType,
  Prisma,
} from "@prisma/client";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { isPadelCompetitionState, PadelCompetitionState } from "@/domain/padelCompetitionState";

type RegistrationCheckResult =
  | { ok: true }
  | { ok: false; code: "EVENT_NOT_PUBLISHED" | "INSCRIPTIONS_NOT_OPEN" | "INSCRIPTIONS_CLOSED" | "TOURNAMENT_STARTED" };

type RegistrationCheckParams = {
  eventStatus: EventStatus;
  eventStartsAt: Date | null;
  registrationStartsAt?: Date | null;
  registrationEndsAt?: Date | null;
  competitionState?: PadelCompetitionState | string | null;
  lifecycleStatus?: PadelTournamentLifecycleStatus | string | null;
  now?: Date;
};

export type DerivedPairingLifecycleStatus =
  | "PENDING_ONE_PAID"
  | "PENDING_PARTNER_PAYMENT"
  | "CONFIRMED_BOTH_PAID"
  | "CONFIRMED_CAPTAIN_FULL"
  | "CANCELLED_INCOMPLETE";

export const ACTIVE_REGISTRATION_STATUSES: PadelRegistrationStatus[] = [
  PadelRegistrationStatus.PENDING_PARTNER,
  PadelRegistrationStatus.PENDING_PAYMENT,
  PadelRegistrationStatus.MATCHMAKING,
  PadelRegistrationStatus.CONFIRMED,
];

export const INACTIVE_REGISTRATION_STATUSES: PadelRegistrationStatus[] = [
  PadelRegistrationStatus.EXPIRED,
  PadelRegistrationStatus.CANCELLED,
  PadelRegistrationStatus.REFUNDED,
];

export const ACTIVE_PAIRING_REGISTRATION_WHERE: Prisma.PadelPairingWhereInput = {
  OR: [
    { registration: { status: { notIn: INACTIVE_REGISTRATION_STATUSES } } },
    { registration: null },
  ],
};

export function isConfirmedLifecycle(status: DerivedPairingLifecycleStatus | null | undefined) {
  return Boolean(status && status.startsWith("CONFIRMED"));
}

export function isCancelledLifecycle(status: DerivedPairingLifecycleStatus | null | undefined) {
  return status === "CANCELLED_INCOMPLETE";
}

export function checkPadelRegistrationWindow(params: RegistrationCheckParams): RegistrationCheckResult {
  const { eventStatus, eventStartsAt, registrationStartsAt, registrationEndsAt } = params;
  const now = params.now ?? new Date();
  const lifecycle =
    params.lifecycleStatus && typeof params.lifecycleStatus === "string"
      ? (params.lifecycleStatus.toUpperCase() as PadelTournamentLifecycleStatus)
      : null;
  const competitionState = isPadelCompetitionState(params.competitionState)
    ? params.competitionState
    : null;

  if (lifecycle && Object.values(PadelTournamentLifecycleStatus).includes(lifecycle)) {
    if (lifecycle === "DRAFT" || lifecycle === "CANCELLED") {
      return { ok: false, code: "EVENT_NOT_PUBLISHED" };
    }
    if (lifecycle === "LOCKED") {
      return { ok: false, code: "INSCRIPTIONS_CLOSED" };
    }
    if (lifecycle === "LIVE") {
      return { ok: false, code: "TOURNAMENT_STARTED" };
    }
    if (lifecycle === "COMPLETED") {
      return { ok: false, code: "INSCRIPTIONS_CLOSED" };
    }
  }

  if (competitionState === "HIDDEN" || competitionState === "CANCELLED") {
    return { ok: false, code: "EVENT_NOT_PUBLISHED" };
  }
  if (competitionState === "PUBLIC") {
    return { ok: false, code: "INSCRIPTIONS_CLOSED" };
  }

  if (eventStatus !== "PUBLISHED" && eventStatus !== "DATE_CHANGED") {
    return { ok: false, code: "EVENT_NOT_PUBLISHED" };
  }

  if (registrationStartsAt && now.getTime() < registrationStartsAt.getTime()) {
    return { ok: false, code: "INSCRIPTIONS_NOT_OPEN" };
  }

  if (registrationEndsAt && now.getTime() > registrationEndsAt.getTime()) {
    return { ok: false, code: "INSCRIPTIONS_CLOSED" };
  }

  if (eventStartsAt && now.getTime() >= eventStartsAt.getTime()) {
    return { ok: false, code: "TOURNAMENT_STARTED" };
  }

  return { ok: true };
}

export function mapRegistrationToPairingLifecycle(
  status: PadelRegistrationStatus,
  paymentMode: PadelPaymentMode,
): DerivedPairingLifecycleStatus {
  switch (status) {
    case PadelRegistrationStatus.CONFIRMED:
      return paymentMode === PadelPaymentMode.FULL
        ? "CONFIRMED_CAPTAIN_FULL"
        : "CONFIRMED_BOTH_PAID";
    case PadelRegistrationStatus.PENDING_PAYMENT:
      return "PENDING_PARTNER_PAYMENT";
    case PadelRegistrationStatus.MATCHMAKING:
    case PadelRegistrationStatus.PENDING_PARTNER:
      return "PENDING_ONE_PAID";
    case PadelRegistrationStatus.EXPIRED:
    case PadelRegistrationStatus.CANCELLED:
    case PadelRegistrationStatus.REFUNDED:
      return "CANCELLED_INCOMPLETE";
    default:
      return "PENDING_ONE_PAID";
  }
}

export function deriveRegistrationStatusFromPairing(params: {
  pairingJoinMode: PadelPairingJoinMode;
  lifecycleStatus: DerivedPairingLifecycleStatus;
  paymentMode: PadelPaymentMode;
}): PadelRegistrationStatus {
  const { pairingJoinMode, lifecycleStatus } = params;
  if (lifecycleStatus === "CONFIRMED_BOTH_PAID" || lifecycleStatus === "CONFIRMED_CAPTAIN_FULL") {
    return PadelRegistrationStatus.CONFIRMED;
  }
  if (lifecycleStatus === "CANCELLED_INCOMPLETE") {
    return PadelRegistrationStatus.CANCELLED;
  }
  if (lifecycleStatus === "PENDING_PARTNER_PAYMENT") {
    return PadelRegistrationStatus.PENDING_PAYMENT;
  }
  if (pairingJoinMode === PadelPairingJoinMode.LOOKING_FOR_PARTNER) {
    return PadelRegistrationStatus.MATCHMAKING;
  }
  return PadelRegistrationStatus.PENDING_PARTNER;
}

export function resolveInitialPadelRegistrationStatus(params: {
  pairingJoinMode: PadelPairingJoinMode;
  paymentMode: PadelPaymentMode;
  captainPaid: boolean;
}): PadelRegistrationStatus {
  if (params.paymentMode === PadelPaymentMode.FULL && params.captainPaid) {
    return PadelRegistrationStatus.CONFIRMED;
  }
  if (params.pairingJoinMode === PadelPairingJoinMode.LOOKING_FOR_PARTNER) {
    return PadelRegistrationStatus.MATCHMAKING;
  }
  return PadelRegistrationStatus.PENDING_PARTNER;
}

export function resolvePartnerActionStatus(params: { partnerPaid: boolean }): PadelRegistrationStatus {
  return params.partnerPaid ? PadelRegistrationStatus.CONFIRMED : PadelRegistrationStatus.PENDING_PAYMENT;
}

const TERMINAL_STATUSES = new Set<PadelRegistrationStatus>([
  PadelRegistrationStatus.EXPIRED,
  PadelRegistrationStatus.CANCELLED,
  PadelRegistrationStatus.REFUNDED,
]);

const EXPIRE_ALLOWED_FROM = new Set<PadelRegistrationStatus>([
  PadelRegistrationStatus.PENDING_PARTNER,
  PadelRegistrationStatus.PENDING_PAYMENT,
  PadelRegistrationStatus.MATCHMAKING,
]);

export async function transitionPadelRegistrationStatus(
  tx: Prisma.TransactionClient,
  params: {
    pairingId: number;
    organizationId?: number;
    eventId?: number;
    status: PadelRegistrationStatus;
    paymentMode?: PadelPaymentMode;
    isFullyPaid?: boolean;
    secondChargeConfirmed?: boolean;
    reason?: string | null;
    correlationId?: string | null;
    emitSecondChargeDue?: boolean;
  },
) {
  const { pairingId, status } = params;
  const pairing = await tx.padelPairing.findUnique({
    where: { id: pairingId },
    select: { eventId: true, organizationId: true, payment_mode: true },
  });
  if (!pairing) throw new Error("PADREG_PAIRING_NOT_FOUND");

  const paymentMode = params.paymentMode ?? pairing.payment_mode;
  const existing = await tx.padelRegistration.findUnique({ where: { pairingId } });
  const fromStatus = existing?.status ?? null;
  const allowSameStatusEvents = Boolean(params.emitSecondChargeDue);
  if (fromStatus && fromStatus === status && !allowSameStatusEvents) return existing;
  if (fromStatus && TERMINAL_STATUSES.has(fromStatus) && fromStatus !== status) {
    throw new Error("PADREG_TERMINAL_STATUS");
  }
  if (status === PadelRegistrationStatus.EXPIRED && fromStatus && !EXPIRE_ALLOWED_FROM.has(fromStatus)) {
    throw new Error("PADREG_EXPIRE_INVALID");
  }
  if (status === PadelRegistrationStatus.CONFIRMED && paymentMode === PadelPaymentMode.SPLIT) {
    if (!params.isFullyPaid && !params.secondChargeConfirmed) {
      throw new Error("PADREG_CONFIRM_REQUIRES_FULL_PAYMENT");
    }
  }

  const statusChanged = !fromStatus || fromStatus !== status;
  const registration = existing
    ? statusChanged
      ? await tx.padelRegistration.update({
          where: { pairingId },
          data: { status },
        })
      : existing
    : await tx.padelRegistration.create({
        data: {
          pairingId,
          organizationId: params.organizationId ?? pairing.organizationId,
          eventId: params.eventId ?? pairing.eventId,
          status,
          currency: "EUR",
        },
      });
  if (statusChanged) {
    if (!fromStatus) {
      await appendEventLog(
        {
          organizationId: registration.organizationId,
          eventType: "padel.registration.created",
          idempotencyKey: `padelreg:${registration.id}:created`,
          payload: {
            registrationId: registration.id,
            eventId: registration.eventId,
            status,
          },
          sourceType: SourceType.PADEL_REGISTRATION,
          sourceId: registration.id,
          correlationId: params.correlationId ?? null,
        },
        tx,
      );
    }

    await recordOutboxEvent(
      {
        eventType: "PADREG_STATUS_CHANGED",
        dedupeKey: `padelreg:${registration.id}:status:${fromStatus ?? "NONE"}:${status}`,
        payload: {
          registrationId: registration.id,
          from: fromStatus,
          to: status,
          reason: params.reason ?? null,
          correlationId: params.correlationId ?? null,
        },
        correlationId: params.correlationId ?? null,
      },
      tx,
    );
  }

  if (params.emitSecondChargeDue) {
    await recordOutboxEvent(
      {
        eventType: "PADREG_SPLIT_SECOND_CHARGE_DUE",
        dedupeKey: `padelreg:${registration.id}:split_second_charge_due`,
        payload: {
          registrationId: registration.id,
          reason: params.reason ?? null,
          correlationId: params.correlationId ?? null,
        },
        correlationId: params.correlationId ?? null,
      },
      tx,
    );
  }

  if (status === PadelRegistrationStatus.EXPIRED) {
    await appendEventLog(
      {
        organizationId: registration.organizationId,
        eventType: "padel.registration.expired",
        idempotencyKey: `padelreg:${registration.id}:expired`,
        payload: {
          registrationId: registration.id,
          eventId: registration.eventId,
          status,
        },
        sourceType: SourceType.PADEL_REGISTRATION,
        sourceId: registration.id,
        correlationId: params.correlationId ?? null,
      },
      tx,
    );

    await recordOutboxEvent(
      {
        eventType: "PADREG_EXPIRED",
        dedupeKey: `padelreg:${registration.id}:expired`,
        payload: {
          registrationId: registration.id,
          reason: params.reason ?? null,
          correlationId: params.correlationId ?? null,
        },
        correlationId: params.correlationId ?? null,
      },
      tx,
    );
  }

  return registration;
}

export async function upsertPadelRegistrationForPairing(
  tx: Prisma.TransactionClient,
  params: {
    pairingId: number;
    organizationId: number;
    eventId: number;
    status: PadelRegistrationStatus;
    paymentMode?: PadelPaymentMode;
    isFullyPaid?: boolean;
    secondChargeConfirmed?: boolean;
    reason?: string | null;
    correlationId?: string | null;
  },
) {
  return transitionPadelRegistrationStatus(tx, {
    pairingId: params.pairingId,
    organizationId: params.organizationId,
    eventId: params.eventId,
    status: params.status,
    paymentMode: params.paymentMode,
    isFullyPaid: params.isFullyPaid,
    secondChargeConfirmed: params.secondChargeConfirmed,
    reason: params.reason ?? "STATUS_SYNC",
    correlationId: params.correlationId ?? null,
  });
}
