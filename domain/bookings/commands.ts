import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";
import { makeOutboxDedupeKey } from "@/domain/outbox/dedupe";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import type { Prisma } from "@prisma/client";
import { SourceType } from "@prisma/client";

type BookingCommandBase = {
  organizationId: number;
  actorUserId: string | null;
  correlationId?: string | null;
  eventType?: string;
};

type BookingCommandTx = {
  tx?: Prisma.TransactionClient;
};

type BookingCommandResult<T> = { booking: T; outboxEventId: string };

const DEFAULT_CREATED_EVENT = "booking.created";
const DEFAULT_UPDATED_EVENT = "booking.updated";
const DEFAULT_CANCELLED_EVENT = "booking.cancelled";
const DEFAULT_NO_SHOW_EVENT = "booking.no_show";

const OUTBOX_EVENT_TYPE = "AGENDA_ITEM_UPSERT_REQUESTED" as const;

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(obj[key]);
        return acc;
      }, {});
  }
  if (value instanceof Date) return value.toISOString();
  return value;
};

const hashPayload = (payload: Record<string, unknown>) =>
  crypto.createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");

const computeEndsAt = (startsAt: Date | null, durationMinutes: number | null) => {
  if (!startsAt || !(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) return null;
  if (!durationMinutes || !Number.isFinite(durationMinutes)) return null;
  return new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
};

const buildPayload = (booking: {
  id: number;
  organizationId: number;
  status: string | null;
  startsAt: Date | null;
  durationMinutes: number | null;
  serviceId: number | null;
  userId: string | null;
  professionalId: number | null;
  resourceId: number | null;
  courtId: number | null;
  assignmentMode: string | null;
  partySize: number | null;
}) => {
  const endsAt = computeEndsAt(booking.startsAt ?? null, booking.durationMinutes ?? null);
  return {
    bookingId: booking.id,
    organizationId: booking.organizationId,
    status: booking.status ?? null,
    startsAt: booking.startsAt ?? null,
    endsAt,
    durationMinutes: booking.durationMinutes ?? null,
    serviceId: booking.serviceId ?? null,
    userId: booking.userId ?? null,
    professionalId: booking.professionalId ?? null,
    resourceId: booking.resourceId ?? null,
    courtId: booking.courtId ?? null,
    assignmentMode: booking.assignmentMode ?? null,
    partySize: booking.partySize ?? null,
    sourceType: SourceType.BOOKING,
    sourceId: String(booking.id),
  };
};

async function withTx<T>(
  tx: Prisma.TransactionClient | undefined,
  fn: (client: Prisma.TransactionClient) => Promise<T>,
) {
  if (tx) return fn(tx);
  return prisma.$transaction(fn);
}

async function recordBookingEvent(params: {
  tx: Prisma.TransactionClient;
  eventId: string;
  eventType: string;
  organizationId: number;
  actorUserId: string | null;
  correlationId?: string | null;
  payload: Record<string, unknown>;
}) {
  const payloadHash = hashPayload(params.payload);
  const causationId = `booking:${params.eventType}:${params.payload.sourceId ?? "unknown"}:${payloadHash}`;
  const dedupeKey = makeOutboxDedupeKey(OUTBOX_EVENT_TYPE, causationId);
  await appendEventLog(
    {
      eventId: params.eventId,
      organizationId: params.organizationId,
      eventType: params.eventType,
      actorUserId: params.actorUserId,
      sourceType: SourceType.BOOKING,
      sourceId: String(params.payload.sourceId ?? ""),
      correlationId: params.correlationId ?? null,
      payload: params.payload as Prisma.InputJsonValue,
    },
    params.tx,
  );

  await recordOutboxEvent(
    {
      eventId: params.eventId,
      eventType: OUTBOX_EVENT_TYPE,
      dedupeKey,
      payload: {
        eventId: params.eventId,
        sourceType: SourceType.BOOKING,
        sourceId: String(params.payload.sourceId ?? ""),
        organizationId: params.organizationId,
      } as Prisma.InputJsonValue,
      causationId,
      correlationId: params.correlationId ?? null,
    },
    params.tx,
  );
}

const baseSelect = {
  id: true,
  organizationId: true,
  status: true,
  startsAt: true,
  durationMinutes: true,
  serviceId: true,
  userId: true,
  professionalId: true,
  resourceId: true,
  courtId: true,
  assignmentMode: true,
  partySize: true,
} satisfies Prisma.BookingSelect;

type BookingBase = Prisma.BookingGetPayload<{ select: typeof baseSelect }>;

export async function createBooking(
  input: BookingCommandBase &
    BookingCommandTx & {
      data: Prisma.BookingCreateInput | Prisma.BookingUncheckedCreateInput;
      select?: Prisma.BookingSelect;
      include?: Prisma.BookingInclude;
    },
): Promise<BookingCommandResult<BookingBase>> {
  const eventType = input.eventType ?? DEFAULT_CREATED_EVENT;

  return withTx(input.tx, async (tx) => {
    const createArgs: Prisma.BookingCreateArgs = {
      data: input.data,
      ...(input.select
        ? { select: { ...input.select, ...baseSelect } }
        : input.include
          ? { include: input.include }
          : { select: baseSelect }),
    };
    const created = (await tx.booking.create(createArgs)) as BookingBase;

    const eventId = crypto.randomUUID();
    const payload = buildPayload(created as any);

    await recordBookingEvent({
      tx,
      eventId,
      eventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      payload,
    });

    return { booking: created, outboxEventId: eventId };
  });
}

export async function updateBooking(
  input: BookingCommandBase &
    BookingCommandTx & {
      bookingId: number;
      data: Prisma.BookingUpdateInput | Prisma.BookingUncheckedUpdateInput;
      select?: Prisma.BookingSelect;
      include?: Prisma.BookingInclude;
    },
): Promise<BookingCommandResult<BookingBase>> {
  const eventType = input.eventType ?? DEFAULT_UPDATED_EVENT;

  return withTx(input.tx, async (tx) => {
    const updateArgs: Prisma.BookingUpdateArgs = {
      where: { id: input.bookingId },
      data: input.data,
      ...(input.select
        ? { select: { ...input.select, ...baseSelect } }
        : input.include
          ? { include: input.include }
          : { select: baseSelect }),
    };
    const updated = (await tx.booking.update(updateArgs)) as BookingBase;

    const eventId = crypto.randomUUID();
    const payload = buildPayload(updated as any);

    await recordBookingEvent({
      tx,
      eventId,
      eventType,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      payload,
    });

    return { booking: updated, outboxEventId: eventId };
  });
}

export async function cancelBooking(
  input: BookingCommandBase &
    BookingCommandTx & {
      bookingId: number;
      data: Prisma.BookingUpdateInput | Prisma.BookingUncheckedUpdateInput;
      select?: Prisma.BookingSelect;
      include?: Prisma.BookingInclude;
    },
): Promise<BookingCommandResult<BookingBase>> {
  return updateBooking({
    ...input,
    eventType: input.eventType ?? DEFAULT_CANCELLED_EVENT,
  });
}

export async function markNoShowBooking(
  input: BookingCommandBase &
    BookingCommandTx & {
      bookingId: number;
      data: Prisma.BookingUpdateInput | Prisma.BookingUncheckedUpdateInput;
      select?: Prisma.BookingSelect;
      include?: Prisma.BookingInclude;
    },
): Promise<BookingCommandResult<BookingBase>> {
  return updateBooking({
    ...input,
    eventType: input.eventType ?? DEFAULT_NO_SHOW_EVENT,
  });
}
