import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import {
  OrganizationModule,
  PadelPairingJoinMode,
  PadelPairingPaymentStatus,
  PadelPairingSlotRole,
  PadelPairingSlotStatus,
  PadelRegistrationStatus,
} from "@prisma/client";
import { resolveRegistrationStatusFromSlots, upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

async function ensureOrganizationAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizationId: true,
      templateType: true,
      organization: { select: { officialEmail: true, officialEmailVerifiedAt: true } },
    },
  });
  if (!evt?.organizationId || evt.templateType !== "PADEL") return false;
  const emailGate = ensureOrganizationEmailVerified(evt.organization ?? {}, {
    reasonCode: "PADEL_PAIRING_SWAP",
    organizationId: evt.organizationId,
  });
  if (!emailGate.ok) return { ...emailGate, status: 403 };
  const access = await ensureGroupMemberModuleAccess({
    organizationId: evt.organizationId,
    userId,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  return access.ok;
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable },
      { status },
    );
  };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return fail(401, "UNAUTHENTICATED");

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail(400, "INVALID_BODY");

  const eventId = typeof body?.eventId === "number" ? body.eventId : Number(body?.eventId);
  const pairingAId = typeof body?.pairingAId === "number" ? body.pairingAId : Number(body?.pairingAId);
  const pairingBId = typeof body?.pairingBId === "number" ? body.pairingBId : Number(body?.pairingBId);

  if (!Number.isFinite(eventId) || !Number.isFinite(pairingAId) || !Number.isFinite(pairingBId)) {
    return fail(400, "INVALID_INPUT");
  }
  if (pairingAId === pairingBId) return fail(409, "PAIRING_DUPLICATE");

  const authorized = await ensureOrganizationAccess(data.user.id, eventId);
  if (authorized !== true) {
    if (authorized && typeof authorized === "object" && "error" in authorized) {
      return respondError(
        ctx,
        {
          errorCode: authorized.error ?? "FORBIDDEN",
          message: authorized.message ?? authorized.error ?? "Sem permissões.",
          retryable: false,
          details: authorized,
        },
        { status: authorized.status ?? 403 },
      );
    }
    return fail(403, "FORBIDDEN");
  }

  const pairings = await prisma.padelPairing.findMany({
    where: { id: { in: [pairingAId, pairingBId] } },
    select: {
      id: true,
      eventId: true,
      organizationId: true,
      categoryId: true,
      player1UserId: true,
      player2UserId: true,
      payment_mode: true,
      pairingStatus: true,
      pairingJoinMode: true,
      registration: { select: { status: true } },
      slots: {
        select: {
          id: true,
          slot_role: true,
          slotStatus: true,
          paymentStatus: true,
          ticketId: true,
          profileId: true,
          playerProfileId: true,
          invitedUserId: true,
          invitedContact: true,
        },
      },
    },
  });
  if (pairings.length !== 2) return fail(404, "PAIRING_NOT_FOUND");

  const pairingA = pairings.find((p) => p.id === pairingAId)!;
  const pairingB = pairings.find((p) => p.id === pairingBId)!;
  if (pairingA.eventId !== eventId || pairingB.eventId !== eventId) {
    return fail(409, "EVENT_MISMATCH");
  }
  if ((pairingA.categoryId ?? null) !== (pairingB.categoryId ?? null)) {
    return fail(409, "CATEGORY_MISMATCH");
  }
  if (!pairingA.player2UserId || !pairingB.player2UserId) {
    return fail(409, "PARTNER_MISSING");
  }

  const partnerSlotA = pairingA.slots.find((slot) => slot.slot_role === PadelPairingSlotRole.PARTNER);
  const partnerSlotB = pairingB.slots.find((slot) => slot.slot_role === PadelPairingSlotRole.PARTNER);
  if (!partnerSlotA || !partnerSlotB) return fail(409, "PARTNER_SLOT_MISSING");
  if (!partnerSlotA.profileId || !partnerSlotB.profileId) {
    return fail(409, "PARTNER_MISSING");
  }
  if (partnerSlotA.profileId === partnerSlotB.profileId) {
    return fail(409, "DUPLICATE_PLAYER");
  }

  const invalidStatuses = new Set<PadelRegistrationStatus>([
    PadelRegistrationStatus.CONFIRMED,
    PadelRegistrationStatus.CANCELLED,
    PadelRegistrationStatus.EXPIRED,
    PadelRegistrationStatus.REFUNDED,
  ]);
  if (
    (pairingA.registration?.status && invalidStatuses.has(pairingA.registration.status)) ||
    (pairingB.registration?.status && invalidStatuses.has(pairingB.registration.status))
  ) {
    return fail(409, "SWAP_NOT_ALLOWED");
  }
  if (
    partnerSlotA.paymentStatus === PadelPairingPaymentStatus.PAID ||
    partnerSlotB.paymentStatus === PadelPairingPaymentStatus.PAID ||
    partnerSlotA.ticketId ||
    partnerSlotB.ticketId
  ) {
    return fail(409, "PARTNER_LOCKED");
  }
  if (pairingA.player1UserId === pairingB.player2UserId || pairingB.player1UserId === pairingA.player2UserId) {
    return fail(409, "DUPLICATE_PLAYER");
  }

  const now = new Date();
  const auditBefore = {
    pairingA: {
      pairingId: pairingA.id,
      captainUserId: pairingA.player1UserId ?? null,
      partnerUserId: partnerSlotA.profileId ?? null,
      partnerSlotId: partnerSlotA.id,
      partnerProfileId: partnerSlotA.playerProfileId ?? null,
    },
    pairingB: {
      pairingId: pairingB.id,
      captainUserId: pairingB.player1UserId ?? null,
      partnerUserId: partnerSlotB.profileId ?? null,
      partnerSlotId: partnerSlotB.id,
      partnerProfileId: partnerSlotB.playerProfileId ?? null,
    },
  };
  const swapSlotPayload = (slot: typeof partnerSlotA) => ({
    profileId: slot.profileId,
    playerProfileId: slot.playerProfileId,
    slotStatus: PadelPairingSlotStatus.FILLED,
    paymentStatus: PadelPairingPaymentStatus.UNPAID,
  });

  await prisma.$transaction(async (tx) => {
    await tx.padelPairingSlot.update({
      where: { id: partnerSlotA.id },
      data: {
        ...swapSlotPayload(partnerSlotB),
        ticketId: null,
        invitedUserId: null,
        invitedContact: null,
      },
    });
    await tx.padelPairingSlot.update({
      where: { id: partnerSlotB.id },
      data: {
        ...swapSlotPayload(partnerSlotA),
        ticketId: null,
        invitedUserId: null,
        invitedContact: null,
      },
    });

    const updatePairing = (pairingId: number, nextPartnerId: string | null) =>
      tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          player2UserId: nextPartnerId,
          pairingStatus: "COMPLETE",
          pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
          partnerInvitedAt: null,
          partnerInviteToken: null,
          partnerLinkToken: null,
          partnerLinkExpiresAt: null,
          partnerInviteUsedAt: now,
          partnerAcceptedAt: now,
          partnerPaidAt: null,
          partnerSwapAllowedUntilAt: null,
        },
      });

    await Promise.all([
      updatePairing(pairingA.id, partnerSlotB.profileId ?? null),
      updatePairing(pairingB.id, partnerSlotA.profileId ?? null),
    ]);

    const resolveStatus = (pairing: typeof pairingA) =>
      resolveRegistrationStatusFromSlots({
        pairingJoinMode: PadelPairingJoinMode.INVITE_PARTNER,
        slots: pairing.slots.map((slot) =>
          slot.slot_role === PadelPairingSlotRole.PARTNER
            ? { slotStatus: PadelPairingSlotStatus.FILLED, paymentStatus: PadelPairingPaymentStatus.UNPAID }
            : { slotStatus: slot.slotStatus, paymentStatus: slot.paymentStatus },
        ),
      });

    await Promise.all([
      upsertPadelRegistrationForPairing(tx, {
        pairingId: pairingA.id,
        organizationId: pairingA.organizationId,
        eventId: pairingA.eventId,
        status: resolveStatus(pairingA),
        paymentMode: pairingA.payment_mode,
        reason: "ADMIN_SWAP",
      }),
      upsertPadelRegistrationForPairing(tx, {
        pairingId: pairingB.id,
        organizationId: pairingB.organizationId,
        eventId: pairingB.eventId,
        status: resolveStatus(pairingB),
        paymentMode: pairingB.payment_mode,
        reason: "ADMIN_SWAP",
      }),
    ]);
  });

  await recordOrganizationAuditSafe({
    organizationId: pairingA.organizationId,
    actorUserId: data.user.id,
    action: "PADEL_PAIRING_SWAP",
    entityType: "event",
    entityId: String(eventId),
    metadata: {
      pairingAId,
      pairingBId,
      categoryId: pairingA.categoryId ?? null,
      before: auditBefore,
      after: {
        pairingA: {
          pairingId: pairingA.id,
          captainUserId: pairingA.player1UserId ?? null,
          partnerUserId: partnerSlotB.profileId ?? null,
          partnerSlotId: partnerSlotA.id,
          partnerProfileId: partnerSlotB.playerProfileId ?? null,
        },
        pairingB: {
          pairingId: pairingB.id,
          captainUserId: pairingB.player1UserId ?? null,
          partnerUserId: partnerSlotA.profileId ?? null,
          partnerSlotId: partnerSlotB.id,
          partnerProfileId: partnerSlotA.playerProfileId ?? null,
        },
      },
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return respondOk(ctx, { ok: true }, { status: 200 });
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

export const POST = withApiEnvelope(_POST);
