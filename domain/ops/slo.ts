import { prisma } from "@/lib/prisma";

const CAP_LIMIT = 1000;

export async function getOpsSlo() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last1h = new Date(now.getTime() - 60 * 60 * 1000);

  const pendingWhere = {
    publishedAt: null,
    deadLetteredAt: null,
  } as const;

  const pendingIds = await prisma.outboxEvent.findMany({
    where: pendingWhere,
    select: { eventId: true },
    take: CAP_LIMIT,
  });

  const oldestPending = await prisma.outboxEvent.findFirst({
    where: pendingWhere,
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const nextAttempt = await prisma.outboxEvent.findFirst({
    where: { ...pendingWhere, nextAttemptAt: { not: null } },
    orderBy: { nextAttemptAt: "asc" },
    select: { nextAttemptAt: true },
  });

  const deadLetteredLast24h = await prisma.outboxEvent.count({
    where: { deadLetteredAt: { gte: last24h } },
  });

  const eventLogLast1h = await prisma.eventLog.count({
    where: { createdAt: { gte: last1h } },
  });

  const oldestPendingAgeSec = oldestPending?.createdAt
    ? Math.max(0, Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 1000))
    : null;

  const nextAttemptAt = nextAttempt?.nextAttemptAt ?? null;
  const backoffLagSec = nextAttemptAt
    ? Math.floor((now.getTime() - nextAttemptAt.getTime()) / 1000)
    : null;

  return {
    ts: now.toISOString(),
    outbox: {
      pendingCountCapped: pendingIds.length,
      capLimit: CAP_LIMIT,
      oldestPendingCreatedAt: oldestPending?.createdAt?.toISOString() ?? null,
      oldestPendingAgeSec,
      nextAttemptAtSoonest: nextAttemptAt ? nextAttemptAt.toISOString() : null,
      backoffLagSec,
      deadLetteredLast24h,
    },
    eventLog: {
      last1hCount: eventLogLast1h,
    },
  };
}
