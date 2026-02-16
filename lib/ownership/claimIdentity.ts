import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { saleSummaryRepo } from "@/domain/finance/readModelConsumer";
import { normalizeEmail } from "@/lib/utils/email";

const MERGE_REASON = "EMAIL_VERIFIED_CLAIM";
const TRIGGER_SOURCE = "AUTH_VERIFY";

type MergeStatus = "SUCCEEDED" | "NOOP_ALREADY_MERGED" | "FAILED";

type ClaimIdentityOptions = {
  requireVerified?: boolean;
  mergedBy?: string | null;
};

function emailHashHmac(emailNormalized: string) {
  const secret =
    process.env.IDENTITY_EMAIL_HMAC_KEY?.trim() ||
    process.env.QR_SECRET_KEY?.trim() ||
    "identity-merge-local-dev";
  return crypto.createHmac("sha256", secret).update(emailNormalized).digest("hex");
}

async function writeMergeLog(params: {
  tx: any;
  idempotencyKey: string;
  fromIdentityId: string;
  toIdentityId: string;
  emailNormalized: string;
  emailHash: string;
  status: MergeStatus;
  mergedBy?: string | null;
  artifactsMoved?: Record<string, number>;
  failureCode?: string | null;
}) {
  const { tx } = params;
  if (!tx.identityMergeLog || typeof tx.identityMergeLog.upsert !== "function") return null;

  return tx.identityMergeLog.upsert({
    where: { idempotencyKey: params.idempotencyKey },
    create: {
      fromIdentityId: params.fromIdentityId,
      toIdentityId: params.toIdentityId,
      reason: MERGE_REASON,
      emailNormalized: params.emailNormalized,
      emailHashHmac: params.emailHash,
      triggerSource: TRIGGER_SOURCE,
      idempotencyKey: params.idempotencyKey,
      mergedBy: params.mergedBy ?? null,
      status: params.status,
      artifactsMoved: params.artifactsMoved ?? {},
      failureCode: params.failureCode ?? null,
    },
    update: {
      toIdentityId: params.toIdentityId,
      status: params.status,
      mergedBy: params.mergedBy ?? null,
      artifactsMoved: params.artifactsMoved ?? {},
      failureCode: params.failureCode ?? null,
      mergedAt: new Date(),
    },
  });
}

// Claim automático: quando email é verificado, transfere ownership para userId.
export async function claimIdentity(email: string, userId: string, opts?: ClaimIdentityOptions) {
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized) return;
  const client: any = prisma as any;
  if (!client.emailIdentity || typeof client.emailIdentity.findUnique !== "function") return;

  const sourceIdentity = await client.emailIdentity.findUnique({
    where: { emailNormalized },
    select: { id: true, emailNormalized: true, userId: true, emailVerifiedAt: true, createdAt: true },
  });
  if (!sourceIdentity) return;

  if (opts?.requireVerified && !sourceIdentity.emailVerifiedAt) {
    // Sem email verificado, não fazemos claim.
    return;
  }

  const emailHash = emailHashHmac(emailNormalized);
  const idempotencyKey = `identity-claim:${userId}:${emailHash}`;

  // Caso inválido: identidade já ligada a outro utilizador.
  if (sourceIdentity.userId && sourceIdentity.userId !== userId) {
    await prisma.$transaction(async (tx) => {
      await writeMergeLog({
        tx,
        idempotencyKey,
        fromIdentityId: sourceIdentity.id,
        toIdentityId: sourceIdentity.id,
        emailNormalized,
        emailHash,
        status: "FAILED",
        mergedBy: opts?.mergedBy ?? null,
        failureCode: "IDENTITY_BOUND_TO_OTHER_USER",
      });
    });
    return;
  }

  const targetIdentity =
    (await client.emailIdentity.findFirst({
      where: { userId },
      orderBy: [{ emailVerifiedAt: "desc" }, { createdAt: "asc" }],
      select: { id: true, userId: true, emailVerifiedAt: true },
    })) ?? sourceIdentity;

  await prisma.$transaction(async (tx) => {
    if (targetIdentity.id === sourceIdentity.id) {
      const shouldUpdateIdentity =
        sourceIdentity.userId !== userId ||
        (!sourceIdentity.emailVerifiedAt && Boolean(opts?.requireVerified));

      if (shouldUpdateIdentity) {
        await tx.emailIdentity.update({
          where: { id: sourceIdentity.id },
          data: {
            userId,
            emailVerifiedAt: sourceIdentity.emailVerifiedAt ?? new Date(),
          },
        });
      }

      await writeMergeLog({
        tx,
        idempotencyKey,
        fromIdentityId: sourceIdentity.id,
        toIdentityId: sourceIdentity.id,
        emailNormalized,
        emailHash,
        status: shouldUpdateIdentity ? "SUCCEEDED" : "NOOP_ALREADY_MERGED",
        mergedBy: opts?.mergedBy ?? null,
        artifactsMoved: {
          tickets: 0,
          entitlements: 0,
          tournamentEntries: 0,
          saleSummaries: 0,
          chatInvites: 0,
          crmContacts: 0,
        },
      });
      return;
    }

    const existingTombstone =
      tx.identityTombstone && typeof tx.identityTombstone.findUnique === "function"
        ? await tx.identityTombstone.findUnique({
            where: { fromIdentityId: sourceIdentity.id },
            select: { toIdentityId: true },
          })
        : null;

    if (existingTombstone && existingTombstone.toIdentityId !== targetIdentity.id) {
      await writeMergeLog({
        tx,
        idempotencyKey,
        fromIdentityId: sourceIdentity.id,
        toIdentityId: existingTombstone.toIdentityId,
        emailNormalized,
        emailHash,
        status: "FAILED",
        mergedBy: opts?.mergedBy ?? null,
        failureCode: "TOMBSTONE_TARGET_MISMATCH",
      });
      return;
    }

    const movedTickets = await tx.ticket.updateMany({
      where: { ownerIdentityId: sourceIdentity.id },
      data: { ownerIdentityId: targetIdentity.id, ownerUserId: userId },
    });
    const movedEntitlements = await tx.entitlement.updateMany({
      where: { ownerIdentityId: sourceIdentity.id },
      data: { ownerIdentityId: targetIdentity.id, ownerKey: `identity:${targetIdentity.id}` },
    });
    const movedTournamentEntries = await tx.tournamentEntry.updateMany({
      where: { ownerIdentityId: sourceIdentity.id },
      data: { ownerIdentityId: targetIdentity.id, ownerUserId: userId },
    });
    const movedSaleSummaries = await saleSummaryRepo(tx).updateMany({
      where: { ownerIdentityId: sourceIdentity.id },
      data: { ownerIdentityId: targetIdentity.id, ownerUserId: userId },
    });
    const movedChatInvites = await tx.chatInvite.updateMany({
      where: { ownerIdentityId: sourceIdentity.id },
      data: { ownerIdentityId: targetIdentity.id },
    });
    const movedCrmContacts = await tx.crmContact.updateMany({
      where: { emailIdentityId: sourceIdentity.id },
      data: { emailIdentityId: targetIdentity.id },
    });

    await tx.emailIdentity.update({
      where: { id: targetIdentity.id },
      data: {
        userId,
        emailVerifiedAt: targetIdentity.emailVerifiedAt ?? sourceIdentity.emailVerifiedAt ?? new Date(),
      },
    });

    const mergeLog = await writeMergeLog({
      tx,
      idempotencyKey,
      fromIdentityId: sourceIdentity.id,
      toIdentityId: targetIdentity.id,
      emailNormalized,
      emailHash,
      status: existingTombstone ? "NOOP_ALREADY_MERGED" : "SUCCEEDED",
      mergedBy: opts?.mergedBy ?? null,
      artifactsMoved: {
        tickets: movedTickets.count,
        entitlements: movedEntitlements.count,
        tournamentEntries: movedTournamentEntries.count,
        saleSummaries: movedSaleSummaries.count,
        chatInvites: movedChatInvites.count,
        crmContacts: movedCrmContacts.count,
      },
    });

    if (tx.identityTombstone && typeof tx.identityTombstone.upsert === "function") {
      await tx.identityTombstone.upsert({
        where: { fromIdentityId: sourceIdentity.id },
        create: {
          fromIdentityId: sourceIdentity.id,
          toIdentityId: targetIdentity.id,
          mergeId: mergeLog?.id ?? null,
          reason: MERGE_REASON,
          createdBy: opts?.mergedBy ?? null,
          metadata: {
            triggerSource: TRIGGER_SOURCE,
            idempotencyKey,
          },
        },
        update: {
          toIdentityId: targetIdentity.id,
          mergeId: mergeLog?.id ?? null,
          reason: MERGE_REASON,
          createdBy: opts?.mergedBy ?? null,
          metadata: {
            triggerSource: TRIGGER_SOURCE,
            idempotencyKey,
          },
        },
      });
    }
  });
}
