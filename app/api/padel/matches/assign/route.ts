export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, Prisma, padel_match_status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

const parseOptionalId = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const matchId = parseOptionalId(body.matchId ?? body.id);
  if (!matchId) return jsonWrap({ ok: false, error: "INVALID_MATCH" }, { status: 400 });
  const pairingAId = parseOptionalId(body.pairingAId ?? null);
  const pairingBId = parseOptionalId(body.pairingBId ?? null);
  if (pairingAId && pairingBId && pairingAId === pairingBId) {
    return jsonWrap({ ok: false, error: "DUPLICATE_PAIRING" }, { status: 400 });
  }

  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      eventId: true,
      categoryId: true,
      roundType: true,
      roundLabel: true,
      status: true,
      event: { select: { organizationId: true } },
    },
  });
  if (!match || !match.event?.organizationId) {
    return jsonWrap({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }
  const organizationId = match.event.organizationId;
  if (match.roundType !== "KNOCKOUT") {
    return jsonWrap({ ok: false, error: "MATCH_NOT_KNOCKOUT" }, { status: 409 });
  }
  if (match.status !== padel_match_status.PENDING) {
    return jsonWrap({ ok: false, error: "MATCH_LOCKED" }, { status: 409 });
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const matchCategoryFilter = match.categoryId ? { categoryId: match.categoryId } : {};
  const started = await prisma.eventMatchSlot.findFirst({
    where: {
      eventId: match.eventId,
      roundType: "KNOCKOUT",
      status: { in: [padel_match_status.IN_PROGRESS, padel_match_status.DONE] },
      ...matchCategoryFilter,
    },
    select: { id: true },
  });
  if (started) {
    return jsonWrap({ ok: false, error: "KO_LOCKED" }, { status: 409 });
  }

  const pairingIds = [pairingAId, pairingBId].filter(Boolean) as number[];
  if (pairingIds.length > 0) {
    const pairings = await prisma.padelPairing.findMany({
      where: { id: { in: pairingIds }, eventId: match.eventId },
      select: { id: true, categoryId: true, pairingStatus: true, registration: { select: { status: true } } },
    });
    if (pairings.length !== pairingIds.length) {
      return jsonWrap({ ok: false, error: "PAIRING_NOT_FOUND" }, { status: 404 });
    }
    const invalid = pairings.find(
      (p) =>
        (match.categoryId && p.categoryId !== match.categoryId) ||
        p.pairingStatus !== "COMPLETE" ||
        p.registration?.status !== "CONFIRMED",
    );
    if (invalid) {
      return jsonWrap({ ok: false, error: "PAIRING_INVALID" }, { status: 409 });
    }

    const conflict = await prisma.eventMatchSlot.findFirst({
      where: {
        eventId: match.eventId,
        roundType: "KNOCKOUT",
        roundLabel: match.roundLabel,
        id: { not: match.id },
        ...matchCategoryFilter,
        OR: [{ pairingAId: { in: pairingIds } }, { pairingBId: { in: pairingIds } }],
      },
      select: { id: true },
    });
    if (conflict) {
      return jsonWrap({ ok: false, error: "PAIRING_ALREADY_ASSIGNED" }, { status: 409 });
    }
  }

  const data: Prisma.EventMatchSlotUncheckedUpdateInput = {
    pairingAId: pairingAId ?? null,
    pairingBId: pairingBId ?? null,
    winnerPairingId: null,
    status: padel_match_status.PENDING,
    score: {} as Prisma.InputJsonValue,
    scoreSets: Prisma.DbNull,
  };

  const { match: updated } = await updatePadelMatch({
    matchId: match.id,
    eventId: match.eventId,
    organizationId,
    actorUserId: user.id,
    beforeStatus: match.status ?? null,
    data,
    select: { id: true, pairingAId: true, pairingBId: true, roundLabel: true },
  });

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: match.eventId },
    select: { advancedSettings: true },
  });
  if (config) {
    const advanced = (config.advancedSettings as Record<string, unknown>) ?? {};
    await prisma.padelTournamentConfig.update({
      where: { eventId: match.eventId },
      data: {
        advancedSettings: {
          ...advanced,
          koManual: true,
          koManualAt: new Date().toISOString(),
        },
      },
    });
  }

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_ASSIGN",
    metadata: {
      matchId: match.id,
      eventId: match.eventId,
      pairingAId: updated.pairingAId ?? null,
      pairingBId: updated.pairingBId ?? null,
    },
  });

  return jsonWrap({ ok: true, match: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
