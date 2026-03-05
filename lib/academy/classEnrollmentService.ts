import {
  AddressSourceProvider,
  BookingStatus,
  ReservationAssignmentMode,
  ServiceKind,
  ServiceLocationMode,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createBooking, cancelBooking } from "@/domain/bookings/commands";

const ACTIVE_ENROLLMENT_STATUSES = ["PENDING", "CONFIRMED"] as const;
const WAITLIST_ACTIVE_STATUSES = ["WAITING", "PROMOTED"] as const;
const PENDING_HOLD_MINUTES = 10;

export class ClassEnrollmentError extends Error {
  status: number;
  errorCode: string;
  retryable: boolean;

  constructor(status: number, errorCode: string, message: string, retryable = false) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.retryable = retryable;
  }
}

type TxClient = Prisma.TransactionClient;

type EnrollmentSessionRow = {
  id: number;
  organizationId: number;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: string;
  professionalId: number | null;
  courtId: number | null;
  service: {
    id: number;
    durationMinutes: number;
    unitPriceCents: number;
    currency: string;
    assignmentMode: ReservationAssignmentMode;
    locationMode: ServiceLocationMode;
    addressId: string | null;
    organization: { timezone: string | null; addressId: string | null } | null;
  };
  professional: { id: number; isActive: boolean } | null;
};

type ExistingEnrollmentRow = {
  id: number;
  bookingId: number | null;
  classSessionId: number;
  userId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  booking: {
    id: number;
    status: BookingStatus;
    pendingExpiresAt: Date | null;
    startsAt: Date;
    durationMinutes: number;
    professionalId: number | null;
    resourceId: number | null;
    courtId: number | null;
  } | null;
};

type EnrollmentBookingSnapshot = {
  id: number;
  status: BookingStatus | string;
  pendingExpiresAt: Date | null;
  startsAt: Date;
  durationMinutes: number;
  professionalId: number | null;
  resourceId: number | null;
  courtId: number | null;
};

function mapAssignmentMode(
  assignmentMode: ReservationAssignmentMode,
  resourceId: number | null,
) {
  if (assignmentMode === ReservationAssignmentMode.RESOURCE_ONLY) {
    return ReservationAssignmentMode.PROFESSIONAL_ONLY;
  }
  if (assignmentMode === ReservationAssignmentMode.PROFESSIONAL_AND_RESOURCE && !resourceId) {
    return ReservationAssignmentMode.PROFESSIONAL_ONLY;
  }
  return assignmentMode;
}

function resolveSessionDurationMinutes(params: {
  startsAt: Date;
  endsAt: Date;
  serviceDurationMinutes: number;
}) {
  const diffMs = params.endsAt.getTime() - params.startsAt.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (Number.isFinite(diffMinutes) && diffMinutes > 0) return diffMinutes;
  return params.serviceDurationMinutes;
}

function toEnrollmentBookingSnapshot(
  booking:
    | {
        id: number;
        status: BookingStatus | string;
        startsAt: Date;
        durationMinutes: number;
        professionalId: number | null;
        resourceId: number | null;
        courtId: number | null;
        pendingExpiresAt?: Date | null;
      }
    | null,
  fallbackPendingExpiresAt: Date | null = null,
): EnrollmentBookingSnapshot | null {
  if (!booking) return null;

  return {
    id: booking.id,
    status: booking.status,
    pendingExpiresAt: booking.pendingExpiresAt ?? fallbackPendingExpiresAt,
    startsAt: booking.startsAt,
    durationMinutes: booking.durationMinutes,
    professionalId: booking.professionalId,
    resourceId: booking.resourceId,
    courtId: booking.courtId,
  };
}

function normalizeUserId(userIdRaw: string | null | undefined) {
  const value = String(userIdRaw ?? "").trim();
  return value.length > 0 ? value : null;
}

function mapBookingStatusToEnrollmentStatus(status: BookingStatus | string | null | undefined) {
  const normalized = String(status ?? "").trim().toUpperCase();
  if (normalized === "PENDING" || normalized === "PENDING_CONFIRMATION") return "PENDING" as const;
  if (normalized.startsWith("CANCELLED")) return "CANCELLED" as const;
  return "CONFIRMED" as const;
}

async function withTx<T>(
  tx: TxClient | undefined,
  fn: (client: TxClient) => Promise<T>,
) {
  if (tx) return fn(tx);
  return prisma.$transaction(fn);
}

async function loadSessionBySessionId(params: {
  tx: TxClient;
  organizationId: number;
  sessionId: number;
  serviceId?: number | null;
}) {
  const serviceFilter =
    typeof params.serviceId === "number" && Number.isFinite(params.serviceId) && params.serviceId > 0
      ? { serviceId: params.serviceId }
      : {};

  return params.tx.classSession.findFirst({
    where: {
      id: params.sessionId,
      organizationId: params.organizationId,
      ...serviceFilter,
      service: { kind: ServiceKind.CLASS },
    },
    select: {
      id: true,
      organizationId: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      status: true,
      professionalId: true,
      courtId: true,
      service: {
        select: {
          id: true,
          durationMinutes: true,
          unitPriceCents: true,
          currency: true,
          assignmentMode: true,
          locationMode: true,
          addressId: true,
          organization: { select: { timezone: true, addressId: true } },
        },
      },
      professional: { select: { id: true, isActive: true } },
    },
  }) as Promise<EnrollmentSessionRow | null>;
}

async function loadSessionByLegacySlot(params: {
  tx: TxClient;
  organizationId: number;
  serviceId: number;
  startsAt: Date;
}) {
  return params.tx.classSession.findFirst({
    where: {
      organizationId: params.organizationId,
      serviceId: params.serviceId,
      startsAt: params.startsAt,
      service: { kind: ServiceKind.CLASS },
    },
    select: {
      id: true,
      organizationId: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      status: true,
      professionalId: true,
      courtId: true,
      service: {
        select: {
          id: true,
          durationMinutes: true,
          unitPriceCents: true,
          currency: true,
          assignmentMode: true,
          locationMode: true,
          addressId: true,
          organization: { select: { timezone: true, addressId: true } },
        },
      },
      professional: { select: { id: true, isActive: true } },
    },
  }) as Promise<EnrollmentSessionRow | null>;
}

export async function enrollUserIntoClassSession(params: {
  tx?: TxClient;
  organizationId: number;
  actorUserId: string | null;
  userId: string;
  source: string;
  sessionId?: number | null;
  serviceId?: number | null;
  startsAt?: Date | null;
  partySize?: number | null;
  addressId?: string | null;
  now?: Date;
}) {
  const userId = normalizeUserId(params.userId);
  if (!userId) {
    throw new ClassEnrollmentError(400, "STUDENT_REQUIRED", "Aluno obrigatório para inscrição.");
  }

  return withTx(params.tx, async (tx) => {
    const now = params.now ?? new Date();

    const session = params.sessionId
      ? await loadSessionBySessionId({
          tx,
          organizationId: params.organizationId,
          sessionId: params.sessionId,
          serviceId: params.serviceId,
        })
      : params.serviceId && params.startsAt
        ? await loadSessionByLegacySlot({
            tx,
            organizationId: params.organizationId,
            serviceId: params.serviceId,
            startsAt: params.startsAt,
          })
        : null;

    if (!session) {
      throw new ClassEnrollmentError(404, "SESSION_NOT_FOUND", "Sessão não encontrada.");
    }

    if (session.status !== "SCHEDULED") {
      throw new ClassEnrollmentError(409, "SESSION_UNAVAILABLE", "Sessão indisponível.");
    }

    if (session.startsAt.getTime() <= now.getTime()) {
      throw new ClassEnrollmentError(409, "SESSION_ALREADY_STARTED", "A sessão já começou.");
    }

    if (!session.professionalId || !session.professional?.isActive) {
      throw new ClassEnrollmentError(
        409,
        "CLASS_REQUIRES_ACTIVE_TRAINER",
        "Aula sem treinador ativo não pode aceitar inscrições.",
      );
    }

    const student = await tx.profile.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!student) {
      throw new ClassEnrollmentError(404, "STUDENT_NOT_FOUND", "Aluno não encontrado.");
    }

    const lockKey = `academy_enrollment:${params.organizationId}:${session.id}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const existingEnrollment = (await tx.academyEnrollment.findFirst({
      where: {
        organizationId: params.organizationId,
        classSessionId: session.id,
        userId,
        status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
      },
      select: {
        id: true,
        bookingId: true,
        classSessionId: true,
        userId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        booking: {
          select: {
            id: true,
            status: true,
            pendingExpiresAt: true,
            startsAt: true,
            durationMinutes: true,
            professionalId: true,
            resourceId: true,
            courtId: true,
          },
        },
      },
    })) as ExistingEnrollmentRow | null;

    if (existingEnrollment) {
      return {
        kind: "existing" as const,
        bridgeUsed: !params.sessionId,
        sessionId: session.id,
        enrollment: existingEnrollment,
        booking: toEnrollmentBookingSnapshot(existingEnrollment.booking),
      };
    }

    const activeEnrollments = await tx.academyEnrollment.count({
      where: {
        organizationId: params.organizationId,
        classSessionId: session.id,
        status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
      },
    });

    if (activeEnrollments >= session.capacity) {
      throw new ClassEnrollmentError(409, "SESSION_FULL", "Sessão sem vagas.");
    }

    const addressId = typeof params.addressId === "string" && params.addressId.trim()
      ? params.addressId.trim()
      : null;

    const resolvedAddressId =
      addressId ||
      (session.service.locationMode === ServiceLocationMode.FIXED
        ? session.service.addressId ?? session.service.organization?.addressId ?? null
        : null);

    if (session.service.locationMode === ServiceLocationMode.FIXED && !resolvedAddressId) {
      throw new ClassEnrollmentError(400, "LOCATION_REQUIRED", "Morada obrigatória para esta sessão.");
    }

    if (resolvedAddressId) {
      const resolvedAddress = await tx.address.findUnique({
        where: { id: resolvedAddressId },
        select: { sourceProvider: true },
      });
      if (!resolvedAddress) {
        throw new ClassEnrollmentError(400, "LOCATION_REQUIRED", "Morada inválida.");
      }
      if (resolvedAddress.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
        throw new ClassEnrollmentError(400, "LOCATION_REQUIRED", "Morada deve ser Apple Maps.");
      }
    }

    const resourceId = session.courtId
      ? (
          await tx.reservationResource.findFirst({
            where: {
              organizationId: params.organizationId,
              courtId: session.courtId,
              isActive: true,
            },
            select: { id: true },
          })
        )?.id ?? null
      : null;

    const durationMinutes = resolveSessionDurationMinutes({
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      serviceDurationMinutes: session.service.durationMinutes,
    });

    const assignmentMode = mapAssignmentMode(session.service.assignmentMode, resourceId);
    const pendingExpiresAt = new Date(now.getTime() + PENDING_HOLD_MINUTES * 60 * 1000);

    const { booking } = await createBooking({
      tx,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      data: {
        serviceId: session.service.id,
        organizationId: params.organizationId,
        userId,
        startsAt: session.startsAt,
        durationMinutes,
        price: session.service.unitPriceCents,
        currency: session.service.currency || "EUR",
        status: BookingStatus.PENDING_CONFIRMATION,
        assignmentMode,
        professionalId: session.professionalId,
        resourceId,
        courtId: session.courtId,
        partySize: params.partySize ?? null,
        pendingExpiresAt,
        snapshotTimezone: session.service.organization?.timezone || "Europe/Lisbon",
        locationMode: session.service.locationMode,
        addressId: resolvedAddressId,
      },
      select: {
        id: true,
        status: true,
        pendingExpiresAt: true,
        startsAt: true,
        durationMinutes: true,
        professionalId: true,
        resourceId: true,
        courtId: true,
      },
    });

    const enrollment = await tx.academyEnrollment.create({
      data: {
        organizationId: params.organizationId,
        academyClassId: session.service.id,
        classSessionId: session.id,
        bookingId: booking.id,
        userId,
        status: "PENDING",
        source: params.source,
        holdExpiresAt: pendingExpiresAt,
        priceCents: session.service.unitPriceCents,
        currency: session.service.currency || "EUR",
      },
      select: {
        id: true,
        bookingId: true,
        classSessionId: true,
        userId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await tx.academyWaitlistEntry.updateMany({
      where: {
        organizationId: params.organizationId,
        classSessionId: session.id,
        userId,
        status: { in: [...WAITLIST_ACTIVE_STATUSES] },
      },
      data: {
        status: "REMOVED",
        acceptanceWindowEndsAt: null,
      },
    });

    return {
      kind: "created" as const,
      bridgeUsed: !params.sessionId,
      sessionId: session.id,
      enrollment,
      booking: toEnrollmentBookingSnapshot(booking, pendingExpiresAt),
    };
  });
}

export async function syncEnrollmentByBookingId(params: {
  tx: TxClient;
  bookingId: number;
  bookingStatus?: BookingStatus | string | null;
}) {
  const enrollment = await params.tx.academyEnrollment.findFirst({
    where: { bookingId: params.bookingId },
    select: { id: true, status: true },
  });

  if (!enrollment) return null;

  const resolvedBookingStatus =
    params.bookingStatus ??
    (
      await params.tx.booking.findUnique({
        where: { id: params.bookingId },
        select: { status: true },
      })
    )?.status;

  const nextStatus = mapBookingStatusToEnrollmentStatus(resolvedBookingStatus);
  if (enrollment.status === nextStatus) return enrollment;

  const data: Prisma.AcademyEnrollmentUpdateInput = { status: nextStatus };
  if (nextStatus !== "PENDING") {
    data.holdExpiresAt = null;
  }

  return params.tx.academyEnrollment.update({
    where: { id: enrollment.id },
    data,
    select: {
      id: true,
      status: true,
      bookingId: true,
      classSessionId: true,
      userId: true,
      updatedAt: true,
    },
  });
}

export async function cancelClassSessionEnrollmentsAndBookings(params: {
  tx: TxClient;
  organizationId: number;
  sessionIds: number[];
  actorUserId: string | null;
}) {
  const sessionIds = Array.from(new Set(params.sessionIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (sessionIds.length === 0) {
    return { cancelledEnrollments: 0, cancelledBookings: 0 };
  }

  const enrollments = await params.tx.academyEnrollment.findMany({
    where: {
      organizationId: params.organizationId,
      classSessionId: { in: sessionIds },
      status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
    },
    select: {
      id: true,
      bookingId: true,
    },
  });

  const bookingIds = Array.from(
    new Set(
      enrollments
        .map((item) => item.bookingId)
        .filter((value): value is number => typeof value === "number" && value > 0),
    ),
  );

  let cancelledBookings = 0;
  for (const bookingId of bookingIds) {
    const booking = await params.tx.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, organizationId: true },
    });

    if (!booking || booking.organizationId !== params.organizationId) continue;
    if (["CANCELLED", "CANCELLED_BY_CLIENT", "CANCELLED_BY_ORG"].includes(booking.status)) continue;

    await cancelBooking({
      tx: params.tx,
      bookingId: booking.id,
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      data: { status: "CANCELLED_BY_ORG" },
    });
    cancelledBookings += 1;
  }

  const cancelled = await params.tx.academyEnrollment.updateMany({
    where: {
      organizationId: params.organizationId,
      classSessionId: { in: sessionIds },
      status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
    },
    data: {
      status: "CANCELLED",
      holdExpiresAt: null,
    },
  });

  return {
    cancelledEnrollments: cancelled.count,
    cancelledBookings,
  };
}
