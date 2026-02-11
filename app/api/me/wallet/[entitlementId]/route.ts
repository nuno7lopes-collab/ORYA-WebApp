import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { resolveActions } from "@/lib/entitlements/accessResolver";
import { buildDefaultCheckinWindow } from "@/lib/checkin/policy";
import crypto from "crypto";
import { getUserIdentityIds } from "@/lib/ownership/identity";
import { mapRegistrationToPairingLifecycle } from "@/domain/padelRegistration";
import { PadelRegistrationStatus, ResaleStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { isWalletPassEnabled } from "@/lib/wallet/pass";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

type Params = { entitlementId: string };

async function _GET(_: Request, context: { params: Params | Promise<Params> }) {
  const { entitlementId } = await context.params;
  if (!entitlementId || typeof entitlementId !== "string") {
    return jsonWrap({ error: "INVALID_ENTITLEMENT_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return jsonWrap({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = data.user.id;

  const ent = await prisma.entitlement.findUnique({
    where: { id: entitlementId },
  });

  if (!ent) {
    return jsonWrap({ error: "Not found" }, { status: 404 });
  }

  const entCheckins = await prisma.entitlementCheckin.findMany({
    where: { entitlementId: ent.id },
    select: { resultCode: true, checkedInAt: true },
    orderBy: { checkedInAt: "desc" },
    take: 1,
  });
  const consumedAt = entCheckins[0]?.checkedInAt ?? null;

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true, username: true },
  });
  const roles = profile?.roles ?? [];
  const isAdmin = roles.includes("admin");

  if (!isAdmin) {
    const identityIds = await getUserIdentityIds(userId);
    const isOwner =
      identityIds.length > 0 && ent.ownerIdentityId && identityIds.includes(ent.ownerIdentityId);
    if (!isOwner) {
      return jsonWrap({ error: "FORBIDDEN_WALLET_ACCESS" }, { status: 403 });
    }
  }

  const event =
    ent.eventId
      ? await prisma.event.findUnique({
          where: { id: ent.eventId },
          select: {
            id: true,
            slug: true,
            startsAt: true,
            endsAt: true,
            organization: {
              select: {
                username: true,
                publicName: true,
                businessName: true,
              },
            },
          },
        })
      : null;

  const checkinWindow = event ? buildDefaultCheckinWindow(event.startsAt, event.endsAt) : undefined;
  const outsideWindow = event ? undefined : true;

  const actions = resolveActions({
    type: ent.type,
    status: ent.status,
    isOwner: true,
    isOrganization: false,
    isAdmin,
    checkins: entCheckins,
    checkinWindow,
    outsideWindow,
    emailVerified: Boolean(data.user.email_confirmed_at),
    isGuestOwner: false,
  });
  const passAvailable =
    isWalletPassEnabled() &&
    actions.canShowQr &&
    ent.type === "EVENT_TICKET" &&
    ent.status.toUpperCase() === "ACTIVE" &&
    !consumedAt;
  const passUrl = passAvailable
    ? `${getAppBaseUrl()}/api/me/wallet/${encodeURIComponent(ent.id)}/pass`
    : null;

  let qrToken: string | null = null;
  if (actions.canShowQr) {
    await prisma.entitlementQrToken.deleteMany({ where: { entitlementId: ent.id } });

    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = checkinWindow?.end ?? new Date(Date.now() + 1000 * 60 * 60);
    await prisma.entitlementQrToken.create({
      data: { tokenHash, entitlementId: ent.id, expiresAt },
    });
    qrToken = token;
  }

  const organizationName = event?.organization?.publicName || event?.organization?.businessName || null;
  let pairingSummary: null | {
    id: number;
    paymentMode: string;
    pairingStatus: string;
    lifecycleStatus: string;
    createdByUserId?: string | null;
    slots: Array<{ slotRole: string; slotStatus: string; paymentStatus: string }>;
  } = null;
  let pairingActions: null | {
    canAccept: boolean;
    canDecline: boolean;
    canPay: boolean;
    userSlotRole: string | null;
  } = null;

  let paymentBreakdown: null | {
    totalPaidCents: number;
    platformFeeCents: number;
    cardPlatformFeeCents: number;
    stripeFeeCents: number;
    feesTotalCents: number;
    netCents: number;
    currency: string;
    status: string | null;
    feeMode: string | null;
    paymentMethod: string | null;
  } = null;
  let refundSummary: null | {
    baseAmountCents: number;
    feesExcludedCents: number;
    refundedAt: Date | null;
    reason: string | null;
  } = null;
  let resaleSummary: null | {
    ticketId: string | null;
    activeResaleId: string | null;
    canList: boolean;
    canCancel: boolean;
  } = null;

  if (ent.ticketId) {
    const activeResale = await prisma.ticketResale.findFirst({
      where: {
        ticketId: ent.ticketId,
        sellerUserId: userId,
        status: ResaleStatus.LISTED,
      },
      select: { id: true },
    });
    resaleSummary = {
      ticketId: ent.ticketId,
      activeResaleId: activeResale?.id ?? null,
      canList: ent.status === "ACTIVE" && !consumedAt,
      canCancel: Boolean(activeResale?.id),
    };
  }

  if (ent.eventId && ent.purchaseId) {
    let resolvedPairingId: number | null = null;

    if (ent.type === "PADEL_ENTRY" && ent.saleLineId) {
      const saleLine = await prisma.saleLine.findUnique({
        where: { id: ent.saleLineId },
        select: { padelRegistrationLine: { select: { pairingSlotId: true } } },
      });
      const pairingSlotId = saleLine?.padelRegistrationLine?.pairingSlotId ?? null;
      if (pairingSlotId) {
        const slot = await prisma.padelPairingSlot.findUnique({
          where: { id: pairingSlotId },
          select: { pairingId: true },
        });
        resolvedPairingId = slot?.pairingId ?? null;
      }
    }

    if (resolvedPairingId) {
      const pairing = await prisma.padelPairing.findUnique({
        where: { id: resolvedPairingId },
        select: {
          id: true,
          payment_mode: true,
          pairingStatus: true,
          createdByUserId: true,
          registration: { select: { status: true } },
          slots: {
            select: {
              slot_role: true,
              slotStatus: true,
              paymentStatus: true,
              profileId: true,
              invitedUserId: true,
              invitedContact: true,
            },
          },
        },
      });
      if (pairing) {
        const inviteContacts = [
          data.user.email?.trim() ?? null,
          profile?.username?.trim() ?? null,
          profile?.username ? `@${profile.username}` : null,
        ].filter(Boolean) as string[];
        const lifecycleStatus = mapRegistrationToPairingLifecycle(
          pairing.registration?.status ?? PadelRegistrationStatus.PENDING_PARTNER,
          pairing.payment_mode,
        );
        const userSlot = pairing.slots.find((slot) => {
          if (slot.profileId === userId || slot.invitedUserId === userId) return true;
          if (!slot.invitedContact) return false;
          return inviteContacts.some(
            (value) => value.toLowerCase() === slot.invitedContact?.toLowerCase(),
          );
        });
        const isPending = userSlot?.slotStatus === "PENDING";
        const isPaid = userSlot?.paymentStatus === "PAID";
        const isCaptain = pairing.createdByUserId === userId;
        const pendingSlot = pairing.slots.find((slot) => slot.slotStatus === "PENDING");
        const canPay =
          Boolean(pendingSlot && pendingSlot.paymentStatus !== "PAID") &&
          (pairing.payment_mode === "SPLIT" ? Boolean(isCaptain || isPending) : Boolean(isCaptain));
        const canAccept =
          pairing.payment_mode === "FULL" &&
          Boolean(isPending && isPaid && !isCaptain);

        pairingSummary = {
          id: pairing.id,
          paymentMode: pairing.payment_mode,
          pairingStatus: pairing.pairingStatus,
          lifecycleStatus,
          createdByUserId: pairing.createdByUserId,
          slots: pairing.slots.map((slot) => ({
            slotRole: slot.slot_role,
            slotStatus: slot.slotStatus,
            paymentStatus: slot.paymentStatus,
          })),
        };
        pairingActions = {
          canAccept,
          canDecline: Boolean(isPending && !isPaid),
          canPay,
          userSlotRole: userSlot?.slot_role ?? null,
        };
      }
    }
  }

  if (ent.purchaseId) {
    const purchaseId = ent.purchaseId;
    const saleSummary = await prisma.saleSummary.findFirst({
      where: {
        OR: [{ purchaseId }, { paymentIntentId: purchaseId }],
      },
      select: {
        totalCents: true,
        platformFeeCents: true,
        cardPlatformFeeCents: true,
        stripeFeeCents: true,
        netCents: true,
        currency: true,
        status: true,
        feeMode: true,
        paymentMethod: true,
      },
    });
    if (saleSummary) {
      const totalPaidCents = saleSummary.totalCents ?? 0;
      const platformFeeCents = saleSummary.platformFeeCents ?? 0;
      const cardPlatformFeeCents = saleSummary.cardPlatformFeeCents ?? 0;
      const stripeFeeCents = saleSummary.stripeFeeCents ?? 0;
      const feesTotalCents = platformFeeCents + cardPlatformFeeCents + stripeFeeCents;
      const netCents = saleSummary.netCents ?? Math.max(0, totalPaidCents - feesTotalCents);
      paymentBreakdown = {
        totalPaidCents,
        platformFeeCents,
        cardPlatformFeeCents,
        stripeFeeCents,
        feesTotalCents,
        netCents,
        currency: saleSummary.currency ?? "EUR",
        status: saleSummary.status ?? null,
        feeMode: saleSummary.feeMode ?? null,
        paymentMethod: saleSummary.paymentMethod ?? null,
      };
    }

    const refund = await prisma.refund.findFirst({
      where: {
        OR: [{ purchaseId }, { paymentIntentId: purchaseId }],
      },
      orderBy: { refundedAt: "desc" },
      select: {
        baseAmountCents: true,
        feesExcludedCents: true,
        refundedAt: true,
        reason: true,
      },
    });
    if (refund) {
      refundSummary = {
        baseAmountCents: refund.baseAmountCents ?? 0,
        feesExcludedCents: refund.feesExcludedCents ?? 0,
        refundedAt: refund.refundedAt ?? null,
        reason: refund.reason ?? null,
      };
    }
  }

  return jsonWrap({
    entitlementId: ent.id,
    type: ent.type,
    scope: { eventId: ent.eventId, tournamentId: ent.tournamentId, seasonId: ent.seasonId },
    status: consumedAt && ent.status === "ACTIVE" ? "CHECKED_IN" : ent.status,
    consumedAt,
    snapshot: {
      title: ent.snapshotTitle,
      coverUrl: ent.snapshotCoverUrl,
      venueName: ent.snapshotVenueName,
      startAt: ent.snapshotStartAt,
      timezone: ent.snapshotTimezone,
    },
    actions,
    passAvailable,
    passUrl,
    qrToken,
    pairing: pairingSummary,
    pairingActions,
    resale: resaleSummary,
    payment: paymentBreakdown,
    refund: refundSummary,
    event: event?.slug
      ? {
          id: event.id,
          slug: event.slug,
          organizationName,
          organizationUsername: event.organization?.username ?? null,
        }
      : null,
    audit: {
      updatedAt: ent.updatedAt,
      createdAt: ent.createdAt,
    },
  });
}
export const GET = withApiEnvelope(_GET);
