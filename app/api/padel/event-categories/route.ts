export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  OrganizationMemberRole,
  padel_format,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelRegistrationStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { refundKey } from "@/lib/stripe/idempotency";
import { transitionPadelRegistrationStatus } from "@/domain/padelRegistration";
import { updatePadelMatch } from "@/domain/padel/matches/commands";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

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

async function cancelCategoryActivity(params: { eventId: number; categoryId: number; organizationId: number; actorUserId: string }) {
  const { eventId, categoryId, organizationId, actorUserId } = params;
  await prisma.$transaction(async (tx) => {
    await tx.padelPairingSlot.updateMany({
      where: { pairing: { eventId, categoryId } },
      data: { slotStatus: PadelPairingSlotStatus.CANCELLED },
    });
    await tx.padelPairing.updateMany({
      where: { eventId, categoryId },
      data: {
        pairingStatus: PadelPairingStatus.CANCELLED,
        partnerInviteToken: null,
        partnerInviteUsedAt: null,
        partnerLinkToken: null,
        partnerLinkExpiresAt: null,
        lockedUntil: null,
      },
    });
    const registrations = await tx.padelRegistration.findMany({
      where: { pairing: { eventId, categoryId } },
      select: { pairingId: true },
    });
    for (const reg of registrations) {
      if (!reg.pairingId) continue;
      await transitionPadelRegistrationStatus(tx, {
        pairingId: reg.pairingId,
        status: PadelRegistrationStatus.CANCELLED,
        reason: "CATEGORY_CANCELLED",
      });
    }
    await tx.padelPairingHold.updateMany({
      where: { pairing: { eventId, categoryId }, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    const matches = await tx.eventMatchSlot.findMany({
      where: { eventId, categoryId },
      select: { id: true },
    });
    for (const match of matches) {
      await updatePadelMatch({
        tx,
        matchId: match.id,
        eventId,
        organizationId,
        actorUserId,
        eventType: "PADEL_MATCH_SYSTEM_UPDATED",
        data: { status: "CANCELLED" },
      });
    }
    await tx.tournamentEntry.updateMany({
      where: { eventId, categoryId },
      data: { status: "CANCELLED" },
    });
  });
}

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true },
  });
  if (!event?.organizationId) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

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

  return jsonWrap({ ok: true, items: links }, { status: 200 });
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const linksInput = Array.isArray(body.links) ? (body.links as LinkInput[]) : [];

  if (!Number.isFinite(eventId) || linksInput.length === 0) {
    return jsonWrap({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true, startsAt: true },
  });
  if (!event?.organizationId) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const organizationCategories = await prisma.padelCategory.findMany({
    where: { organizationId: organization.id },
    select: { id: true },
  });
  const validCategoryIds = new Set(organizationCategories.map((c) => c.id));

  const existing = await prisma.padelEventCategoryLink.findMany({
    where: { eventId },
    select: { id: true, padelCategoryId: true, isEnabled: true },
  });
  const existingByCategory = new Map(existing.map((l) => [l.padelCategoryId, l]));

  const now = new Date();
  if (event.startsAt && event.startsAt.getTime() <= now.getTime()) {
    const disabling = linksInput.some((link) => link.isEnabled === false);
    if (disabling) {
      return jsonWrap({ ok: false, error: "CATEGORY_CANCEL_AFTER_START" }, { status: 409 });
    }
  }

  const allowedFormats = new Set<string>(Object.values(padel_format));

  const updates = linksInput.map((link) => {
    const padelCategoryId = typeof link.padelCategoryId === "number" ? link.padelCategoryId : null;
    if (!padelCategoryId || !validCategoryIds.has(padelCategoryId)) {
      throw new Error("INVALID_CATEGORY");
    }
    const format = typeof link.format === "string" && allowedFormats.has(link.format) ? (link.format as any) : undefined;
    const capacityTeams =
      typeof link.capacityTeams === "number" && Number.isFinite(link.capacityTeams) && link.capacityTeams > 0
        ? Math.floor(link.capacityTeams)
        : null;
    const capacityPlayers =
      typeof link.capacityPlayers === "number" && Number.isFinite(link.capacityPlayers) && link.capacityPlayers > 0
        ? Math.floor(link.capacityPlayers)
        : null;

    return prisma.padelEventCategoryLink.upsert({
      where: { eventId_padelCategoryId: { eventId, padelCategoryId } },
      update: {
        format: format ?? undefined,
        capacityTeams,
        capacityPlayers,
        liveStreamUrl: typeof link.liveStreamUrl === "string" ? link.liveStreamUrl.trim() || null : null,
        isEnabled: typeof link.isEnabled === "boolean" ? link.isEnabled : undefined,
        isHidden: typeof link.isHidden === "boolean" ? link.isHidden : undefined,
      },
      create: {
        eventId,
        padelCategoryId,
        format: format ?? undefined,
        capacityTeams,
        capacityPlayers,
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
        await cancelCategoryActivity({
          eventId,
          categoryId: link.padelCategoryId,
          organizationId: organization.id,
          actorUserId: user.id,
        });
        refundsTriggered.push({ linkId: link.id, count });
      }
    }

    return jsonWrap({ ok: true, items: updated, refundsTriggered }, { status: 200 });
  } catch (err) {
    if ((err as Error).message === "INVALID_CATEGORY") {
      return jsonWrap({ ok: false, error: "INVALID_CATEGORY" }, { status: 400 });
    }
    console.error("[padel/event-categories][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);