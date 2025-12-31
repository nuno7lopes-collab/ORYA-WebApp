export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { randomUUID } from "crypto";
import { clampDeadlineHours, computePartnerLinkExpiresAt, computeSplitDeadlineAt } from "@/domain/padelDeadlines";
import { queuePairingInvite } from "@/domain/notifications/splitPayments";
import { readNumericParam } from "@/lib/routeParams";

// Regenera token de convite para um pairing (v2). Apenas capitão ou staff OWNER/ADMIN.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pairingId = readNumericParam(params?.id, req, "pairings");
  if (pairingId === null) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const expiresMinutesRaw = typeof body?.expiresMinutes === "number" ? body.expiresMinutes : null;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId : null;

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: {
      event: {
        select: {
          organizerId: true,
          startsAt: true,
          padelTournamentConfig: { select: { splitDeadlineHours: true } },
        },
      },
    },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (pairing.player2UserId) {
    return NextResponse.json({ ok: false, error: "INVITE_ALREADY_USED" }, { status: 409 });
  }
  if (!pairing.partnerInviteToken) {
    // se não existe, seguimos para criar mesmo assim
  }

  const isCaptain = pairing.createdByUserId === user.id;
  let isStaff = false;
  if (!isCaptain) {
    const staff = await prisma.organizerMember.findFirst({
      where: {
        organizerId: pairing.organizerId,
        userId: user.id,
        role: { in: ["OWNER", "CO_OWNER", "ADMIN"] },
      },
      select: { id: true },
    });
    isStaff = Boolean(staff);
  }
  if (!isCaptain && !isStaff) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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
    return NextResponse.json({ ok: false, error: "SPLIT_DEADLINE_PASSED" }, { status: 409 });
  }

  const updated = await prisma.padelPairing.update({
    where: { id: pairingId },
    data: {
      partnerInviteToken: token,
      partnerLinkToken: token,
      partnerLinkExpiresAt: expiresAt,
      partnerInvitedAt: now,
      deadlineAt,
      partnerSwapAllowedUntilAt: deadlineAt,
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

  return NextResponse.json({ ok: true, invite: updated }, { status: 200 });
}
