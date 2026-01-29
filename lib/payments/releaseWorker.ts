import { prisma } from "@/lib/prisma";
import {
  createTransfer,
  retrieveStripeAccount,
} from "@/domain/finance/gateway/stripeGateway";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { sendImportantUpdateEmail } from "@/lib/emailSender";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { PendingPayoutStatus, Prisma, NotificationType } from "@prisma/client";
import { logFinanceError } from "@/lib/observability/finance";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmail";
import { logWarn } from "@/lib/observability/logger";

type ReleaseResult = {
  id: number;
  status: "RELEASED" | "SKIPPED" | "FAILED";
  transferId?: string | null;
  error?: string;
};

const DEFAULT_RETRY_MINUTES = 10;
const INSUFFICIENT_BALANCE_RETRY_MINUTES = 60;
const ONBOARDING_RETRY_MINUTES = 6 * 60;
const ACTION_REQUIRED_ALERT_HOURS = 24;
const ACTION_REQUIRED_TITLE = "Conta de pagamentos incompleta";
const ACTION_REQUIRED_BODY =
  "Conta de pagamentos incompleta - completa o onboarding Stripe para receberes o payout pendente.";
const ACTION_REQUIRED_CTA_URL = "/organizacao/pagamentos";
const ACTION_REQUIRED_CTA_LABEL = "Completar Stripe";

function resolveRetryMinutes(err: unknown) {
  const anyErr = err as { code?: string; type?: string; message?: string };
  if (anyErr?.code === "balance_insufficient") return INSUFFICIENT_BALANCE_RETRY_MINUTES;
  if (anyErr?.type === "StripeAPIError") return DEFAULT_RETRY_MINUTES;
  return DEFAULT_RETRY_MINUTES;
}

function normalizeErrorReason(err: unknown) {
  const anyErr = err as { code?: string; type?: string; message?: string };
  if (anyErr?.code) return anyErr.code;
  if (anyErr?.type) return anyErr.type;
  return anyErr?.message ?? "UNKNOWN_ERROR";
}

async function isConnectedAccountReady(accountId: string) {
  const account = await retrieveStripeAccount(accountId);
  const payoutsEnabled = account.payouts_enabled ?? false;
  const detailsSubmitted = account.details_submitted ?? false;
  const requirementsDue = account.requirements?.currently_due ?? [];
  const transfersCapability = account.capabilities?.transfers;
  const transfersEnabled = (account as { transfers_enabled?: boolean }).transfers_enabled;
  const transfersActive = transfersCapability ? transfersCapability === "active" : true;
  if (transfersEnabled === false) return false;
  return payoutsEnabled && detailsSubmitted && requirementsDue.length === 0 && transfersActive;
}

function shouldAttemptRetry(payout: { nextAttemptAt: Date | null }, now: Date) {
  if (!payout.nextAttemptAt) return true;
  return payout.nextAttemptAt.getTime() <= now.getTime();
}

async function hasRecentActionRequiredNotification(payoutId: number, since: Date) {
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT id
      FROM app_v3.notifications
      WHERE type = 'STRIPE_STATUS'::app_v3."NotificationType"
        AND payload->>'payoutId' = ${String(payoutId)}
        AND created_at >= ${since}
      LIMIT 1
    `,
  );
  return rows.length > 0;
}

function resolveAlertsTarget(org: {
  officialEmail?: string | null;
  officialEmailVerifiedAt?: Date | null;
  alertsEmail?: string | null;
}) {
  const normalized = normalizeOfficialEmail(org.officialEmail ?? null);
  if (org.officialEmailVerifiedAt && normalized) return normalized;
  if (typeof org.alertsEmail === "string" && org.alertsEmail.trim().length > 0) {
    return org.alertsEmail.trim();
  }
  return null;
}

async function monitorActionRequired(now: Date) {
  const threshold = new Date(now.getTime() - ACTION_REQUIRED_ALERT_HOURS * 60 * 60 * 1000);
  const stuck = await prisma.pendingPayout.findMany({
    where: {
      status: PendingPayoutStatus.HELD,
      blockedReason: { startsWith: "ACTION_REQUIRED" },
      holdUntil: { lte: threshold },
    },
    select: {
      id: true,
      paymentIntentId: true,
      recipientConnectAccountId: true,
      blockedReason: true,
      holdUntil: true,
      updatedAt: true,
    },
    take: 25,
  });

  if (stuck.length === 0) return;

  const accountIds = Array.from(
    new Set(
      stuck
        .map((p) => p.recipientConnectAccountId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const organizations = accountIds.length
    ? await prisma.organization.findMany({
        where: { stripeAccountId: { in: accountIds } },
        select: {
          id: true,
          publicName: true,
          username: true,
          stripeAccountId: true,
          alertsEmail: true,
          alertsPayoutEnabled: true,
          officialEmail: true,
          officialEmailVerifiedAt: true,
        },
      })
    : [];
  const orgByAccount = new Map(organizations.map((org) => [org.stripeAccountId, org]));
  const orgIds = organizations.map((org) => org.id);
  const members = orgIds.length
    ? await prisma.organizationMember.findMany({
        where: { organizationId: { in: orgIds }, role: { in: ["OWNER", "CO_OWNER", "ADMIN"] } },
        select: { organizationId: true, userId: true },
      })
    : [];
  const membersByOrg = new Map<number, Set<string>>();
  for (const member of members) {
    const bucket = membersByOrg.get(member.organizationId) ?? new Set<string>();
    bucket.add(member.userId);
    membersByOrg.set(member.organizationId, bucket);
  }

  for (const payout of stuck) {
    logFinanceError("payout", new Error("ACTION_REQUIRED_STALE"), {
      payoutId: payout.id,
      paymentIntentId: payout.paymentIntentId,
      recipientConnectAccountId: payout.recipientConnectAccountId,
      blockedReason: payout.blockedReason,
      holdUntil: payout.holdUntil,
      updatedAt: payout.updatedAt,
    });

    if (!payout.recipientConnectAccountId) continue;
    const organization = orgByAccount.get(payout.recipientConnectAccountId);
    if (!organization) continue;
    const notifiedRecently = await hasRecentActionRequiredNotification(payout.id, threshold);
    if (notifiedRecently) continue;

    try {
      const recipients = membersByOrg.get(organization.id) ?? new Set<string>();
      await Promise.all(
        Array.from(recipients).map(async (uid) => {
          if (!(await shouldNotify(uid, NotificationType.STRIPE_STATUS))) return;
          await createNotification({
            userId: uid,
            type: NotificationType.STRIPE_STATUS,
            title: ACTION_REQUIRED_TITLE,
            body: ACTION_REQUIRED_BODY,
            ctaUrl: ACTION_REQUIRED_CTA_URL,
            ctaLabel: ACTION_REQUIRED_CTA_LABEL,
            priority: "HIGH",
            organizationId: organization.id,
            payload: {
              payoutId: payout.id,
              recipientConnectAccountId: payout.recipientConnectAccountId,
              blockedReason: payout.blockedReason,
              status: "ACTION_REQUIRED",
            },
          });
        }),
      );

      const alertsTarget = resolveAlertsTarget(organization);
      if (organization.alertsPayoutEnabled && alertsTarget) {
        try {
          const baseUrl = getAppBaseUrl();
          await sendImportantUpdateEmail({
            to: alertsTarget,
            eventTitle: organization.publicName ?? "Pagamentos ORYA",
            message: ACTION_REQUIRED_BODY,
            ticketUrl: `${baseUrl}${ACTION_REQUIRED_CTA_URL}`,
          });
        } catch (err) {
          logWarn("payouts.action_required.email_failed", {
            payoutId: payout.id,
            organizationId: organization.id,
            error: err,
          });
        }
      }
    } catch (err) {
      logWarn("payouts.action_required.notify_failed", {
        payoutId: payout.id,
        organizationId: organization.id,
        error: err,
      });
    }
  }
}

function maybeAlertRetryThreshold(payoutId: number, retryCount: number, reason: string) {
  if (retryCount < 3) return;
  logFinanceError("payout", new Error("PAYOUT_RETRY_THRESHOLD"), {
    payoutId,
    retryCount,
    reason,
  });
}

export async function releaseSinglePayout(payoutId: number, options?: { force?: boolean }): Promise<ReleaseResult> {
  const now = new Date();
  const payout = await prisma.pendingPayout.findUnique({ where: { id: payoutId } });
  if (!payout) return { id: payoutId, status: "FAILED", error: "NOT_FOUND" };

  const allowedStatuses: PendingPayoutStatus[] = options?.force
    ? [PendingPayoutStatus.HELD, PendingPayoutStatus.BLOCKED]
    : [PendingPayoutStatus.HELD];

  if (!options?.force) {
    if (payout.holdUntil.getTime() > now.getTime()) {
      return { id: payoutId, status: "SKIPPED", error: "NOT_DUE" };
    }
    if (!shouldAttemptRetry(payout, now)) {
      return { id: payoutId, status: "SKIPPED", error: "RETRY_SCHEDULED" };
    }
  }

  if (!allowedStatuses.includes(payout.status)) {
    return { id: payoutId, status: "SKIPPED", error: `INVALID_STATUS_${payout.status}` };
  }

  const claimWhere: Parameters<typeof prisma.pendingPayout.updateMany>[0]["where"] = {
    id: payout.id,
    status: { in: allowedStatuses },
  };
  if (!options?.force) {
    claimWhere.OR = [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }];
  }

  const claimed = await prisma.pendingPayout.updateMany({
    where: claimWhere,
    data: { status: PendingPayoutStatus.RELEASING, blockedReason: null, nextAttemptAt: null },
  });
  if (claimed.count === 0) {
    return { id: payout.id, status: "SKIPPED", error: "CLAIM_FAILED" };
  }

  if (!payout.recipientConnectAccountId || payout.amountCents <= 0) {
    await prisma.pendingPayout.update({
      where: { id: payout.id },
      data: {
        status: PendingPayoutStatus.CANCELLED,
        blockedReason: "INVALID_RECIPIENT_OR_AMOUNT",
      },
    });
    return { id: payout.id, status: "FAILED", error: "INVALID_RECIPIENT_OR_AMOUNT" };
  }

  try {
    const isReady = await isConnectedAccountReady(payout.recipientConnectAccountId);
    if (!isReady) {
      const nextAttemptAt = new Date(now.getTime() + ONBOARDING_RETRY_MINUTES * 60 * 1000);
      const nextRetryCount = payout.retryCount + 1;
      await prisma.pendingPayout.update({
        where: { id: payout.id },
        data: {
          status: PendingPayoutStatus.HELD,
          nextAttemptAt,
          retryCount: nextRetryCount,
          blockedReason: "ACTION_REQUIRED:CONNECT_ONBOARDING_INCOMPLETE",
        },
      });
      logWarn("payouts.release.account_not_ready", {
        payoutId: payout.id,
        accountId: payout.recipientConnectAccountId,
      });
      maybeAlertRetryThreshold(payout.id, nextRetryCount, "CONNECT_ONBOARDING_INCOMPLETE");
      return { id: payout.id, status: "FAILED", error: "CONNECT_ONBOARDING_INCOMPLETE" };
    }

    const transfer = await createTransfer(
      {
        amount: payout.amountCents,
        currency: payout.currency.toLowerCase(),
        destination: payout.recipientConnectAccountId,
        transfer_group: payout.paymentIntentId ?? undefined,
      },
      {
        idempotencyKey: `payout_${payout.id}`,
        requireStripe: true,
        org: {
          stripeAccountId: payout.recipientConnectAccountId,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          orgType: null,
        },
      },
    );

    await prisma.pendingPayout.update({
      where: { id: payout.id },
      data: {
        status: PendingPayoutStatus.RELEASED,
        transferId: transfer.id,
        releasedAt: new Date(),
        blockedReason: null,
        nextAttemptAt: null,
      },
    });

    return { id: payout.id, status: "RELEASED", transferId: transfer.id };
  } catch (err) {
    const retryMinutes = resolveRetryMinutes(err);
    const nextAttemptAt = new Date(now.getTime() + retryMinutes * 60 * 1000);
    const reason = normalizeErrorReason(err);
    const nextRetryCount = payout.retryCount + 1;
    await prisma.pendingPayout.update({
      where: { id: payout.id },
      data: {
        status: PendingPayoutStatus.HELD,
        nextAttemptAt,
        retryCount: nextRetryCount,
        blockedReason: reason.slice(0, 180),
      },
    });
    logWarn("payouts.release.transfer_failed_retry", {
      payoutId: payout.id,
      retryMinutes,
      reason,
    });
    maybeAlertRetryThreshold(payout.id, nextRetryCount, reason);
    return { id: payout.id, status: "FAILED", error: reason };
  }
}

export async function releaseDuePayouts(limit = 25): Promise<ReleaseResult[]> {
  const now = new Date();
  await monitorActionRequired(now);
  const due = await prisma.pendingPayout.findMany({
    where: {
      status: PendingPayoutStatus.HELD,
      holdUntil: { lte: now },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { holdUntil: "asc" },
    take: limit,
  });

  const results: ReleaseResult[] = [];

  for (const payout of due) {
    // Claim idempotente (HELD -> RELEASING) para evitar corridas entre workers.
    const claimed = await prisma.pendingPayout.updateMany({
      where: {
        id: payout.id,
        status: PendingPayoutStatus.HELD,
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      data: { status: PendingPayoutStatus.RELEASING, blockedReason: null, nextAttemptAt: null },
    });
    if (claimed.count === 0) {
      results.push({ id: payout.id, status: "SKIPPED" });
      continue;
    }

    if (!payout.recipientConnectAccountId || payout.amountCents <= 0) {
      await prisma.pendingPayout.update({
        where: { id: payout.id },
        data: {
          status: PendingPayoutStatus.CANCELLED,
          blockedReason: "INVALID_RECIPIENT_OR_AMOUNT",
        },
      });
      results.push({ id: payout.id, status: "FAILED", error: "INVALID_RECIPIENT_OR_AMOUNT" });
      continue;
    }

    try {
      const isReady = await isConnectedAccountReady(payout.recipientConnectAccountId);
      if (!isReady) {
        const nextAttemptAt = new Date(now.getTime() + ONBOARDING_RETRY_MINUTES * 60 * 1000);
        const nextRetryCount = payout.retryCount + 1;
        await prisma.pendingPayout.update({
          where: { id: payout.id },
          data: {
            status: PendingPayoutStatus.HELD,
            nextAttemptAt,
            retryCount: nextRetryCount,
            blockedReason: "ACTION_REQUIRED:CONNECT_ONBOARDING_INCOMPLETE",
          },
        });
        logWarn("payouts.release.account_not_ready", {
          payoutId: payout.id,
          accountId: payout.recipientConnectAccountId,
        });
        maybeAlertRetryThreshold(payout.id, nextRetryCount, "CONNECT_ONBOARDING_INCOMPLETE");
        results.push({ id: payout.id, status: "FAILED", error: "CONNECT_ONBOARDING_INCOMPLETE" });
        continue;
      }

      const transfer = await createTransfer(
        {
          amount: payout.amountCents,
          currency: payout.currency.toLowerCase(),
          destination: payout.recipientConnectAccountId,
          transfer_group: payout.paymentIntentId ?? undefined,
        },
        {
          idempotencyKey: `payout_${payout.id}`,
          requireStripe: true,
          org: {
            stripeAccountId: payout.recipientConnectAccountId,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            orgType: null,
          },
        },
      );

      await prisma.pendingPayout.update({
        where: { id: payout.id },
        data: {
          status: PendingPayoutStatus.RELEASED,
          transferId: transfer.id,
          releasedAt: new Date(),
          blockedReason: null,
          nextAttemptAt: null,
        },
      });

      results.push({ id: payout.id, status: "RELEASED", transferId: transfer.id });
    } catch (err) {
      const retryMinutes = resolveRetryMinutes(err);
      const nextAttemptAt = new Date(now.getTime() + retryMinutes * 60 * 1000);
      const reason = normalizeErrorReason(err);
      const nextRetryCount = payout.retryCount + 1;
      await prisma.pendingPayout.update({
        where: { id: payout.id },
        data: {
          status: PendingPayoutStatus.HELD,
          nextAttemptAt,
          retryCount: nextRetryCount,
          blockedReason: reason.slice(0, 180),
        },
      });
      logWarn("payouts.release.transfer_failed_retry", {
        payoutId: payout.id,
        retryMinutes,
        reason,
      });
      maybeAlertRetryThreshold(payout.id, nextRetryCount, reason);
      results.push({ id: payout.id, status: "FAILED", error: reason });
    }
  }

  return results;
}
