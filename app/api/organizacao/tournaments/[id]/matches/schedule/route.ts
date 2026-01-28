import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { canReschedule } from "@/domain/tournaments/schedulePolicy";
import { readNumericParam } from "@/lib/routeParams";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function ensureOrganizationAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizationId: true,
      organization: { select: { officialEmail: true, officialEmailVerifiedAt: true } },
    },
  });
  if (!evt?.organizationId) return false;
  const emailGate = ensureOrganizationEmailVerified(evt.organization ?? {});
  if (!emailGate.ok) return false;
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { onboardingDone: true, fullName: true, username: true },
  });
  const hasUserOnboarding =
    profile?.onboardingDone ||
    (Boolean(profile?.fullName?.trim()) && Boolean(profile?.username?.trim()));
  if (!hasUserOnboarding) return false;
  const access = await ensureGroupMemberModuleAccess({
    organizationId: evt.organizationId,
    userId,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  return access.ok;
}

type ScheduleItem = { matchId: number; courtId?: number | null; startAt?: string | null };

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const tournamentId = readNumericParam(resolved?.id, req, "tournaments");
  if (tournamentId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items: ScheduleItem[] = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return jsonWrap({ ok: false, error: "EMPTY_PAYLOAD" }, { status: 400 });

  // Confirm organization access using first match -> stage -> tournament -> event
  const firstMatch = await prisma.tournamentMatch.findUnique({
    where: { id: items[0]?.matchId ?? -1 },
    include: { stage: { select: { tournamentId: true, tournament: { select: { eventId: true } } } } },
  });
  if (!firstMatch || firstMatch.stage.tournamentId !== tournamentId) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const authorized = await ensureOrganizationAccess(data.user.id, firstMatch.stage.tournament.eventId);
  if (!authorized) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const changes: Array<{ matchId: number; before: any; after: any }> = [];

  let updatedIds: number[] = [];
  try {
    updatedIds = await prisma.$transaction(async (tx) => {
      const results: number[] = [];
      for (const entry of items) {
        const m = await tx.tournamentMatch.findUnique({
          where: { id: entry.matchId },
          include: { stage: { select: { tournamentId: true } } },
        });
        if (!m || m.stage.tournamentId !== tournamentId) continue;

        const newStart = entry.startAt ? new Date(entry.startAt) : null;
        const newCourt = entry.courtId ?? null;

        const editAllowed = canReschedule(m.status, newStart);
        if (!editAllowed) {
          throw new Error("START_AT_IN_PAST_OR_LOCKED");
        }

        const noChange =
          (m.startAt ?? null)?.getTime?.() === (newStart ?? null)?.getTime?.() &&
          (m.courtId ?? null) === (newCourt ?? null);
        if (noChange) continue;

      const before = { startAt: m.startAt, courtId: m.courtId };
      const after = { startAt: newStart, courtId: newCourt };

      await tx.tournamentMatch.update({
        where: { id: m.id },
        data: { startAt: newStart, courtId: newCourt },
      });
      await tx.tournamentAuditLog["create"]({
        data: {
          tournamentId,
          userId: data.user.id,
          action: "UPDATE_SCHEDULE",
          payloadBefore: before,
          payloadAfter: after,
        },
      });
      changes.push({ matchId: m.id, before, after });
      results.push(m.id);
      }
      return results;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "START_AT_IN_PAST_OR_LOCKED") {
      return jsonWrap({ ok: false, error: "START_AT_IN_PAST_OR_LOCKED" }, { status: 400 });
    }
    throw err;
  }

  return jsonWrap({ ok: true, updated: updatedIds.length, changes }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
