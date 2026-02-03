import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationModule, Prisma, TournamentMatchStatus } from "@prisma/client";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
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
  const emailGate = ensureOrganizationEmailVerified(evt.organization ?? {}, {
    reasonCode: "TOURNAMENTS_MATCH_EDIT",
    organizationId: evt.organizationId,
  });
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

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string; matchId: string }> }) {
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
  const tournamentId = Number(resolved?.id);
  const matchId = Number(resolved?.matchId);
  if (!Number.isFinite(tournamentId) || !Number.isFinite(matchId)) {
    return fail(400, "INVALID_ID");
  }

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return fail(401, "UNAUTHENTICATED");

  const match = await prisma.tournamentMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      startAt: true,
      courtId: true,
      status: true,
      score: true,
      roundLabel: true,
      stage: { select: { tournamentId: true, tournament: { select: { eventId: true } } } },
    },
  });
  if (!match || match.stage.tournamentId !== tournamentId) {
    return fail(404, "NOT_FOUND");
  }

  const authorized = await ensureOrganizationAccess(authData.user.id, match.stage.tournament.eventId);
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

  const body = await req.json().catch(() => ({}));
  const { startAt, courtId, status, score, roundLabel } = body ?? {};

  const updates: Record<string, unknown> = {};
  if (startAt) updates.startAt = new Date(startAt);
  if (typeof courtId === "number") updates.courtId = courtId;
  if (roundLabel) updates.roundLabel = roundLabel;
  if (status && Object.values(TournamentMatchStatus).includes(status)) updates.status = status as TournamentMatchStatus;
  if (score) updates.score = score;

  if (Object.keys(updates).length === 0) {
    return fail(400, "NO_CHANGES");
  }

  const before = {
    startAt: match.startAt,
    courtId: match.courtId,
    status: match.status,
    score: match.score,
    roundLabel: match.roundLabel,
  };

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.tournamentMatch.update({
      where: { id: matchId },
      data: updates,
    });

    await tx.tournamentAuditLog["create"]({
      data: {
        tournamentId,
        userId: authData.user.id,
        action: "EDIT_MATCH",
        payloadBefore: before as Prisma.InputJsonValue,
        payloadAfter: updates as Prisma.InputJsonValue,
      },
    });

    return res;
  });

  return respondOk(ctx, { match: updated }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);

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
