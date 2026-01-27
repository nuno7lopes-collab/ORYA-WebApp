import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import type { Prisma, TournamentFormat } from "@prisma/client";
import { EventTemplateType, SourceType } from "@prisma/client";

export async function createTournamentForEvent(input: {
  eventId: number;
  format: TournamentFormat;
  config: Record<string, unknown>;
  actorUserId: string;
  correlationId?: string | null;
}) {
  const { eventId, format, config, actorUserId, correlationId } = input;
  if (!Number.isFinite(eventId)) {
    return { ok: false as const, error: "INVALID_EVENT_ID" };
  }

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true, templateType: true, tournament: { select: { id: true } } },
    });
    if (!event?.organizationId) return { ok: false as const, error: "NOT_FOUND" };
    if (event.templateType !== EventTemplateType.PADEL) {
      return { ok: false as const, error: "EVENT_NOT_PADEL" };
    }
    if (event.tournament?.id) {
      return { ok: true as const, tournamentId: event.tournament.id, created: false };
    }

    const tournament = await tx.tournament.create({
      data: { eventId, format, config },
      select: { id: true },
    });

    const eventIdLog = crypto.randomUUID();
    await appendEventLog(
      {
        eventId: eventIdLog,
        organizationId: event.organizationId,
        eventType: "tournament.created",
        idempotencyKey: `tournament.created:${eventId}`,
        actorUserId,
        sourceType: SourceType.TOURNAMENT,
        sourceId: String(tournament.id),
        correlationId: correlationId ?? null,
        payload: { tournamentId: tournament.id, eventId },
      },
      tx
    );
    await recordOutboxEvent(
      {
        eventId: eventIdLog,
        eventType: "tournament.created",
        payload: { tournamentId: tournament.id, eventId },
        correlationId: correlationId ?? null,
      },
      tx
    );

    return { ok: true as const, tournamentId: tournament.id, created: true };
  });
}

export async function updateTournament(input: {
  tournamentId: number;
  data: Prisma.TournamentUpdateInput;
  actorUserId: string;
  correlationId?: string | null;
}) {
  const { tournamentId, data, actorUserId, correlationId } = input;
  return prisma.$transaction(async (tx) => {
    const existing = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, eventId: true, event: { select: { organizationId: true, templateType: true } } },
    });
    if (!existing?.event) return { ok: false as const, error: "NOT_FOUND" };
    if (existing.event.templateType !== EventTemplateType.PADEL) {
      return { ok: false as const, error: "EVENT_NOT_PADEL" };
    }

    const tournament = await tx.tournament.update({
      where: { id: tournamentId },
      data,
      select: { id: true, eventId: true, event: { select: { organizationId: true } } },
    });

    const eventIdLog = crypto.randomUUID();
    await appendEventLog(
      {
        eventId: eventIdLog,
        organizationId: tournament.event.organizationId,
        eventType: "tournament.updated",
        idempotencyKey: `tournament.updated:${tournamentId}:${Date.now()}`,
        actorUserId,
        sourceType: SourceType.TOURNAMENT,
        sourceId: String(tournament.id),
        correlationId: correlationId ?? null,
        payload: { tournamentId: tournament.id, eventId: tournament.eventId },
      },
      tx
    );
    await recordOutboxEvent(
      {
        eventId: eventIdLog,
        eventType: "tournament.updated",
        payload: { tournamentId: tournament.id, eventId: tournament.eventId },
        correlationId: correlationId ?? null,
      },
      tx
    );

    return { ok: true as const, tournamentId: tournament.id };
  });
}

export async function requestTournamentGeneration(input: {
  organizationId: number;
  tournamentId: number;
  eventId: number;
  payload: Record<string, unknown>;
  actorUserId: string;
  correlationId?: string | null;
}) {
  const { organizationId, tournamentId, eventId, payload, actorUserId, correlationId } = input;
  return prisma.$transaction(async (tx) => {
    const eventIdLog = crypto.randomUUID();
    await appendEventLog(
      {
        eventId: eventIdLog,
        organizationId,
        eventType: "tournament.generate_requested",
        idempotencyKey: `tournament.generate:${tournamentId}:${Date.now()}`,
        actorUserId,
        sourceType: SourceType.TOURNAMENT,
        sourceId: String(tournamentId),
        correlationId: correlationId ?? null,
        payload: { tournamentId, eventId },
      },
      tx
    );
    await recordOutboxEvent(
      {
        eventId: eventIdLog,
        eventType: "TOURNAMENT_GENERATE",
        payload,
        correlationId: correlationId ?? null,
      },
      tx
    );
    return { ok: true as const };
  });
}
