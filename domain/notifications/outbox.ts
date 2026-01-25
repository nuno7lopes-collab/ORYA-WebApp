import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type OutboxStatus = "PENDING" | "SENT" | "FAILED";

type EnqueueParams = {
  dedupeKey: string;
  userId?: string | null;
  notificationType: string;
  templateVersion?: string | null;
  payload?: Prisma.InputJsonValue;
  force?: boolean;
};

/**
 * Enqueue a notification with dedupe guarantees.
 * If the dedupeKey already exists, it returns the existing record unless force=true,
 * in which case it resets status to PENDING and updates payload/templateVersion.
 */
export async function enqueueNotification(params: EnqueueParams) {
  const {
    dedupeKey,
    userId,
    notificationType,
    templateVersion,
    payload = {},
    force = false,
  } = params;

  const existing = await prisma.notificationOutbox.findUnique({
    where: { dedupeKey },
  });
  if (existing && !force) {
    return existing;
  }

  return prisma.notificationOutbox.upsert({
    where: { dedupeKey },
    create: {
      dedupeKey,
      userId: userId ?? null,
      notificationType,
      templateVersion: templateVersion ?? null,
      payload,
      status: "PENDING",
      nextAttemptAt: null,
    },
    update: {
      userId: userId ?? null,
      notificationType,
      templateVersion: templateVersion ?? null,
      payload,
      status: "PENDING",
      retries: 0,
      lastError: null,
      sentAt: null,
      nextAttemptAt: null,
    },
  });
}

export async function markOutboxSent(id: string) {
  return prisma.notificationOutbox.update({
    where: { id },
    data: { status: "SENT", sentAt: new Date(), lastError: null },
  });
}

export async function markOutboxFailed(id: string, error: string) {
  return prisma.notificationOutbox.update({
    where: { id },
    data: { status: "FAILED", lastError: error, retries: { increment: 1 } },
  });
}
