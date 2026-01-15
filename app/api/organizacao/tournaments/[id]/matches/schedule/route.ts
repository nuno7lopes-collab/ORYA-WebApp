import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { canReschedule } from "@/domain/tournaments/schedulePolicy";
import { readNumericParam } from "@/lib/routeParams";

async function ensureOrganizationAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({ where: { id: eventId }, select: { organizationId: true } });
  if (!evt?.organizationId) return false;
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { onboardingDone: true, fullName: true, username: true },
  });
  const hasUserOnboarding =
    profile?.onboardingDone ||
    (Boolean(profile?.fullName?.trim()) && Boolean(profile?.username?.trim()));
  if (!hasUserOnboarding) return false;
  const member = await prisma.organizationMember.findFirst({
    where: { organizationId: evt.organizationId, userId, role: { in: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"] } },
    select: { id: true },
  });
  return Boolean(member);
}

type ScheduleItem = { matchId: number; courtId?: number | null; startAt?: string | null };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const tournamentId = readNumericParam(resolved?.id, req, "tournaments");
  if (tournamentId === null) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items: ScheduleItem[] = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ ok: false, error: "EMPTY_PAYLOAD" }, { status: 400 });

  // Confirm organization access using first match -> stage -> tournament -> event
  const firstMatch = await prisma.tournamentMatch.findUnique({
    where: { id: items[0]?.matchId ?? -1 },
    include: { stage: { select: { tournamentId: true, tournament: { select: { eventId: true } } } } },
  });
  if (!firstMatch || firstMatch.stage.tournamentId !== tournamentId) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const authorized = await ensureOrganizationAccess(data.user.id, firstMatch.stage.tournament.eventId);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

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

        const canEdit = canReschedule(m.status, newStart);
        if (!canEdit) {
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
      await tx.tournamentAuditLog.create({
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
      return NextResponse.json({ ok: false, error: "START_AT_IN_PAST_OR_LOCKED" }, { status: 400 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, updated: updatedIds.length, changes }, { status: 200 });
}
