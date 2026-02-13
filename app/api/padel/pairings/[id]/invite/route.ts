export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { randomUUID } from "crypto";
import { clampDeadlineHours, computePartnerLinkExpiresAt, computeSplitDeadlineAt } from "@/domain/padelDeadlines";
import { queuePairingInvite } from "@/domain/notifications/splitPayments";
import { readNumericParam } from "@/lib/routeParams";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { ensurePadelRatingActionAllowed } from "@/app/api/padel/_ratingGate";

const pairingSelect = {
  id: true,
  organizationId: true,
  createdByUserId: true,
  player2UserId: true,
  partnerInviteToken: true,
  payment_mode: true,
  event: {
    select: {
      organizationId: true,
      startsAt: true,
      padelTournamentConfig: { select: { splitDeadlineHours: true } },
    },
  },
  slots: {
    select: {
      id: true,
      slot_role: true,
    },
  },
} satisfies Prisma.PadelPairingSelect;

// Regenera token de convite para um pairing (v2). Apenas capitão ou staff OWNER/ADMIN.
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const expiresMinutesRaw = typeof body?.expiresMinutes === "number" ? body.expiresMinutes : null;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : null;

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: pairingSelect,
  });
  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.player2UserId) {
    return jsonWrap({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 409 });
  }
  if (!pairing.partnerInviteToken) {
    // se não existe, seguimos para criar mesmo assim
  }

  const isCaptain = pairing.createdByUserId === user.id;
  let isStaff = false;
  if (!isCaptain) {
    const membership = await resolveGroupMemberForOrg({
      organizationId: pairing.organizationId,
      userId: user.id,
    });
    isStaff = Boolean(membership && ["OWNER", "CO_OWNER", "ADMIN"].includes(membership.role));
  }
  if (!isCaptain && !isStaff) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  if (isCaptain && !isStaff) {
    const ratingGate = await ensurePadelRatingActionAllowed({
      organizationId: pairing.event.organizationId,
      userId: user.id,
    });
    if (!ratingGate.ok) {
      return jsonWrap(
        {
          ok: false,
          error: ratingGate.error,
          blockedUntil: ratingGate.blockedUntil,
        },
        { status: 423 },
      );
    }
  }

  const now = new Date();
  const token = randomUUID();
  const expiresAt = computePartnerLinkExpiresAt(now, expiresMinutesRaw);

  const deadlineAt = computeSplitDeadlineAt(
    now,
    pairing.event?.startsAt ?? null,
    clampDeadlineHours(pairing.event?.padelTournamentConfig?.splitDeadlineHours ?? undefined),
  );
  if (pairing.payment_mode === "SPLIT" && deadlineAt.getTime() <= now.getTime()) {
    return jsonWrap({ ok: false, error: "SPLIT_DEADLINE_PASSED" }, { status: 409 });
  }

  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
  const updated = await prisma.padelPairing.update({
    where: { id: pairingId },
    data: {
      partnerInviteToken: token,
      partnerLinkToken: token,
      partnerLinkExpiresAt: expiresAt,
      partnerInvitedAt: now,
      deadlineAt,
      partnerSwapAllowedUntilAt: deadlineAt,
      ...(targetUserId && partnerSlot
        ? {
            slots: {
              update: {
                where: { id: partnerSlot.id },
                data: {
                  invitedUserId: targetUserId,
                  invitedContact: null,
                },
              },
            },
          }
        : {}),
    },
    select: { id: true, partnerInviteToken: true, partnerLinkExpiresAt: true },
  });

  if (targetUserId) {
    await queuePairingInvite({
      pairingId,
      targetUserId,
      inviterUserId: user.id,
      token,
    });
  }

  return jsonWrap({ ok: true, invite: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
