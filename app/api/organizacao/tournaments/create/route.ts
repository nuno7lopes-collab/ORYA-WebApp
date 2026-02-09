import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { TournamentFormat } from "@prisma/client";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { createTournamentForEvent } from "@/domain/tournaments/commands";
import { isPublicEventCardComplete } from "@/domain/events/publicEventCard";
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
    reasonCode: "TOURNAMENTS_CREATE",
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
  const { membership } = await getActiveOrganizationForUser(userId, {
    organizationId: evt.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!membership) return false;
  const access = await ensureMemberModuleAccess({
    organizationId: evt.organizationId,
    userId,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  return access.ok;
}

async function _POST(req: NextRequest) {
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
  const body = await req.json().catch(() => ({}));
  const eventId = Number(body?.eventId);
  if (!Number.isFinite(eventId)) {
    return fail(400, "EVENT_ID_REQUIRED");
  }

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return fail(401, "UNAUTHENTICATED");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      addressRef: { select: { formattedAddress: true, canonical: true } },
      organizationId: true,
      tournament: { select: { id: true } },
    },
  });
  if (!event) return fail(404, "NOT_FOUND");

  const locationLabel =
    (typeof event.addressRef?.formattedAddress === "string" ? event.addressRef.formattedAddress.trim() : "") ||
    (typeof (event.addressRef?.canonical as { city?: string } | null)?.city === "string"
      ? (event.addressRef?.canonical as { city?: string } | null)?.city?.trim() ?? ""
      : "");
  const isComplete = isPublicEventCardComplete({
    title: event.title,
    startsAt: event.startsAt,
    location: { formattedAddress: locationLabel, city: locationLabel },
  });
  if (!isComplete) {
    return fail(400, "Evento incompleto. Preenche título, data e localização.");
  }

  if (event.tournament?.id) {
    return respondOk(ctx, { tournamentId: event.tournament.id, created: false }, { status: 200 });
  }

  const authorized = await ensureOrganizationAccess(authData.user.id, event.id);
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

  const format = (body?.format as TournamentFormat | undefined) ?? "DRAW_A_B";
  const bracketSize = Number.isFinite(body?.bracketSize) ? Number(body.bracketSize) : null;

  const config = bracketSize ? { bracketSize } : {};
  const result = await createTournamentForEvent({
    eventId: event.id,
    format,
    config,
    actorUserId: authData.user.id,
  });
  if (!result.ok) {
    if (result.error === "EVENT_ID_REQUIRED") {
      return fail(400, "EVENT_ID_REQUIRED");
    }
    if (result.error === "EVENT_NOT_PADEL") {
      return fail(400, "EVENT_NOT_PADEL");
    }
    return fail(404, "NOT_FOUND");
  }

  const res = respondOk(
    ctx,
    { tournamentId: result.tournamentId, created: result.created },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
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
