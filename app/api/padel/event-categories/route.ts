export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  OrganizerMemberRole,
  padel_format,
  PadelPairingLifecycleStatus,
  PadelPairingSlotStatus,
  PadelPairingStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { refundKey } from "@/lib/stripe/idempotency";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

type LinkInput = {
  padelCategoryId?: number | null;
  format?: string | null;
  capacityTeams?: number | null;
  capacityPlayers?: number | null;
  liveStreamUrl?: string | null;
  isEnabled?: boolean;
  isHidden?: boolean;
};

async function queueCategoryRefunds(params: {
  eventId: number;
  linkId: number;
  refundedBy: string;
}) {
  const { eventId, linkId, refundedBy } = params;

  const ticketTypeIds = await prisma.ticketType.findMany({
    where: { padelEventCategoryLinkId: linkId },
    select: { id: true },
  });

  const ids = ticketTypeIds.map((t) => t.id);
  if (!ids.length) return 0;

  const summaries = await prisma.saleSummary.findMany({
    where: {
      eventId,
      status: "PAID",
      lines: { some: { ticketTypeId: { in: ids } } },
    },
    select: { purchaseId: true, paymentIntentId: true },
  });

  await Promise.all(
    summaries.map((summary) =>
      enqueueOperation({
        operationType: "PROCESS_REFUND_SINGLE",
        dedupeKey: refundKey(summary.purchaseId ?? summary.paymentIntentId ?? "unknown"),
        correlations: {
          eventId,
          purchaseId: summary.purchaseId ?? null,
          paymentIntentId: summary.paymentIntentId ?? null,
        },
        payload: {
          eventId,
          purchaseId: summary.purchaseId ?? summary.paymentIntentId ?? null,
          paymentIntentId: summary.paymentIntentId ?? null,
          reason: "CANCELLED",
          refundedBy,
          auditPayload: { categoryLinkId: linkId },
        },
      }),
    ),
  );

  return summaries.length;
}

async function cancelCategoryActivity(params: { eventId: number; categoryId: number }) {
  const { eventId, categoryId } = params;
  await prisma.$transaction(async (tx) => {
    await tx.padelPairingSlot.updateMany({
      where: { pairing: { eventId, categoryId } },
      data: { slotStatus: PadelPairingSlotStatus.CANCELLED },
    });
    await tx.padelPairing.updateMany({
      where: { eventId, categoryId },
      data: {
        pairingStatus: PadelPairingStatus.CANCELLED,
        lifecycleStatus: PadelPairingLifecycleStatus.CANCELLED_INCOMPLETE,
        partnerInviteToken: null,
        partnerInviteUsedAt: null,
        partnerLinkToken: null,
        partnerLinkExpiresAt: null,
        lockedUntil: null,
      },
    });
    await tx.padelPairingHold.updateMany({
      where: { pairing: { eventId, categoryId }, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    await tx.padelMatch.updateMany({
      where: { eventId, categoryId },
      data: { status: "CANCELLED" },
    });
  });
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizerId: true },
  });
  if (!event?.organizerId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId,
    roles: allowedRoles,
  });
  if (!organizer || !membership) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const links = await prisma.padelEventCategoryLink.findMany({
    where: { eventId },
    include: {
      category: {
        select: {
          id: true,
          label: true,
          genderRestriction: true,
          minLevel: true,
          maxLevel: true,
          isActive: true,
        },
      },
    },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ ok: true, items: links }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const linksInput = Array.isArray(body.links) ? (body.links as LinkInput[]) : [];

  if (!Number.isFinite(eventId) || linksInput.length === 0) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizerId: true, startsAt: true },
  });
  if (!event?.organizerId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId,
    roles: allowedRoles,
  });
  if (!organizer || !membership) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const organizerCategories = await prisma.padelCategory.findMany({
    where: { organizerId: organizer.id },
    select: { id: true },
  });
  const validCategoryIds = new Set(organizerCategories.map((c) => c.id));

  const existing = await prisma.padelEventCategoryLink.findMany({
    where: { eventId },
    select: { id: true, padelCategoryId: true, isEnabled: true },
  });
  const existingByCategory = new Map(existing.map((l) => [l.padelCategoryId, l]));

  const now = new Date();
  if (event.startsAt && event.startsAt.getTime() <= now.getTime()) {
    const disabling = linksInput.some((link) => link.isEnabled === false);
    if (disabling) {
      return NextResponse.json({ ok: false, error: "CATEGORY_CANCEL_AFTER_START" }, { status: 409 });
    }
  }

  const allowedFormats = new Set<string>(Object.values(padel_format));

  const updates = linksInput.map((link) => {
    const padelCategoryId = typeof link.padelCategoryId === "number" ? link.padelCategoryId : null;
    if (!padelCategoryId || !validCategoryIds.has(padelCategoryId)) {
      throw new Error("INVALID_CATEGORY");
    }
    const format = typeof link.format === "string" && allowedFormats.has(link.format) ? (link.format as any) : undefined;

    return prisma.padelEventCategoryLink.upsert({
      where: { eventId_padelCategoryId: { eventId, padelCategoryId } },
      update: {
        format: format ?? undefined,
        capacityTeams: typeof link.capacityTeams === "number" ? link.capacityTeams : null,
        capacityPlayers: typeof link.capacityPlayers === "number" ? link.capacityPlayers : null,
        liveStreamUrl: typeof link.liveStreamUrl === "string" ? link.liveStreamUrl.trim() || null : null,
        isEnabled: typeof link.isEnabled === "boolean" ? link.isEnabled : undefined,
        isHidden: typeof link.isHidden === "boolean" ? link.isHidden : undefined,
      },
      create: {
        eventId,
        padelCategoryId,
        format: format ?? undefined,
        capacityTeams: typeof link.capacityTeams === "number" ? link.capacityTeams : null,
        capacityPlayers: typeof link.capacityPlayers === "number" ? link.capacityPlayers : null,
        liveStreamUrl: typeof link.liveStreamUrl === "string" ? link.liveStreamUrl.trim() || null : null,
        isEnabled: typeof link.isEnabled === "boolean" ? link.isEnabled : true,
        isHidden: typeof link.isHidden === "boolean" ? link.isHidden : false,
      },
    });
  });

  try {
    const updated = await prisma.$transaction(updates);

    const refundsTriggered: Array<{ linkId: number; count: number }> = [];
    for (const link of updated) {
      const previous = existingByCategory.get(link.padelCategoryId);
      if (previous?.isEnabled && !link.isEnabled) {
        const count = await queueCategoryRefunds({ eventId, linkId: link.id, refundedBy: user.id });
        await cancelCategoryActivity({ eventId, categoryId: link.padelCategoryId });
        refundsTriggered.push({ linkId: link.id, count });
      }
    }

    return NextResponse.json({ ok: true, items: updated, refundsTriggered }, { status: 200 });
  } catch (err) {
    if ((err as Error).message === "INVALID_CATEGORY") {
      return NextResponse.json({ ok: false, error: "INVALID_CATEGORY" }, { status: 400 });
    }
    console.error("[padel/event-categories][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
