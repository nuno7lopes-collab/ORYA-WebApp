import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationMemberRole, Prisma } from "@prisma/client";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const UNDO_WINDOW_MS = 60 * 1000;

async function getOrganizationRole(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({ where: { id: eventId }, select: { organizationId: true } });
  if (!evt?.organizationId) return null;
  const organization = await prisma.organization.findUnique({
    where: { id: evt.organizationId },
    select: { officialEmail: true, officialEmailVerifiedAt: true },
  });
  if (!organization) return null;
  const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "TOURNAMENTS_MATCH_UNDO" });
  if (!emailGate.ok) return { ...emailGate, status: 403 };
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { onboardingDone: true, fullName: true, username: true },
  });
  const hasUserOnboarding =
    profile?.onboardingDone ||
    (Boolean(profile?.fullName?.trim()) && Boolean(profile?.username?.trim()));
  if (!hasUserOnboarding) return null;
  const member = await resolveGroupMemberForOrg({ organizationId: evt.organizationId, userId });
  return member?.role ?? null;
}

async function _POST(_req: NextRequest, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const resolved = await params;
  const tournamentId = Number(resolved?.id);
  const matchId = Number(resolved?.matchId);
  if (!Number.isFinite(tournamentId) || !Number.isFinite(matchId)) {
    return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    include: { stage: { select: { tournamentId: true, tournament: { select: { eventId: true } } } } },
  });
  if (!match || match.stage.tournamentId !== tournamentId) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const organizationRole = await getOrganizationRole(data.user.id, match.stage.tournament.eventId);
  if (organizationRole && typeof organizationRole === "object" && "error" in organizationRole) {
    return jsonWrap(organizationRole, { status: organizationRole.status ?? 403 });
  }
  const liveOperatorRoles: OrganizationMemberRole[] = [
    OrganizationMemberRole.OWNER,
    OrganizationMemberRole.CO_OWNER,
    OrganizationMemberRole.ADMIN,
    OrganizationMemberRole.STAFF,
  ];
  if (!organizationRole || !liveOperatorRoles.includes(organizationRole)) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const recentLogs = await prisma.tournamentAuditLog.findMany({
    where: { tournamentId, action: "EDIT_MATCH_RESULT" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const target = recentLogs.find((log) => {
    const payload = log.payloadAfter as Record<string, unknown> | null;
    return payload?.matchId === matchId;
  });

  if (!target) {
    return jsonWrap({ ok: false, error: "UNDO_NOT_FOUND" }, { status: 404 });
  }

  if (Date.now() - target.createdAt.getTime() > UNDO_WINDOW_MS) {
    return jsonWrap({ ok: false, error: "UNDO_EXPIRED" }, { status: 409 });
  }

  const before = target.payloadBefore as Record<string, unknown> | null;
  const after = target.payloadAfter as Record<string, unknown> | null;
  if (!before || typeof before !== "object") {
    return jsonWrap({ ok: false, error: "UNDO_INVALID" }, { status: 400 });
  }

  const nextMatchId = typeof after?.nextMatchId === "number" ? after.nextMatchId : null;
  const nextSlot = typeof after?.nextSlot === "number" ? after.nextSlot : null;
  const nextSlotBefore = typeof after?.nextSlotBefore === "number" ? after.nextSlotBefore : null;
  const nextSlotAfter = typeof after?.nextSlotAfter === "number" ? after.nextSlotAfter : null;
  const shouldRevertNext = Boolean(after?.propagated && nextMatchId && nextSlot);

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.tournamentMatch.update({
      where: { id: matchId },
      data: {
        status: before.status as any,
        score: before.score ?? {},
      },
    });

    if (shouldRevertNext && nextMatchId && nextSlot) {
      const nextMatch = await tx.tournamentMatch.findUnique({
        where: { id: nextMatchId },
        select: { pairing1Id: true, pairing2Id: true },
      });
      const currentValue = nextSlot === 1 ? nextMatch?.pairing1Id ?? null : nextMatch?.pairing2Id ?? null;
      if (currentValue === nextSlotAfter) {
        await tx.tournamentMatch.update({
          where: { id: nextMatchId },
          data: nextSlot === 1 ? { pairing1Id: nextSlotBefore } : { pairing2Id: nextSlotBefore },
        });
      }
    }

    await tx.tournamentAuditLog["create"]({
      data: {
        tournamentId,
        userId: data.user.id,
        action: "UNDO_MATCH_RESULT",
        payloadBefore: (after ?? {}) as Prisma.InputJsonValue,
        payloadAfter: {
          matchId,
          restored: true,
          sourceLogId: target.id,
        } as Prisma.InputJsonValue,
      },
    });

    return res;
  });

  return jsonWrap({ ok: true, match: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
