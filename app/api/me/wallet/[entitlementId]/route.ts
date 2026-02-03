import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { resolveActions } from "@/lib/entitlements/accessResolver";
import { buildDefaultCheckinWindow } from "@/lib/checkin/policy";
import crypto from "crypto";
import { normalizeEmail } from "@/lib/utils/email";
import { mapRegistrationToPairingLifecycle } from "@/domain/padelRegistration";
import { PadelRegistrationStatus } from "@prisma/client";
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

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true, username: true },
  });
  const roles = profile?.roles ?? [];
  const isAdmin = roles.includes("admin");

  if (!isAdmin) {
    const identities = await prisma.emailIdentity.findMany({
      where: { userId },
      select: { id: true },
    });
    const identityIds = identities.map((identity) => identity.id);
    const normalizedEmail = normalizeEmail(data.user.email ?? null);
    const isOwner =
      ent.ownerUserId === userId ||
      (identityIds.length > 0 && ent.ownerIdentityId && identityIds.includes(ent.ownerIdentityId)) ||
      (normalizedEmail ? ent.ownerKey === `email:${normalizedEmail}` : false);
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
    checkinWindow,
    outsideWindow,
    emailVerified: Boolean(data.user.email_confirmed_at),
    isGuestOwner: false,
  });
  const passAvailable =
    isWalletPassEnabled() &&
    actions.canShowQr &&
    ent.type === "TICKET" &&
    ["ACTIVE", "USED"].includes(ent.status.toUpperCase());
  const passUrl = passAvailable
    ? `${getAppBaseUrl()}/api/me/wallet/${encodeURIComponent(ent.id)}/pass`
    : null;

  let qrToken: string | null = null;
  if (actions.canShowQr) {
    await prisma.entitlementQrToken.deleteMany({ where: { entitlementId: ent.id } });

    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
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

  if (ent.eventId && ent.purchaseId) {
    const purchaseFilters = [
      { purchaseId: ent.purchaseId },
      { stripePaymentIntentId: ent.purchaseId },
      { saleSummary: { purchaseId: ent.purchaseId } },
      { saleSummary: { paymentIntentId: ent.purchaseId } },
    ];
    let ticket = await prisma.ticket.findFirst({
      where: {
        eventId: ent.eventId,
        pairingId: { not: null },
        OR: [{ ownerUserId: userId }, { userId }],
        AND: [{ OR: purchaseFilters }],
      },
      select: { pairingId: true },
    });
    if (!ticket) {
      ticket = await prisma.ticket.findFirst({
        where: {
          eventId: ent.eventId,
          pairingId: { not: null },
          OR: [{ ownerUserId: userId }, { userId }],
        },
        orderBy: { purchasedAt: "desc" },
        select: { pairingId: true },
      });
    }
    if (ticket?.pairingId) {
      const pairing = await prisma.padelPairing.findUnique({
        where: { id: ticket.pairingId },
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

  return jsonWrap({
    entitlementId: ent.id,
    type: ent.type,
    scope: { eventId: ent.eventId, tournamentId: ent.tournamentId, seasonId: ent.seasonId },
    status: ent.status,
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
