import { prisma } from "@/lib/prisma";
import { deliverNotificationOutboxItem } from "@/domain/notifications/consumer";

const NOTIFICATION_BATCH_SIZE = 20;
const NOTIFICATION_MAX_RETRIES = 5;
const RETRY_BACKOFF_SECONDS = [1, 3, 7, 15, 30];

function computeNextAttemptAt(retries: number, now = new Date()) {
  const idx = Math.min(Math.max(retries, 0), RETRY_BACKOFF_SECONDS.length - 1);
  const delaySeconds = RETRY_BACKOFF_SECONDS[idx];
  return new Date(now.getTime() + delaySeconds * 1000);
}

export type NotificationOutboxProcessorResult = {
  processed: number;
  failed: number;
};

export async function processNotificationOutboxBatch(limit = NOTIFICATION_BATCH_SIZE) {
  const now = new Date();
  const pending = await prisma.notificationOutbox.findMany({
    where: {
      status: { in: ["PENDING", "FAILED", "SENDING"] },
      retries: { lt: NOTIFICATION_MAX_RETRIES },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  let processed = 0;
  let failed = 0;

  for (const item of pending) {
    const claimed = await prisma.notificationOutbox.updateMany({
      where: {
        id: item.id,
        status: { in: ["PENDING", "FAILED", "SENDING"] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: { status: "SENDING", nextAttemptAt: null },
    });
    if (claimed.count === 0) continue;

    try {
      await deliverNotificationOutboxItem(item);
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null, nextAttemptAt: null },
      });
      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const nextAttemptAt = computeNextAttemptAt(item.retries + 1, new Date());
      await prisma.notificationOutbox.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          lastError: message.slice(0, 200),
          retries: { increment: 1 },
          nextAttemptAt,
        },
      });
      failed += 1;
    }
  }

  return { processed, failed } satisfies NotificationOutboxProcessorResult;
}

export function __test__computeNextAttemptAt(retries: number, now = new Date()) {
  return computeNextAttemptAt(retries, now);
}
