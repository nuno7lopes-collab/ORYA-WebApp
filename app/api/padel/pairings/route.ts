export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  Gender,
  PadelEligibilityType,
  PadelPairingLifecycleStatus,
  PadelPairingPaymentStatus,
  PadelPairingSlotRole,
  PadelPairingSlotStatus,
  PadelPaymentMode,
  PadelPairingJoinMode,
  OrganizerMemberRole,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { buildPadelEventSnapshot } from "@/lib/padel/eventSnapshot";
import { validateEligibility } from "@/domain/padelEligibility";
import { upsertActiveHold } from "@/domain/padelPairingHold";
import {
  clampDeadlineHours,
  computeDeadlineAt,
  computePartnerLinkExpiresAt,
} from "@/domain/padelDeadlines";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { isPadelStaff } from "@/lib/padel/staff";
import { checkPadelCategoryLimit } from "@/domain/padelCategoryLimit";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

async function syncPlayersFromSlots({
  organizerId,
  slots,
}: {
  organizerId: number;
  slots: Array<{
    profileId: string | null;
    invitedContact: string | null;
  }>;
}) {
  const profileIds = Array.from(
    new Set(slots.map((s) => s.profileId).filter(Boolean) as string[]),
  );

  // 1) Jogadores ligados a perfis existentes
  if (profileIds.length > 0) {
    const profiles = await prisma.profile.findMany({
      where: { id: { in: profileIds } },
      select: { id: true, fullName: true, contactPhone: true },
    });
    for (const profile of profiles) {
      const exists = await prisma.padelPlayerProfile.findFirst({
        where: { organizerId, userId: profile.id },
        select: { id: true },
      });
      if (exists) continue;
      const fullName = profile.fullName?.trim() || "Jogador ORYA";
      await prisma.padelPlayerProfile.create({
        data: {
          organizerId,
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
        where: { organizerId, email },
        select: { id: true },
      });
      if (exists) continue;
    }
    await prisma.padelPlayerProfile.create({
      data: {
        organizerId,
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
  const organizerIdRaw = body && typeof body.organizerId === "number" ? body.organizerId : Number(body?.organizerId);
  const categoryId = body && typeof body.categoryId === "number" ? body.categoryId : body?.categoryId === null ? null : Number(body?.categoryId);
  const paymentMode = typeof body?.paymentMode === "string" ? (body?.paymentMode as PadelPaymentMode) : null;
  const pairingJoinModeRaw = typeof body?.pairingJoinMode === "string" ? (body?.pairingJoinMode as PadelPairingJoinMode) : "INVITE_PARTNER";
  const createdByTicketId = typeof body?.createdByTicketId === "string" ? body?.createdByTicketId : null;
  const inviteToken = typeof body?.inviteToken === "string" ? body?.inviteToken : null;
  const inviteExpiresAt = body?.inviteExpiresAt ? new Date(String(body.inviteExpiresAt)) : null;
  const lockedUntil = body?.lockedUntil ? new Date(String(body.lockedUntil)) : null;
  const isPublicOpen = Boolean(body?.isPublicOpen);
  const invitedContactNormalized =
    typeof body?.invitedContact === "string" && body.invitedContact.trim().length > 0
      ? body.invitedContact.trim()
      : null;

  if (!eventId || !paymentMode || !["FULL", "SPLIT"].includes(paymentMode)) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  // Resolver organizer + flag padel v2
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizerId: true,
      padelTournamentConfig: { select: { padelV2Enabled: true } },
    },
  });
  if (!event || !event.padelTournamentConfig?.padelV2Enabled) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_PADDEL_V2" }, { status: 400 });
  }
  const organizerId = Number.isFinite(organizerIdRaw) && organizerIdRaw ? organizerIdRaw : event.organizerId;
  if (!organizerId) {
    return NextResponse.json({ ok: false, error: "ORGANIZER_MISSING" }, { status: 400 });
  }

  // Basic guard: only proceed if padel_v2_enabled is active on the tournament config.
  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: {
      padelV2Enabled: true,
      organizerId: true,
      eligibilityType: true,
      splitDeadlineHours: true,
      defaultCategoryId: true,
    },
  });
  if (!config?.padelV2Enabled || config.organizerId !== organizerId) {
    return NextResponse.json({ ok: false, error: "PADEL_V2_DISABLED" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { gender: true },
  });

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

  // Invariante: 1 pairing ativo por evento+categoria+user
  const existingActive = await prisma.padelPairing.findFirst({
    where: {
      eventId,
      lifecycleStatus: { not: "CANCELLED_INCOMPLETE" },
      categoryId: effectiveCategoryId,
      OR: [{ player1UserId: user.id }, { player2UserId: user.id }],
    },
    include: { slots: true },
  });
  if (existingActive) {
    const updates: Record<string, unknown> = {};
    const slotUpdates: Record<string, unknown> = {};
    const partnerSlot = existingActive.slots.find((s) => s.slot_role === "PARTNER");
    const canUpdatePartner = partnerSlot && !partnerSlot.profileId;

    if (paymentMode && existingActive.payment_mode !== paymentMode) {
      updates.payment_mode = paymentMode;
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
        if (invitedContactNormalized && partnerSlot?.invitedContact !== invitedContactNormalized) {
          slotUpdates.invitedContact = invitedContactNormalized;
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
          include: { slots: true },
        })
      : existingActive;

    await upsertActiveHold(prisma, { pairingId: pairingReturn.id, eventId, ttlMinutes: 30 });
    return NextResponse.json({ ok: true, pairing: pairingReturn }, { status: 200 });
  }

  let validatedTicketId: string | null = null;
  if (createdByTicketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: createdByTicketId },
      select: {
        id: true,
        eventId: true,
        status: true,
        userId: true,
        ownerUserId: true,
        pairingId: true,
        ticketType: {
          select: {
            padelEventCategoryLinkId: true,
            padelEventCategoryLink: { select: { padelCategoryId: true } },
          },
        },
      },
    });
    if (!ticket || ticket.eventId !== eventId || ticket.status !== "ACTIVE") {
      return NextResponse.json({ ok: false, error: "INVALID_TICKET" }, { status: 400 });
    }
    if (ticket.userId !== user.id && ticket.ownerUserId !== user.id) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN_TICKET" }, { status: 403 });
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
    const deadlineAt = computeDeadlineAt(now, clampedDeadlineHours);
    const partnerLinkExpiresAtNormalized =
      inviteExpiresAt && !Number.isNaN(inviteExpiresAt.getTime())
        ? inviteExpiresAt
        : computePartnerLinkExpiresAt(now, undefined);
    const partnerInviteToken =
      pairingJoinModeRaw === "INVITE_PARTNER"
        ? inviteToken || randomUUID()
        : null;

    const initialLifecycleStatus = captainPaid
      ? paymentMode === "FULL"
        ? PadelPairingLifecycleStatus.CONFIRMED_CAPTAIN_FULL
        : PadelPairingLifecycleStatus.PENDING_PARTNER_PAYMENT
      : PadelPairingLifecycleStatus.PENDING_ONE_PAID;

    const pairing = await prisma.$transaction(async (tx) => {
      const created = await tx.padelPairing.create({
        data: {
          eventId,
          organizerId,
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
          lifecycleStatus: initialLifecycleStatus,
          slots: {
            create: slotsToCreate,
          },
        },
        include: { slots: true },
      });

      await upsertActiveHold(tx, { pairingId: created.id, eventId, ttlMinutes: 30 });
      return created;
    });

    // Auto-criar perfis de jogador para o organizador (roster)
    await syncPlayersFromSlots({
      organizerId,
      slots: pairing.slots.map((s) => ({
        profileId: (s as { profileId?: string | null }).profileId ?? null,
        invitedContact: (s as { invitedContact?: string | null }).invitedContact ?? null,
      })),
    });

    return NextResponse.json({ ok: true, pairing }, { status: 200 });
  } catch (err) {
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
        event: { select: { organizerId: true } },
      },
    });
    if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const isParticipant =
      pairing.player1UserId === user.id ||
      pairing.player2UserId === user.id ||
      pairing.slots.some((s) => s.profileId === user.id);
    if (!isParticipant) {
      const { organizer } = await getActiveOrganizerForUser(user.id, {
        organizerId: pairing.organizerId,
        roles: allowedRoles,
      });
      const isStaff = await isPadelStaff(user.id, pairing.organizerId, pairing.eventId);
      if (!organizer && !isStaff) {
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
    select: { organizerId: true },
  });
  if (!event?.organizerId) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }
  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId,
    roles: allowedRoles,
  });
  const isStaff = await isPadelStaff(user.id, event.organizerId, eventId);
  if (!organizer && !isStaff) {
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
