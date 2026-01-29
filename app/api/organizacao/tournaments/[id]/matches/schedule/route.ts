import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { canReschedule } from "@/domain/tournaments/schedulePolicy";
import { readNumericParam } from "@/lib/routeParams";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

async function ensureOrganizationAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizationId: true,
      organization: { select: { officialEmail: true, officialEmailVerifiedAt: true } },
    },
  });
  if (!evt?.organizationId) return false;
  const emailGate = ensureOrganizationEmailVerified(evt.organization ?? {}, { reasonCode: "TOURNAMENTS_MATCH_SCHEDULE" });
  if (!emailGate.ok) return { ...emailGate, status: 403 };
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  const resolved = await params;
  const tournamentId = readNumericParam(resolved?.id, req, "tournaments");
  if (tournamentId === null) return fail(400, "INVALID_ID");

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return fail(401, "UNAUTHENTICATED");

  const body = await req.json().catch(() => ({}));
  const items: ScheduleItem[] = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return fail(400, "EMPTY_PAYLOAD");

  // Confirm organization access using first match -> stage -> tournament -> event
  const firstMatch = await prisma.tournamentMatch.findUnique({
    where: { id: items[0]?.matchId ?? -1 },
    include: { stage: { select: { tournamentId: true, tournament: { select: { eventId: true } } } } },
  });
  if (!firstMatch || firstMatch.stage.tournamentId !== tournamentId) {
    return fail(404, "NOT_FOUND");
  }

  const authorized = await ensureOrganizationAccess(data.user.id, firstMatch.stage.tournament.eventId);
  if (authorized !== true) {
    if (authorized && typeof authorized === "object" && "error" in authorized) {
      return respondError(
        ctx,
        {
          errorCode: authorized.error ?? "FORBIDDEN",
          message: authorized.message ?? authorized.error ?? "Sem permissões.",
          retryable: false,
          details: authorized,
        },
        { status: authorized.status ?? 403 },
      );
    }
    return fail(403, "FORBIDDEN");
  }

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
      return fail(400, "START_AT_IN_PAST_OR_LOCKED");
    }
    throw err;
  }

  return respondOk(ctx, { updated: updatedIds.length, changes }, { status: 200 });
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
