import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { readNumericParam } from "@/lib/routeParams";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule, TournamentFormat } from "@prisma/client";
import { updateTournament } from "@/domain/tournaments/commands";
import { requireOfficialEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest, { params }: { params: { id: string } }) {
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
  const tournamentId = readNumericParam(params?.id, req, "tournaments");
  if (tournamentId === null) {
    return fail(400, "INVALID_ID");
  }

  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      format: true,
      config: true,
      inscriptionDeadlineAt: true,
      event: { select: { id: true, organizationId: true, title: true, startsAt: true, endsAt: true } },
    },
  });
  if (!tournament) return fail(404, "NOT_FOUND");

  const organizationId = tournament.event.organizationId;
  if (organizationId == null) return fail(404, "EVENT_NOT_FOUND");

  const { membership } = await getActiveOrganizationForUser(user.id, {
    organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!membership) return fail(403, "FORBIDDEN");

  const emailGate = await requireOfficialEmailVerified({
    organizationId,
    reasonCode: "TOURNAMENTS_UPDATE",
    actorUserId: user.id,
  });
  if (!emailGate.ok) {
    const message =
      "message" in emailGate && typeof emailGate.message === "string"
        ? emailGate.message
        : emailGate.errorCode ?? "Sem permissões.";
    return respondError(
      ctx,
      {
        errorCode: emailGate.errorCode ?? "FORBIDDEN",
        message,
        retryable: false,
        details: emailGate,
      },
      { status: emailGate.errorCode === "ORGANIZATION_NOT_FOUND" ? 404 : 403 },
    );
  }

  const access = await ensureMemberModuleAccess({
    organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!access.ok) return fail(403, "FORBIDDEN");

  return respondOk(ctx, { tournament }, { status: 200 });
}

async function _PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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
  const tournamentId = readNumericParam(params?.id, req, "tournaments");
  if (tournamentId === null) {
    return fail(400, "INVALID_ID");
  }
  const body = await req.json().catch(() => ({}));

  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, event: { select: { organizationId: true } } },
  });
  if (!tournament) return fail(404, "NOT_FOUND");

  const organizationId = tournament.event.organizationId;
  if (!organizationId) return fail(404, "EVENT_NOT_FOUND");

  const { membership } = await getActiveOrganizationForUser(user.id, {
    organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!membership) return fail(403, "FORBIDDEN");

  const access = await ensureMemberModuleAccess({
    organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!access.ok) return fail(403, "FORBIDDEN");

  const format = body?.format as TournamentFormat | undefined;
  const bracketSize = Number.isFinite(body?.bracketSize) ? Number(body.bracketSize) : null;
  const inscriptionDeadlineAt = body?.inscriptionDeadlineAt ? new Date(body.inscriptionDeadlineAt) : undefined;

  const data: Record<string, unknown> = {};
  if (format) data.format = format;
  if (bracketSize !== null) data.config = { bracketSize };
  if (inscriptionDeadlineAt) data.inscriptionDeadlineAt = inscriptionDeadlineAt;

  const result = await updateTournament({
    tournamentId,
    data,
    actorUserId: user.id,
  });
  if (!result.ok) {
    if (result.error === "EVENT_NOT_PADEL") {
      return fail(400, "EVENT_NOT_PADEL");
    }
    return fail(404, "NOT_FOUND");
  }

  return respondOk(ctx, {}, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);

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
