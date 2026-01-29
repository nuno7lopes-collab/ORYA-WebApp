import { prisma } from "@/lib/prisma";

export async function getOpsHealth() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [
      outboxPending,
      outboxDeadLettered,
      operationsFailed,
      operationsDead,
      paymentErrors,
    ] = await Promise.all([
      prisma.outboxEvent.count({
        where: { publishedAt: null, deadLetteredAt: null },
      }),
      prisma.outboxEvent.count({
        where: { deadLetteredAt: { gte: since } },
      }),
      prisma.operation.count({
        where: { status: "FAILED" },
      }),
      prisma.operation.count({
        where: { status: "DEAD_LETTER" },
      }),
      prisma.paymentEvent.count({
        where: { status: "ERROR", updatedAt: { gte: since } },
      }),
    ]);
    return {
      ok: true,
      ts: new Date().toISOString(),
      db: { ok: true, latencyMs: Date.now() - startedAt },
      outbox: {
        pendingCount: outboxPending,
        deadLetteredLast24h: outboxDeadLettered,
      },
      operations: {
        failedCount: operationsFailed,
        deadLetterCount: operationsDead,
      },
      payments: {
        errorEventsLast24h: paymentErrors,
      },
    };
  } catch {
    return {
      ok: false,
      ts: new Date().toISOString(),
      db: { ok: false, latencyMs: Date.now() - startedAt },
    };
  }
}
