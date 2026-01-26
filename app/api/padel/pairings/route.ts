export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  Gender,
  PadelEligibilityType,
  PadelPairingPaymentStatus,
  PadelPairingSlotRole,
  PadelPairingSlotStatus,
  PadelPaymentMode,
  PadelPairingJoinMode,
  OrganizationMemberRole,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { buildPadelEventSnapshot } from "@/lib/padel/eventSnapshot";
import { validateEligibility } from "@/domain/padelEligibility";
import { upsertActiveHold } from "@/domain/padelPairingHold";
import {
  clampDeadlineHours,
  computeSplitDeadlineAt,
  computePartnerLinkExpiresAt,
} from "@/domain/padelDeadlines";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { checkPadelCategoryLimit } from "@/domain/padelCategoryLimit";
import { checkPadelCategoryCapacity } from "@/domain/padelCategoryCapacity";
import {
  checkPadelRegistrationWindow,
  INACTIVE_REGISTRATION_STATUSES,
  mapRegistrationToPairingLifecycle,
  resolveInitialPadelRegistrationStatus,
  upsertPadelRegistrationForPairing,
} from "@/domain/padelRegistration";
import { upsertPadelWaitlistEntry } from "@/domain/padelWaitlist";
import { checkPadelEventCapacity } from "@/domain/padelEventCapacity";
import { parseOrganizationId } from "@/lib/organizationId";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";
import { validatePadelCategoryAccess } from "@/domain/padelCategoryAccess";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { queuePairingInvite } from "@/domain/notifications/splitPayments";
import { requireActiveEntitlementForTicket } from "@/lib/entitlements/accessChecks";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

async function syncPlayersFromSlots({
  organizationId,
  slots,
}: {
  organizationId: number;
  slots: Array<{
    profileId: string | null;
    invitedContact: string | null;
    invitedUserId: string | null;
  }>;
}) {
  const profileIds = Array.from(
    new Set(
      slots
        .flatMap((s) => [s.profileId, s.invitedUserId])
        .filter(Boolean) as string[],
    ),
  );

  // 1) Jogadores ligados a perfis existentes
  if (profileIds.length > 0) {
    const profiles = await prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, fullName: true, contactPhone: true },
    });
    for (const profile of profiles) {
      const exists = await prisma.padelPlayerProfile.findFirst({
        where: { organizationId, userId: profile.id },
        select: { id: true },
      });
      if (exists) continue;
      const fullName = profile.fullName?.trim() || "Jogador ORYA";
      await prisma.padelPlayerProfile.create({
        data: {
          organizationId,
          userId: profile.id,
          fullName,
          displayName: fullName,
          phone: profile.contactPhone || undefined,
          isActive: true,
        },
      });
    }
  }

  // 2) Convites por contacto (email ou telefone)
  const invitedContacts = Array.from(
    new Set(
      slots
        .map((s) => s.invitedContact?.trim())
        .filter(Boolean) as string[],
    ),
  );
  for (const contact of invitedContacts) {
    const isEmail = contact.includes("@");
    const email = isEmail ? contact.toLowerCase() : null;
    const phone = !isEmail ? contact : null;
    if (email) {
      const exists = await prisma.padelPlayerProfile.findFirst({
        where: { organizationId, email },
        select: { id: true },
      });
      if (exists) continue;
    }
    await prisma.padelPlayerProfile.create({
      data: {
        organizationId,
        fullName: contact,
        displayName: contact,
        email: email || undefined,
        phone: phone || undefined,
        isActive: true,
      },
    });
  }
}

// Cria pairing Padel v2 após checkout ou setup inicial.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const eventId = body && typeof body.eventId === "number" ? body.eventId : Number(body?.eventId);
  const organizationIdRaw = parseOrganizationId(body?.organizationId);
  const categoryId = body && typeof body.categoryId === "number" ? body.categoryId : body?.categoryId === null ? null : Number(body?.categoryId);
  const paymentMode = typeof body?.paymentMode === "string" ? (body?.paymentMode as PadelPaymentMode) : null;
  const pairingJoinModeRaw = typeof body?.pairingJoinMode === "string" ? (body?.pairingJoinMode as PadelPairingJoinMode) : "INVITE_PARTNER";
  const createdByTicketId = typeof body?.createdByTicketId === "string" ? body?.createdByTicketId : null;
  const inviteExpiresAt = body?.inviteExpiresAt ? new Date(String(body.inviteExpiresAt)) : null;
  const lockedUntil = body?.lockedUntil ? new Date(String(body.lockedUntil)) : null;
  const isPublicOpen = Boolean(body?.isPublicOpen);
  const invitedContactNormalized =
    typeof body?.invitedContact === "string" && body.invitedContact.trim().length > 0
      ? body.invitedContact.trim()
      : null;
  const targetUserId =
    typeof body?.targetUserId === "string" && body.targetUserId.trim().length > 0
      ? body.targetUserId.trim()
      : null;

  if (!eventId || !paymentMode || !["FULL", "SPLIT"].includes(paymentMode)) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  // Resolver organization + flag padel v2
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizationId: true,
      startsAt: true,
      status: true,
      padelTournamentConfig: { select: { padelV2Enabled: true } },
    },
  });
  if (!event || !event.padelTournamentConfig?.padelV2Enabled) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_PADDEL_V2" }, { status: 400 });
  }
  const organizationId = organizationIdRaw ?? event.organizationId;
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "ORGANIZATION_MISSING" }, { status: 400 });
  }

  // Basic guard: only proceed if padel_v2_enabled is active on the tournament config.
  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: {
      padelV2Enabled: true,
      organizationId: true,
      eligibilityType: true,
      splitDeadlineHours: true,
      defaultCategoryId: true,
      advancedSettings: true,
    },
  });
  if (!config?.padelV2Enabled || config.organizationId !== organizationId) {
    return NextResponse.json({ ok: false, error: "PADEL_V2_DISABLED" }, { status: 400 });
  }

  const advancedSettings = (config.advancedSettings || {}) as {
    waitlistEnabled?: boolean;
    registrationStartsAt?: string | null;
    registrationEndsAt?: string | null;
    maxEntriesTotal?: number | null;
    competitionState?: string | null;
  };
  const registrationStartsAt =
    advancedSettings.registrationStartsAt && !Number.isNaN(new Date(advancedSettings.registrationStartsAt).getTime())
      ? new Date(advancedSettings.registrationStartsAt)
      : null;
  const registrationEndsAt =
    advancedSettings.registrationEndsAt && !Number.isNaN(new Date(advancedSettings.registrationEndsAt).getTime())
      ? new Date(advancedSettings.registrationEndsAt)
      : null;
  const registrationCheck = checkPadelRegistrationWindow({
    eventStatus: event.status,
    eventStartsAt: event.startsAt ?? null,
    registrationStartsAt,
    registrationEndsAt,
    competitionState: advancedSettings.competitionState ?? null,
  });
  if (!registrationCheck.ok) {
    return NextResponse.json({ ok: false, error: registrationCheck.code }, { status: 409 });
  }

  const [profile] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        gender: true,
        contactPhone: true,
        fullName: true,
        username: true,
        padelLevel: true,
        padelPreferredSide: true,
      },
    }),
  ]);

  const missing = getPadelOnboardingMissing({
    profile,
    email: user.email ?? null,
  });
  if (!isPadelOnboardingComplete(missing)) {
    return NextResponse.json(
      {
        ok: false,
        error: "PADEL_ONBOARDING_REQUIRED",
        missing,
      },
      { status: 409 },
    );
  }

  const eligibility = validateEligibility(
    (config.eligibilityType as PadelEligibilityType) ?? PadelEligibilityType.OPEN,
    profile?.gender as Gender | null,
    null,
  );
  if (!eligibility.ok) {
    return NextResponse.json(
      { ok: false, error: eligibility.code },
      { status: eligibility.code === "GENDER_REQUIRED_FOR_TOURNAMENT" ? 403 : 409 },
    );
  }

  const categoryLinks = await prisma.padelEventCategoryLink.findMany({
    where: { eventId, isEnabled: true },
    select: { id: true, padelCategoryId: true },
    orderBy: { id: "asc" },
  });

  let effectiveCategoryId: number | null = null;
  if (Number.isFinite(categoryId as number)) {
    const match = categoryLinks.find((l) => l.padelCategoryId === (categoryId as number));
    if (!match) {
      return NextResponse.json({ ok: false, error: "CATEGORY_NOT_AVAILABLE" }, { status: 400 });
    }
    effectiveCategoryId = match.padelCategoryId;
  } else if (categoryLinks.length > 1) {
    return NextResponse.json({ ok: false, error: "CATEGORY_REQUIRED" }, { status: 400 });
  } else if (categoryLinks.length > 0) {
    effectiveCategoryId = categoryLinks[0].padelCategoryId;
  } else if (config.defaultCategoryId) {
    effectiveCategoryId = config.defaultCategoryId;
  }

  if (!effectiveCategoryId) {
    return NextResponse.json({ ok: false, error: "CATEGORY_REQUIRED" }, { status: 400 });
  }

  const category = await prisma.padelCategory.findUnique({
    where: { id: effectiveCategoryId },
    select: { genderRestriction: true, minLevel: true, maxLevel: true },
  });
  const categoryAccess = validatePadelCategoryAccess({
    genderRestriction: category?.genderRestriction ?? null,
    minLevel: category?.minLevel ?? null,
    maxLevel: category?.maxLevel ?? null,
    playerGender: profile?.gender as Gender | null,
    partnerGender: null,
    playerLevel: profile?.padelLevel ?? null,
  });
  if (!categoryAccess.ok) {
    if (categoryAccess.code === "GENDER_REQUIRED_FOR_CATEGORY" || categoryAccess.code === "LEVEL_REQUIRED_FOR_CATEGORY") {
      return NextResponse.json(
        { ok: false, error: "PADEL_ONBOARDING_REQUIRED", missing: categoryAccess.missing },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: categoryAccess.code }, { status: 409 });
  }

  // Invariante: 1 pairing ativo por evento+categoria+user
  const resolvedTarget =
    pairingJoinModeRaw === "INVITE_PARTNER"
      ? targetUserId ||
        (invitedContactNormalized
          ? (await resolveUserIdentifier(invitedContactNormalized).catch(() => null))?.userId ?? null
          : null)
      : null;
  const hasInviteTarget = Boolean(targetUserId || invitedContactNormalized);

  const existingActive = await prisma.padelPairing.findFirst({
    where: {
      eventId,
      categoryId: effectiveCategoryId,
      AND: [
        {
          OR: [
            { registration: { is: null } },
            { registration: { status: { notIn: INACTIVE_REGISTRATION_STATUSES } } },
          ],
        },
        { OR: [{ player1UserId: user.id }, { player2UserId: user.id }] },
      ],
    },
    include: { slots: true, registration: { select: { status: true } } },
  });
  if (existingActive) {
    const updates: Record<string, unknown> = {};
    const slotUpdates: Record<string, unknown> = {};
    const partnerSlot = existingActive.slots.find((s) => s.slot_role === "PARTNER");
    const partnerLocked =
      Boolean(partnerSlot?.paymentStatus === "PAID" || partnerSlot?.ticketId);
    const canUpdatePartner = partnerSlot && !partnerSlot.profileId && !partnerLocked;

    if (paymentMode && existingActive.payment_mode !== paymentMode) {
      if (partnerLocked) {
        return NextResponse.json({ ok: false, error: "PARTNER_LOCKED" }, { status: 409 });
      }
      updates.payment_mode = paymentMode;
    }

    if (partnerLocked && (pairingJoinModeRaw !== existingActive.pairingJoinMode || hasInviteTarget)) {
      return NextResponse.json({ ok: false, error: "PARTNER_LOCKED" }, { status: 409 });
    }

    if (canUpdatePartner) {
      const joinModeChanged = existingActive.pairingJoinMode !== pairingJoinModeRaw;
      if (joinModeChanged) {
        updates.pairingJoinMode = pairingJoinModeRaw;
      }

      if (pairingJoinModeRaw === "LOOKING_FOR_PARTNER") {
        updates.partnerInviteToken = null;
        updates.partnerLinkToken = null;
        updates.partnerLinkExpiresAt = null;
        updates.partnerInvitedAt = null;
        if (partnerSlot?.invitedContact) {
          slotUpdates.invitedContact = null;
        }
        if (partnerSlot?.invitedUserId) {
          slotUpdates.invitedUserId = null;
        }
      } else {
        const now = new Date();
        const inviteExpired =
          existingActive.partnerLinkExpiresAt &&
          existingActive.partnerLinkExpiresAt.getTime() < now.getTime();
        const shouldResetInvite =
          !existingActive.partnerInviteToken ||
          existingActive.pairingJoinMode !== "INVITE_PARTNER" ||
          inviteExpired;
        const inviteTokenToUse = shouldResetInvite
          ? randomUUID()
          : existingActive.partnerInviteToken!;
        if (shouldResetInvite) {
          updates.partnerInviteToken = inviteTokenToUse;
          updates.partnerLinkToken = inviteTokenToUse;
          updates.partnerLinkExpiresAt = computePartnerLinkExpiresAt(now, undefined);
          updates.partnerInvitedAt = now;
        } else if (!existingActive.partnerLinkExpiresAt) {
          updates.partnerLinkExpiresAt = computePartnerLinkExpiresAt(now, undefined);
        }
        if (hasInviteTarget) {
          if (invitedContactNormalized && partnerSlot?.invitedContact !== invitedContactNormalized) {
            slotUpdates.invitedContact = invitedContactNormalized;
          } else if (targetUserId && !invitedContactNormalized && partnerSlot?.invitedContact) {
            slotUpdates.invitedContact = null;
          }
          if ((partnerSlot?.invitedUserId ?? null) !== resolvedTarget) {
            slotUpdates.invitedUserId = resolvedTarget;
          }
        }
      }
    }

    const shouldUpdate =
      Object.keys(updates).length > 0 || Object.keys(slotUpdates).length > 0;
    const pairingReturn = shouldUpdate
      ? await prisma.padelPairing.update({
          where: { id: existingActive.id },
          data: {
            ...updates,
            ...(Object.keys(slotUpdates).length > 0 && partnerSlot
              ? {
                  slots: {
                    update: {
                      where: { id: partnerSlot.id },
                      data: slotUpdates,
                    },
                  },
                }
              : {}),
          },
          include: { slots: true, registration: { select: { status: true } } },
        })
      : existingActive;

    const resolvedRegistrationStatus =
      pairingReturn.registration?.status ??
      resolveInitialPadelRegistrationStatus({
        pairingJoinMode: pairingReturn.pairingJoinMode,
        paymentMode: pairingReturn.payment_mode,
        captainPaid: pairingReturn.slots.some(
          (slot) => slot.slot_role === "CAPTAIN" && slot.paymentStatus === PadelPairingPaymentStatus.PAID,
        ),
      });
    await prisma.$transaction((tx) =>
      upsertPadelRegistrationForPairing(tx, {
        pairingId: pairingReturn.id,
        organizationId: pairingReturn.organizationId,
        eventId: pairingReturn.eventId,
        status: resolvedRegistrationStatus,
      }),
    );

    await upsertActiveHold(prisma, { pairingId: pairingReturn.id, eventId, ttlMinutes: 30 });
    let inviteSent = false;
    if (
      pairingJoinModeRaw === "INVITE_PARTNER" &&
      resolvedTarget &&
      resolvedTarget !== user.id &&
      pairingReturn.partnerInviteToken
    ) {
      await queuePairingInvite({
        pairingId: pairingReturn.id,
        targetUserId: resolvedTarget,
        inviterUserId: user.id,
        token: pairingReturn.partnerInviteToken,
      });
      inviteSent = true;
    }
    const slotForUser =
      pairingReturn.slots.find((s) => s.profileId === user.id || s.invitedUserId === user.id) ??
      pairingReturn.slots.find((s) => s.slot_role === "CAPTAIN") ??
      pairingReturn.slots[0] ??
      null;
    const lifecycleStatus = mapRegistrationToPairingLifecycle(
      resolvedRegistrationStatus,
      pairingReturn.payment_mode,
    );
    return NextResponse.json(
      { ok: true, pairing: { ...pairingReturn, lifecycleStatus }, inviteSent, slotId: slotForUser?.id ?? null },
      { status: 200 },
    );
  }

  if (
    pairingJoinModeRaw === "LOOKING_FOR_PARTNER" &&
    paymentMode === "SPLIT" &&
    !hasInviteTarget
  ) {
    const now = new Date();
    const openPairings = await prisma.padelPairing.findMany({
      where: {
        eventId,
        categoryId: effectiveCategoryId,
        payment_mode: PadelPaymentMode.SPLIT,
        pairingStatus: { not: "CANCELLED" },
        player2UserId: null,
        AND: [
          {
            OR: [
              { registration: { is: null } },
              { registration: { status: { notIn: INACTIVE_REGISTRATION_STATUSES } } },
            ],
          },
          { OR: [{ pairingJoinMode: "LOOKING_FOR_PARTNER" }, { isPublicOpen: true }] },
        ],
      },
      select: {
        id: true,
        eventId: true,
        deadlineAt: true,
        player1UserId: true,
        pairingJoinMode: true,
        isPublicOpen: true,
        category: { select: { genderRestriction: true, minLevel: true, maxLevel: true } },
        slots: {
          select: {
            id: true,
            slot_role: true,
            slotStatus: true,
            paymentStatus: true,
            profileId: true,
            invitedUserId: true,
          },
        },
        player1: { select: { gender: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 8,
    });

    let matched: (typeof openPairings)[number] | null = null;
    let partnerSlotId: number | null = null;

    for (const pairing of openPairings) {
      if (pairing.player1UserId === user.id) continue;
      const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
      if (!partnerSlot || partnerSlot.slotStatus !== "PENDING") continue;
      if (
        pairing.deadlineAt &&
        pairing.deadlineAt.getTime() < now.getTime() &&
        partnerSlot.paymentStatus !== PadelPairingPaymentStatus.PAID
      ) {
        continue;
      }
      const eligibility = validateEligibility(
        (config.eligibilityType as PadelEligibilityType) ?? PadelEligibilityType.OPEN,
        pairing.player1?.gender as Gender | null,
        profile?.gender as Gender | null,
      );
      if (!eligibility.ok) continue;
      const categoryAccess = validatePadelCategoryAccess({
        genderRestriction: pairing.category?.genderRestriction ?? null,
        minLevel: pairing.category?.minLevel ?? null,
        maxLevel: pairing.category?.maxLevel ?? null,
        playerGender: profile?.gender as Gender | null,
        partnerGender: pairing.player1?.gender as Gender | null,
        playerLevel: profile?.padelLevel ?? null,
      });
      if (!categoryAccess.ok) continue;
      matched = pairing;
      partnerSlotId = partnerSlot.id;
      break;
    }

    if (matched && partnerSlotId) {
      const pairingReturn = await prisma.padelPairing.findUnique({
        where: { id: matched.id },
        include: { slots: true },
      });
      if (pairingReturn) {
        return NextResponse.json(
          { ok: true, pairing: pairingReturn, slotId: partnerSlotId, matched: true },
          { status: 200 },
        );
      }
    }
  }

  let validatedTicketId: string | null = null;
  if (createdByTicketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: createdByTicketId },
      select: {
        id: true,
        eventId: true,
        pairingId: true,
        ticketType: {
          select: {
            padelEventCategoryLinkId: true,
            padelEventCategoryLink: { select: { padelCategoryId: true } },
          },
        },
      },
    });
    if (!ticket || ticket.eventId !== eventId) {
      return NextResponse.json({ ok: false, error: "INVALID_TICKET" }, { status: 400 });
    }
    const entitlementGate = await requireActiveEntitlementForTicket({
      ticketId: ticket.id,
      eventId,
      userId: user.id,
    });
    if (!entitlementGate.ok) {
      return NextResponse.json(
        { ok: false, error: entitlementGate.reason ?? "ENTITLEMENT_REQUIRED" },
        { status: 403 },
      );
    }
    if (ticket.pairingId) {
      return NextResponse.json({ ok: false, error: "TICKET_ALREADY_USED" }, { status: 409 });
    }
    const slotUsingTicket = await prisma.padelPairingSlot.findUnique({
      where: { ticketId: createdByTicketId },
      select: { id: true },
    });
    if (slotUsingTicket) {
      return NextResponse.json({ ok: false, error: "TICKET_ALREADY_USED" }, { status: 409 });
    }
    const ticketCategoryId = ticket.ticketType?.padelEventCategoryLink?.padelCategoryId ?? null;
    if (ticketCategoryId && ticketCategoryId !== effectiveCategoryId) {
      return NextResponse.json({ ok: false, error: "TICKET_CATEGORY_MISMATCH" }, { status: 409 });
    }
    validatedTicketId = ticket.id;
  }

  // Build slots: se não vierem slots no payload, cria duas entradas (capitão + parceiro pendente)
  type IncomingSlot = {
    ticketId?: unknown;
    profileId?: unknown;
    invitedContact?: unknown;
    invitedUserId?: unknown;
    isPublicOpen?: unknown;
    slotRole?: unknown;
    slotStatus?: unknown;
    paymentStatus?: unknown;
  };

  const normalizeSlot = (slot: IncomingSlot | unknown) => {
    if (typeof slot !== "object" || slot === null) return null;
    const s = slot as IncomingSlot;
    const roleRaw =
      typeof s.slotRole === "string"
        ? s.slotRole
        : typeof (s as any).slot_role === "string"
          ? (s as any).slot_role
          : "PARTNER";
    const statusRaw = typeof s.slotStatus === "string" ? s.slotStatus : "PENDING";
    const payRaw = typeof s.paymentStatus === "string" ? s.paymentStatus : "UNPAID";

    return {
      ticketId: typeof s.ticketId === "string" ? s.ticketId : null,
      profileId: typeof s.profileId === "string" ? s.profileId : null,
      invitedContact: typeof s.invitedContact === "string" ? s.invitedContact : null,
      invitedUserId: typeof s.invitedUserId === "string" ? s.invitedUserId : null,
      isPublicOpen: Boolean(s.isPublicOpen),
      slot_role: roleRaw === "CAPTAIN" ? PadelPairingSlotRole.CAPTAIN : PadelPairingSlotRole.PARTNER,
      slotStatus:
        statusRaw === "FILLED"
          ? PadelPairingSlotStatus.FILLED
          : statusRaw === "CANCELLED"
            ? PadelPairingSlotStatus.CANCELLED
            : PadelPairingSlotStatus.PENDING,
      paymentStatus: payRaw === "PAID" ? PadelPairingPaymentStatus.PAID : PadelPairingPaymentStatus.UNPAID,
    };
  };

  const incomingSlots = Array.isArray(body?.slots) ? (body!.slots as unknown[]) : [];
  const captainPaid = Boolean(validatedTicketId);
  if (captainPaid) {
    const limitCheck = await prisma.$transaction((tx) =>
      checkPadelCategoryLimit({
        tx,
        eventId,
        userId: user.id,
        categoryId: effectiveCategoryId,
      }),
    );
    if (!limitCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: limitCheck.code === "ALREADY_IN_CATEGORY" ? "ALREADY_IN_CATEGORY" : "MAX_CATEGORIES",
        },
        { status: 409 },
      );
    }
  }
  const slotsToCreate =
    incomingSlots.length > 0
      ? (incomingSlots
          .map((slot) => normalizeSlot(slot))
          .filter(Boolean) as Array<{
          ticketId: string | null;
          profileId: string | null;
          invitedContact: string | null;
          invitedUserId: string | null;
          isPublicOpen: boolean;
          slot_role: PadelPairingSlotRole;
          slotStatus: PadelPairingSlotStatus;
          paymentStatus: PadelPairingPaymentStatus;
        }>)
      : [
          {
            ticketId: validatedTicketId,
            profileId: user.id,
            invitedContact: null,
            invitedUserId: null,
            isPublicOpen,
            slot_role: PadelPairingSlotRole.CAPTAIN,
            slotStatus: captainPaid ? PadelPairingSlotStatus.FILLED : PadelPairingSlotStatus.PENDING,
            paymentStatus: captainPaid ? PadelPairingPaymentStatus.PAID : PadelPairingPaymentStatus.UNPAID,
          },
          {
            ticketId: null,
            profileId: null,
            invitedContact:
              pairingJoinModeRaw === "INVITE_PARTNER" && invitedContactNormalized
                ? invitedContactNormalized
                : null,
            invitedUserId: pairingJoinModeRaw === "INVITE_PARTNER" ? resolvedTarget : null,
            isPublicOpen,
            slot_role: PadelPairingSlotRole.PARTNER,
            slotStatus: PadelPairingSlotStatus.PENDING,
            paymentStatus:
              paymentMode === "FULL" && captainPaid
                ? PadelPairingPaymentStatus.PAID
                : PadelPairingPaymentStatus.UNPAID,
          },
        ];

  try {
    const now = new Date();
    const clampedDeadlineHours = clampDeadlineHours(config.splitDeadlineHours ?? undefined);
    const deadlineAt = computeSplitDeadlineAt(now, event.startsAt ?? null, clampedDeadlineHours);
    if (paymentMode === "SPLIT" && deadlineAt.getTime() <= now.getTime()) {
      return NextResponse.json({ ok: false, error: "SPLIT_DEADLINE_PASSED" }, { status: 409 });
    }
    const inviteExpiresMinutes =
      inviteExpiresAt && !Number.isNaN(inviteExpiresAt.getTime())
        ? Math.round((inviteExpiresAt.getTime() - now.getTime()) / 60000)
        : null;
    const partnerLinkExpiresAtNormalized = computePartnerLinkExpiresAt(now, inviteExpiresMinutes);
    const partnerInviteToken =
      pairingJoinModeRaw === "INVITE_PARTNER"
        ? randomUUID()
        : null;

    const initialRegistrationStatus = resolveInitialPadelRegistrationStatus({
      pairingJoinMode: pairingJoinModeRaw ?? PadelPairingJoinMode.INVITE_PARTNER,
      paymentMode,
      captainPaid,
    });
    const initialLifecycleStatus = mapRegistrationToPairingLifecycle(initialRegistrationStatus, paymentMode);

    const waitlistEnabled = advancedSettings.waitlistEnabled === true;
    const maxEntriesTotal =
      typeof advancedSettings.maxEntriesTotal === "number" && Number.isFinite(advancedSettings.maxEntriesTotal)
        ? Math.floor(advancedSettings.maxEntriesTotal)
        : null;
    const result = await prisma.$transaction(async (tx) => {
      const eventCapacity = await checkPadelEventCapacity({
        tx,
        eventId,
        maxEntriesTotal,
      });
      if (!eventCapacity.ok) {
        if (!waitlistEnabled) {
          throw new Error(eventCapacity.code);
        }
        const entry = await upsertPadelWaitlistEntry({
          tx,
          eventId,
          organizationId,
          categoryId: effectiveCategoryId,
          userId: user.id,
          paymentMode,
          pairingJoinMode: pairingJoinModeRaw ?? PadelPairingJoinMode.INVITE_PARTNER,
          invitedContact: invitedContactNormalized,
        });
        return { kind: "WAITLIST" as const, entry };
      }
      const capacityCheck = await checkPadelCategoryCapacity({
        tx,
        eventId,
        categoryId: effectiveCategoryId,
      });
      if (!capacityCheck.ok) {
        if (!waitlistEnabled) {
          throw new Error(capacityCheck.code);
        }
        const entry = await upsertPadelWaitlistEntry({
          tx,
          eventId,
          organizationId,
          categoryId: effectiveCategoryId,
          userId: user.id,
          paymentMode,
          pairingJoinMode: pairingJoinModeRaw ?? PadelPairingJoinMode.INVITE_PARTNER,
          invitedContact: invitedContactNormalized,
        });
        return { kind: "WAITLIST" as const, entry };
      }

      const created = await tx.padelPairing.create({
        data: {
          eventId,
          organizationId,
          categoryId: effectiveCategoryId,
          payment_mode: paymentMode,
          createdByUserId: user.id,
          player1UserId: user.id,
          createdByTicketId: validatedTicketId,
          partnerInviteToken,
          partnerLinkToken: partnerInviteToken,
          partnerLinkExpiresAt: partnerInviteToken ? partnerLinkExpiresAtNormalized : null,
          partnerInvitedAt: partnerInviteToken ? now : null,
          partnerSwapAllowedUntilAt: deadlineAt,
          deadlineAt,
          guaranteeStatus: paymentMode === "SPLIT" ? "ARMED" : "NONE",
          lockedUntil,
          isPublicOpen,
          pairingJoinMode: pairingJoinModeRaw ?? PadelPairingJoinMode.INVITE_PARTNER,
          slots: {
            create: slotsToCreate,
          },
        },
        include: { slots: true },
      });

      await upsertPadelRegistrationForPairing(tx, {
        pairingId: created.id,
        organizationId,
        eventId,
        status: initialRegistrationStatus,
      });

      await upsertActiveHold(tx, { pairingId: created.id, eventId, ttlMinutes: 30 });
      return { kind: "PAIRING" as const, pairing: { ...created, lifecycleStatus: initialLifecycleStatus } };
    });

    if (result.kind === "WAITLIST") {
      return NextResponse.json(
        { ok: true, waitlist: true, entry: { id: result.entry.id, status: result.entry.status } },
        { status: 200 },
      );
    }

    // Auto-criar perfis de jogador para o organização (roster)
    await syncPlayersFromSlots({
      organizationId,
      slots: result.pairing.slots.map((s) => ({
        profileId: (s as { profileId?: string | null }).profileId ?? null,
        invitedContact: (s as { invitedContact?: string | null }).invitedContact ?? null,
        invitedUserId: (s as { invitedUserId?: string | null }).invitedUserId ?? null,
      })),
    });

    let inviteSent = false;
    if (
      pairingJoinModeRaw === "INVITE_PARTNER" &&
      resolvedTarget &&
      resolvedTarget !== user.id &&
      result.pairing.partnerInviteToken
    ) {
      await queuePairingInvite({
        pairingId: result.pairing.id,
        targetUserId: resolvedTarget,
        inviterUserId: user.id,
        token: result.pairing.partnerInviteToken,
      });
      inviteSent = true;
    }

    const slotForUser =
      result.pairing.slots.find((s) => s.profileId === user.id) ??
      result.pairing.slots.find((s) => s.slot_role === "CAPTAIN") ??
      result.pairing.slots[0] ??
      null;

    return NextResponse.json(
      { ok: true, pairing: result.pairing, inviteSent, slotId: slotForUser?.id ?? null },
      { status: 200 },
    );
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === "CATEGORY_FULL" || err.message === "CATEGORY_PLAYERS_FULL" || err.message === "EVENT_FULL")
    ) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
    }
    console.error("[padel/pairings][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// GET simples para fornecer pairing + ticketTypes (para checkout/claim UI)
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const pairingId = Number(req.nextUrl.searchParams.get("id"));
  const eventId = Number(req.nextUrl.searchParams.get("eventId"));

  if (Number.isFinite(pairingId)) {
    const pairing = await prisma.padelPairing.findUnique({
      where: { id: pairingId },
      include: {
        slots: { include: { playerProfile: true } },
        event: { select: { organizationId: true } },
      },
    });
    if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const isParticipant =
      pairing.player1UserId === user.id ||
      pairing.player2UserId === user.id ||
      pairing.slots.some((s) => s.profileId === user.id);
    if (!isParticipant) {
      const { organization } = await getActiveOrganizationForUser(user.id, {
        organizationId: pairing.organizationId,
        roles: allowedRoles,
      });
      if (!organization) {
        return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
      }
    }

    const ticketTypes = await prisma.ticketType.findMany({
      where: {
        eventId: pairing.eventId,
        status: "ON_SALE",
        ...(pairing.categoryId
          ? { padelEventCategoryLink: { padelCategoryId: pairing.categoryId } }
          : {}),
      },
      select: { id: true, name: true, price: true, currency: true },
      orderBy: { price: "asc" },
    });

    const padelEvent = await buildPadelEventSnapshot(pairing.eventId);

    return NextResponse.json({ ok: true, pairing, ticketTypes, padelEvent }, { status: 200 });
  }

  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!event?.organizationId) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: allowedRoles,
  });
  if (!organization) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const pairings = await prisma.padelPairing.findMany({
    where: { eventId },
    include: {
      slots: { include: { playerProfile: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const mapped = pairings.map(({ payment_mode, partnerInviteToken, slots, ...rest }) => ({
    ...rest,
    paymentMode: payment_mode,
    inviteToken: partnerInviteToken,
    slots: slots.map(({ slot_role, ...slotRest }) => ({
      ...slotRest,
      slotRole: slot_role,
    })),
  }));

  return NextResponse.json({ ok: true, pairings: mapped }, { status: 200 });
}
