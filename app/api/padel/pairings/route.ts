export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PadelPairingPaymentStatus, PadelPairingSlotRole, PadelPairingSlotStatus, PadelPaymentMode } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { buildPadelEventSnapshot } from "@/lib/padel/eventSnapshot";

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
      const exists = await prisma.padelPlayerProfile.findUnique({
        where: { organizerId_email: { organizerId, email } },
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
// Evita mexer no legacy; valida flag padel_v2_enabled.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const eventId = body && typeof body.eventId === "number" ? body.eventId : Number(body?.eventId);
  const organizerId = body && typeof body.organizerId === "number" ? body.organizerId : Number(body?.organizerId);
  const categoryId = body && typeof body.categoryId === "number" ? body.categoryId : body?.categoryId === null ? null : Number(body?.categoryId);
  const paymentMode = typeof body?.paymentMode === "string" ? (body?.paymentMode as PadelPaymentMode) : null;
  const createdByTicketId = typeof body?.createdByTicketId === "string" ? body?.createdByTicketId : null;
  const inviteToken = typeof body?.inviteToken === "string" ? body?.inviteToken : null;
  const inviteExpiresAt = body?.inviteExpiresAt ? new Date(String(body.inviteExpiresAt)) : null;
  const lockedUntil = body?.lockedUntil ? new Date(String(body.lockedUntil)) : null;
  const isPublicOpen = Boolean(body?.isPublicOpen);

  if (!eventId || !organizerId || !paymentMode || !["FULL", "SPLIT"].includes(paymentMode)) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  // Basic guard: only proceed if padel_v2_enabled is active on the tournament config.
  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { padelV2Enabled: true, organizerId: true },
  });
  if (!config?.padelV2Enabled || config.organizerId !== organizerId) {
    return NextResponse.json({ ok: false, error: "PADEL_V2_DISABLED" }, { status: 400 });
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
    const roleRaw = typeof s.slotRole === "string" ? s.slotRole : "PARTNER";
    const statusRaw = typeof s.slotStatus === "string" ? s.slotStatus : "PENDING";
    const payRaw = typeof s.paymentStatus === "string" ? s.paymentStatus : "UNPAID";

    return {
      ticketId: typeof s.ticketId === "string" ? s.ticketId : null,
      profileId: typeof s.profileId === "string" ? s.profileId : null,
      invitedContact: typeof s.invitedContact === "string" ? s.invitedContact : null,
      isPublicOpen: Boolean(s.isPublicOpen),
      slotRole: roleRaw === "CAPTAIN" ? PadelPairingSlotRole.CAPTAIN : PadelPairingSlotRole.PARTNER,
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
  const slotsToCreate =
    incomingSlots.length > 0
      ? (incomingSlots
          .map((slot) => normalizeSlot(slot))
          .filter(Boolean) as Array<{
          ticketId: string | null;
          profileId: string | null;
          invitedContact: string | null;
          isPublicOpen: boolean;
          slotRole: PadelPairingSlotRole;
          slotStatus: PadelPairingSlotStatus;
          paymentStatus: PadelPairingPaymentStatus;
        }>)
      : [
          {
            ticketId: createdByTicketId,
            profileId: user.id,
            invitedContact: null,
            isPublicOpen,
            slotRole: PadelPairingSlotRole.CAPTAIN,
            slotStatus: createdByTicketId ? PadelPairingSlotStatus.FILLED : PadelPairingSlotStatus.PENDING,
            paymentStatus: PadelPairingPaymentStatus.PAID,
          },
          {
            ticketId: null,
            profileId: null,
            invitedContact: null,
            isPublicOpen,
            slotRole: PadelPairingSlotRole.PARTNER,
            slotStatus: PadelPairingSlotStatus.PENDING,
            paymentStatus: paymentMode === "FULL" ? PadelPairingPaymentStatus.PAID : PadelPairingPaymentStatus.UNPAID,
          },
        ];

  try {
    const pairing = await prisma.padelPairing.create({
      data: {
        eventId,
        organizerId,
        categoryId: Number.isFinite(categoryId as number) ? (categoryId as number) : null,
        paymentMode,
        createdByUserId: user.id,
        createdByTicketId,
        inviteToken,
        inviteExpiresAt,
        lockedUntil,
        isPublicOpen,
        slots: {
          create: slotsToCreate,
        },
      },
      include: { slots: true },
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
      },
    });
    if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const ticketTypes = await prisma.ticketType.findMany({
      where: { eventId: pairing.eventId, status: "ON_SALE" },
      select: { id: true, name: true, price: true, currency: true },
      orderBy: { price: "asc" },
    });

    const padelEvent = await buildPadelEventSnapshot(pairing.eventId);

    return NextResponse.json({ ok: true, pairing, ticketTypes, padelEvent }, { status: 200 });
  }

  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const pairings = await prisma.padelPairing.findMany({
    where: { eventId },
    include: {
      slots: { include: { playerProfile: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return NextResponse.json({ ok: true, pairings }, { status: 200 });
}
