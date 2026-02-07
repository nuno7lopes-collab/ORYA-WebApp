import { prisma } from "@/lib/prisma";
import { generateAndPersistTournamentStructure, getConfirmedPairings } from "@/domain/tournaments/generation";
import { autoGeneratePadelMatches } from "@/domain/padel/autoGenerateMatches";
import {
  CrmInteractionSource,
  CrmInteractionType,
  Prisma,
  padel_format,
  NotificationType,
  TournamentEntryStatus,
  TournamentEntryRole,
} from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import { ingestCrmInteraction } from "@/lib/crm/ingest";

export async function ensureEntriesForConfirmedPairing(pairingId: number) {
  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: {
      id: true,
      eventId: true,
      categoryId: true,
      player1UserId: true,
      player2UserId: true,
      event: { select: { title: true, slug: true, organizationId: true } },
    },
  });
  if (!pairing) return;

  const entriesData: Array<{ userId: string; role: TournamentEntryRole }> = [];
  if (pairing.player1UserId) entriesData.push({ userId: pairing.player1UserId, role: "CAPTAIN" });
  if (pairing.player2UserId) entriesData.push({ userId: pairing.player2UserId, role: "PARTNER" });

  if (!entriesData.length) return;

  const entryIdsByUser: Record<string, number> = {};

  for (const entry of entriesData) {
    const categoryId = pairing.categoryId ?? null;
    const existing = await prisma.tournamentEntry.findFirst({
      where: { eventId: pairing.eventId, userId: entry.userId, categoryId },
      select: { id: true },
    });
    const upserted = existing
      ? await prisma.tournamentEntry.update({
          where: { id: existing.id },
          data: {
            status: TournamentEntryStatus.CONFIRMED,
            role: entry.role,
            pairingId: pairing.id,
            ownerUserId: entry.userId,
            ownerIdentityId: null,
            categoryId,
          },
        })
      : await prisma.tournamentEntry.create({
          data: {
            eventId: pairing.eventId,
            categoryId,
            userId: entry.userId,
            pairingId: pairing.id,
            role: entry.role,
            status: TournamentEntryStatus.CONFIRMED,
            ownerUserId: entry.userId,
            ownerIdentityId: null,
          },
        });
    entryIdsByUser[entry.userId] = upserted.id;
  }

  const organizationId = pairing.event?.organizationId ?? null;
  if (organizationId) {
    const now = new Date();
    const entries = Object.entries(entryIdsByUser);
    const results = await Promise.allSettled(
      entries.map(([userId, entryId]) =>
        ingestCrmInteraction({
          organizationId,
          userId,
          type: CrmInteractionType.PADEL_TOURNAMENT_ENTRY,
          sourceType: CrmInteractionSource.TOURNAMENT_ENTRY,
          sourceId: String(entryId),
          occurredAt: now,
          metadata: {
            eventId: pairing.eventId,
            pairingId: pairing.id,
            entryId,
          },
        }),
      ),
    );
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      console.warn("[padel][crm] falha ao criar interacao de torneio", failures.length);
    }
  }

  const eventTitle = pairing.event?.title?.trim() || "torneio";
  const eventSlug = pairing.event?.slug?.trim() || null;
  const uniqueUserIds = Array.from(new Set(entriesData.map((entry) => entry.userId)));
  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          eventId: pairing.eventId,
          type: NotificationType.SYSTEM_ANNOUNCE,
          title: "Inscrição confirmada",
        },
        select: { id: true },
      });
      if (existing) return;
      await createNotification({
        userId,
        type: NotificationType.SYSTEM_ANNOUNCE,
        title: "Inscrição confirmada",
        body: `A tua inscrição no ${eventTitle} ficou confirmada.`,
        eventId: pairing.eventId,
        ctaUrl: eventSlug ? `/eventos/${eventSlug}` : null,
        ctaLabel: "Ver torneio",
        priority: "NORMAL",
      });
    }),
  );

  try {
    const now = new Date();
    const [tournament, event, config, categoryLinks] = await Promise.all([
      prisma.tournament.findUnique({
        where: { eventId: pairing.eventId },
        select: { id: true, format: true, generatedAt: true, inscriptionDeadlineAt: true, config: true },
      }),
      prisma.event.findUnique({
        where: { id: pairing.eventId },
        select: { status: true, startsAt: true, padelTournamentConfig: { select: { advancedSettings: true } } },
      }),
      prisma.padelTournamentConfig.findUnique({
        where: { eventId: pairing.eventId },
        select: { advancedSettings: true, format: true },
      }),
      prisma.padelEventCategoryLink.findMany({
        where: { eventId: pairing.eventId, isEnabled: true },
        select: { padelCategoryId: true, format: true },
      }),
    ]);

    if (!tournament || tournament.generatedAt) return;
    if (event?.status === "CANCELLED") return;

    const advanced = (config?.advancedSettings || event?.padelTournamentConfig?.advancedSettings || {}) as {
      registrationEndsAt?: string | null;
    };
    const registrationEndsAt =
      advanced.registrationEndsAt && !Number.isNaN(new Date(advanced.registrationEndsAt).getTime())
        ? new Date(advanced.registrationEndsAt)
        : null;
    const canAutoGenerate =
      (registrationEndsAt && now >= registrationEndsAt) ||
      (tournament.inscriptionDeadlineAt && now >= tournament.inscriptionDeadlineAt) ||
      (event?.startsAt && now >= event.startsAt);
    if (!canAutoGenerate) return;

    const hasPadelCategories = Array.isArray(categoryLinks) && categoryLinks.length > 0;
    if (hasPadelCategories) {
      const categoryId = pairing.categoryId ?? null;
      if (categoryId === null) return;
      const linkFormat = categoryId
        ? categoryLinks.find((l) => l.padelCategoryId === categoryId)?.format ?? null
        : null;
      const configFormat = config?.format ?? null;
      const format = (linkFormat ?? configFormat ?? padel_format.TODOS_CONTRA_TODOS) as padel_format;
      const phase = format === "GRUPOS_ELIMINATORIAS" ? "GROUPS" : "KNOCKOUT";
      const result = await autoGeneratePadelMatches({
        eventId: pairing.eventId,
        categoryId,
        format,
        phase,
      });
      if (!result.ok && result.error !== "NEED_PAIRINGS") {
        console.warn("[padel][auto-generate] falhou", result.error);
      }
      return;
    }

    const configJson = (tournament.config as Record<string, unknown> | null) ?? {};
    const bracketSize = Number.isFinite((configJson as any).bracketSize)
      ? Number((configJson as any).bracketSize)
      : null;
    const pairingIds = await getConfirmedPairings(pairing.eventId);
    if (pairingIds.length < 2) return;

    await generateAndPersistTournamentStructure({
      tournamentId: tournament.id,
      format: tournament.format,
      pairings: pairingIds,
      targetSize: bracketSize ?? null,
      forceGenerate: false,
    });
    await prisma.tournamentAuditLog["create"]({
      data: {
        tournamentId: tournament.id,
        userId: null,
        action: "AUTO_GENERATE_BRACKET",
        payloadBefore: Prisma.JsonNull,
        payloadAfter: {
          format: tournament.format,
          pairings: pairingIds,
          trigger: "AUTO",
        },
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INSCRIPTION_NOT_CLOSED") return;
    if (err instanceof Error && err.message === "TOURNAMENT_ALREADY_STARTED") return;
    console.warn("[padel][auto-generate] falhou", err);
  }
}
