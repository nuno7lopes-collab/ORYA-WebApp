import { Prisma, PadelRatingSanctionType } from "@prisma/client";
import { applyPadelRatingSanction } from "@/domain/padel/ratingEngine";

type DbClient = Prisma.TransactionClient;

const INVALID_DISPUTE_THRESHOLD = 3;
const NON_VALIDATED_THRESHOLD = 5;
const AUTO_SUSPENSION_DAYS = 15;

const REASON_INVALID_DISPUTE = "AUTO_INVALID_DISPUTES_THRESHOLD";
const REASON_NON_VALIDATED = "AUTO_NON_VALIDATED_THRESHOLD";

type CounterRow = {
  open_count: bigint | number | null;
  invalid_count: bigint | number | null;
};

export type PadelAntiFraudAction =
  | {
      kind: "APPLIED";
      sanctionId: number;
      sanctionType: PadelRatingSanctionType;
      reasonCode: string;
      playerId: number;
      openDisputesCount: number;
      invalidDisputesCount: number;
    }
  | {
      kind: "RESOLVED";
      sanctionType: "BLOCK_NEW_MATCHES";
      reasonCode: string;
      playerId: number;
      openDisputesCount: number;
      invalidDisputesCount: number;
      resolvedCount: number;
    };

const toInt = (value: bigint | number | null | undefined) => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  return 0;
};

async function loadDisputeCounters(tx: DbClient, organizationId: number, userId: string) {
  const rows = await tx.$queryRaw<CounterRow[]>(Prisma.sql`
    SELECT
      COALESCE(SUM(CASE WHEN m.score->>'disputeStatus' = 'OPEN' THEN 1 ELSE 0 END), 0)::bigint AS open_count,
      COALESCE(
        SUM(
          CASE
            WHEN m.score->>'disputeStatus' = 'RESOLVED'
              AND COALESCE(m.score->>'disputeResolutionStatus', '') IN ('CONFIRMED', 'VOIDED')
            THEN 1
            ELSE 0
          END
        ),
        0
      )::bigint AS invalid_count
    FROM app_v3.padel_matches m
    INNER JOIN app_v3.events e ON e.id = m.event_id
    WHERE e.organization_id = ${organizationId}
      AND m.score->>'disputedBy' = ${userId}
  `);

  const row = rows[0];
  return {
    openDisputesCount: toInt(row?.open_count),
    invalidDisputesCount: toInt(row?.invalid_count),
  };
}

async function hasActiveSanction(params: {
  tx: DbClient;
  organizationId: number;
  playerId: number;
  type: PadelRatingSanctionType;
  now: Date;
  reasonCode?: string;
}) {
  const { tx, organizationId, playerId, type, now, reasonCode } = params;
  const sanction = await tx.padelRatingSanction.findFirst({
    where: {
      organizationId,
      playerId,
      type,
      status: "ACTIVE",
      ...(reasonCode ? { reasonCode } : {}),
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: { id: true },
  });
  return sanction?.id ?? null;
}

export async function reconcilePadelDisputeAntiFraud(params: {
  tx: DbClient;
  organizationId: number;
  userId: string;
  actorUserId?: string | null;
}) {
  const { tx, organizationId, userId, actorUserId } = params;
  const player = await tx.padelPlayerProfile.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (!player) return [] as PadelAntiFraudAction[];

  const actions: PadelAntiFraudAction[] = [];
  const now = new Date();
  const counters = await loadDisputeCounters(tx, organizationId, userId);
  const { openDisputesCount, invalidDisputesCount } = counters;

  if (invalidDisputesCount >= INVALID_DISPUTE_THRESHOLD) {
    const hasSuspension = await hasActiveSanction({
      tx,
      organizationId,
      playerId: player.id,
      type: "SUSPENSION",
      now,
    });
    if (!hasSuspension) {
      const sanction = await applyPadelRatingSanction({
        tx,
        organizationId,
        playerId: player.id,
        type: "SUSPENSION",
        reasonCode: REASON_INVALID_DISPUTE,
        reason: "Threshold automático de disputas inválidas atingido.",
        actorUserId: actorUserId ?? null,
        durationDays: AUTO_SUSPENSION_DAYS,
      });
      actions.push({
        kind: "APPLIED",
        sanctionId: sanction.id,
        sanctionType: sanction.type,
        reasonCode: sanction.reasonCode ?? REASON_INVALID_DISPUTE,
        playerId: player.id,
        openDisputesCount,
        invalidDisputesCount,
      });
    }
  }

  if (openDisputesCount >= NON_VALIDATED_THRESHOLD) {
    const hasBlock = await hasActiveSanction({
      tx,
      organizationId,
      playerId: player.id,
      type: "BLOCK_NEW_MATCHES",
      now,
    });
    if (!hasBlock) {
      const sanction = await applyPadelRatingSanction({
        tx,
        organizationId,
        playerId: player.id,
        type: "BLOCK_NEW_MATCHES",
        reasonCode: REASON_NON_VALIDATED,
        reason: "Threshold automático de jogos não-validados pendentes atingido.",
        actorUserId: actorUserId ?? null,
      });
      actions.push({
        kind: "APPLIED",
        sanctionId: sanction.id,
        sanctionType: sanction.type,
        reasonCode: sanction.reasonCode ?? REASON_NON_VALIDATED,
        playerId: player.id,
        openDisputesCount,
        invalidDisputesCount,
      });
    } else {
      await tx.padelRatingProfile.updateMany({
        where: { organizationId, playerId: player.id },
        data: { blockedNewMatches: true },
      });
    }
  } else {
    const activeAutoBlocks = await tx.padelRatingSanction.findMany({
      where: {
        organizationId,
        playerId: player.id,
        type: "BLOCK_NEW_MATCHES",
        status: "ACTIVE",
        reasonCode: REASON_NON_VALIDATED,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (activeAutoBlocks.length > 0) {
      await tx.padelRatingSanction.updateMany({
        where: { id: { in: activeAutoBlocks.map((item) => item.id) } },
        data: {
          status: "RESOLVED",
          resolvedByUserId: actorUserId ?? null,
          resolvedAt: now,
        },
      });

      const stillActiveBlocks = await tx.padelRatingSanction.count({
        where: {
          organizationId,
          playerId: player.id,
          type: "BLOCK_NEW_MATCHES",
          status: "ACTIVE",
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      });
      if (stillActiveBlocks === 0) {
        await tx.padelRatingProfile.updateMany({
          where: { organizationId, playerId: player.id },
          data: { blockedNewMatches: false },
        });
      }

      actions.push({
        kind: "RESOLVED",
        sanctionType: "BLOCK_NEW_MATCHES",
        reasonCode: REASON_NON_VALIDATED,
        playerId: player.id,
        openDisputesCount,
        invalidDisputesCount,
        resolvedCount: activeAutoBlocks.length,
      });
    }
  }

  return actions;
}

