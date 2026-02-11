import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { DsarCaseStatus, DsarCaseType } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { listEffectiveOrganizationMembershipsForUser } from "@/lib/organizationMembers";

const DSAR_DUE_DAYS = 30;

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        contactPhone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deletionRequestedAt: true,
        deletionScheduledFor: true,
      },
    });

    const memberships = await listEffectiveOrganizationMembershipsForUser({
      userId: user.id,
    });

    const tickets = await prisma.ticket.findMany({
      where: { OR: [{ userId: user.id }, { ownerUserId: user.id }] },
      select: {
        id: true,
        eventId: true,
        ticketTypeId: true,
        status: true,
        purchasedAt: true,
        pricePaid: true,
        currency: true,
        platformFeeCents: true,
        totalPaidCents: true,
        purchaseId: true,
      },
    });

    const entitlements = await prisma.entitlement.findMany({
      where: { ownerUserId: user.id },
      select: {
        id: true,
        type: true,
        status: true,
        purchaseId: true,
        eventId: true,
        ticketId: true,
        snapshotTitle: true,
        snapshotStartAt: true,
        snapshotTimezone: true,
        createdAt: true,
      },
    });

    const entitlementIds = entitlements.map((ent) => ent.id);
    const checkins = entitlementIds.length
      ? await prisma.entitlementCheckin.findMany({
          where: { entitlementId: { in: entitlementIds } },
          select: {
            entitlementId: true,
            eventId: true,
            resultCode: true,
            checkedInAt: true,
            purchaseId: true,
            deviceId: true,
          },
        })
      : [];

    const purchaseIds = Array.from(
      new Set(
        entitlements
          .map((ent) => ent.purchaseId)
          .concat(tickets.map((ticket) => ticket.purchaseId ?? ""))
          .filter(Boolean),
      ),
    );

    const payments = purchaseIds.length
      ? await prisma.payment.findMany({
          where: { id: { in: purchaseIds } },
          select: {
            id: true,
            organizationId: true,
            sourceType: true,
            sourceId: true,
            status: true,
            pricingSnapshotJson: true,
            processorFeesStatus: true,
            processorFeesActual: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : [];

    const paymentSnapshots = purchaseIds.length
      ? await prisma.paymentSnapshot.findMany({
          where: { paymentId: { in: purchaseIds } },
          select: {
            paymentId: true,
            organizationId: true,
            sourceType: true,
            sourceId: true,
            status: true,
            currency: true,
            grossCents: true,
            platformFeeCents: true,
            processorFeesCents: true,
            netToOrgCents: true,
            updatedAt: true,
          },
        })
      : [];

    const refunds = purchaseIds.length
      ? await prisma.refund.findMany({
          where: { purchaseId: { in: purchaseIds } },
          select: {
            id: true,
            purchaseId: true,
            paymentIntentId: true,
            eventId: true,
            baseAmountCents: true,
            feesExcludedCents: true,
            reason: true,
            refundedAt: true,
            createdAt: true,
          },
        })
      : [];

    const consents = await prisma.userConsent.findMany({
      where: { userId: user.id },
      select: {
        organizationId: true,
        type: true,
        status: true,
        source: true,
        grantedAt: true,
        revokedAt: true,
        expiresAt: true,
        updatedAt: true,
      },
    });

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        ctaUrl: true,
        ctaLabel: true,
        priority: true,
        organizationId: true,
        eventId: true,
        ticketId: true,
        isRead: true,
        readAt: true,
        createdAt: true,
      },
    });

    const now = new Date();
    const dueAt = new Date(now.getTime() + DSAR_DUE_DAYS * 24 * 60 * 60 * 1000);
    const { ip, userAgent } = getRequestMeta(req);

    const dsarCase = await prisma.dsarCase.create({
      data: {
        userId: user.id,
        type: DsarCaseType.EXPORT,
        status: DsarCaseStatus.COMPLETED,
        requestedAt: now,
        completedAt: now,
        dueAt,
        metadata: {
          ip,
          userAgent,
          counts: {
            memberships: memberships.length,
            tickets: tickets.length,
            entitlements: entitlements.length,
            payments: payments.length,
            refunds: refunds.length,
            notifications: notifications.length,
          },
        },
      },
      select: { id: true },
    });

    return jsonWrap({
      ok: true,
      dsarCaseId: dsarCase.id,
      generatedAt: now.toISOString(),
      data: {
        profile,
        memberships,
        tickets,
        entitlements,
        checkins,
        payments,
        paymentSnapshots,
        refunds,
        consents,
        notifications,
      },
    });
  } catch (err) {
    console.error("[me/dsar/export]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
