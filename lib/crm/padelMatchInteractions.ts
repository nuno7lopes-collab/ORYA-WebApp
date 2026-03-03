import { CrmInteractionSource, CrmInteractionType } from "@prisma/client";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import {
  buildPadelExternalId,
  validatePadelInteractionMetadata,
} from "@/lib/crm/padelEventContract";
import { logError } from "@/lib/observability/logger";

type PadelMatchParticipantCrm = {
  participantId: number;
  side: "A" | "B";
  userId: string | null;
};

type IngestPadelMatchInteractionsParams = {
  organizationId: number;
  eventId: number;
  categoryId: number | null;
  matchId: number;
  winnerSide: "A" | "B" | null;
  resultType: string;
  statusVersion: string | number;
  participants: PadelMatchParticipantCrm[];
  occurredAt?: Date;
};

type IngestPadelMatchInteractionsResult = {
  playedEmitted: number;
  outcomesEmitted: number;
  skippedWithoutUser: number;
  errors: number;
};

function buildMatchMetadata(params: {
  matchId: number;
  eventId: number;
  categoryId: number | null;
  winnerSide: "A" | "B" | null;
  resultType: string;
  participantIds: number[];
  participantId: number;
  statusVersion: string;
}) {
  return {
    matchId: params.matchId,
    eventId: params.eventId,
    categoryId: params.categoryId,
    resultType: params.resultType,
    winnerSide: params.winnerSide ?? "NONE",
    participantIds: params.participantIds,
    participantId: params.participantId,
    statusVersion: params.statusVersion,
  };
}

export async function ingestPadelMatchInteractions(
  params: IngestPadelMatchInteractionsParams,
): Promise<IngestPadelMatchInteractionsResult> {
  const occurredAt = params.occurredAt ?? new Date();
  const statusVersion = String(params.statusVersion);
  const participantIds = Array.from(
    new Set(params.participants.map((participant) => participant.participantId)),
  ).sort((a, b) => a - b);

  const result: IngestPadelMatchInteractionsResult = {
    playedEmitted: 0,
    outcomesEmitted: 0,
    skippedWithoutUser: 0,
    errors: 0,
  };

  for (const participant of params.participants) {
    if (!participant.userId) {
      result.skippedWithoutUser += 1;
      continue;
    }

    const matchMetadata = buildMatchMetadata({
      matchId: params.matchId,
      eventId: params.eventId,
      categoryId: params.categoryId,
      winnerSide: params.winnerSide,
      resultType: params.resultType,
      participantIds,
      participantId: participant.participantId,
      statusVersion,
    });

    try {
      const playedValidation = validatePadelInteractionMetadata(
        CrmInteractionType.PADEL_MATCH_PLAYED,
        matchMetadata,
      );
      if (!playedValidation.ok) {
        logError(
          "crm.padel.match_played_metadata_invalid",
          new Error("CRM_PADEL_MATCH_PLAYED_METADATA_INVALID"),
          {
            organizationId: params.organizationId,
            matchId: params.matchId,
            participantId: participant.participantId,
            missing: playedValidation.missing,
          },
        );
      } else {
        await ingestCrmInteraction({
          organizationId: params.organizationId,
          userId: participant.userId,
          type: CrmInteractionType.PADEL_MATCH_PLAYED,
          sourceType: CrmInteractionSource.EVENT,
          sourceId: String(params.matchId),
          externalId: buildPadelExternalId(
            CrmInteractionType.PADEL_MATCH_PLAYED,
            CrmInteractionSource.EVENT,
            params.matchId,
            participant.participantId,
            statusVersion,
          ),
          occurredAt,
          metadata: matchMetadata,
        });
        result.playedEmitted += 1;
      }

      if (!params.winnerSide) {
        continue;
      }
      const outcomeType =
        participant.side === params.winnerSide
          ? CrmInteractionType.PADEL_MATCH_WIN
          : CrmInteractionType.PADEL_MATCH_LOSS;
      const outcomeValidation = validatePadelInteractionMetadata(
        outcomeType,
        matchMetadata,
      );
      if (!outcomeValidation.ok) {
        logError(
          "crm.padel.match_outcome_metadata_invalid",
          new Error("CRM_PADEL_MATCH_OUTCOME_METADATA_INVALID"),
          {
            organizationId: params.organizationId,
            matchId: params.matchId,
            participantId: participant.participantId,
            outcomeType,
            missing: outcomeValidation.missing,
          },
        );
        continue;
      }

      await ingestCrmInteraction({
        organizationId: params.organizationId,
        userId: participant.userId,
        type: outcomeType,
        sourceType: CrmInteractionSource.EVENT,
        sourceId: String(params.matchId),
        externalId: buildPadelExternalId(
          outcomeType,
          CrmInteractionSource.EVENT,
          params.matchId,
          participant.participantId,
          statusVersion,
        ),
        occurredAt,
        metadata: matchMetadata,
      });
      result.outcomesEmitted += 1;
    } catch (err) {
      result.errors += 1;
      logError("crm.padel.match_interactions_ingest_failed", err, {
        organizationId: params.organizationId,
        matchId: params.matchId,
        participantId: participant.participantId,
      });
    }
  }

  return result;
}
