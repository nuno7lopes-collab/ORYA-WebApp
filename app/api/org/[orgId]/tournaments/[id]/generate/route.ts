import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getConfirmedPairings } from "@/domain/tournaments/generation";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { TournamentFormat, OrganizationModule } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { requestTournamentGeneration } from "@/domain/tournaments/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";

async function isOrganizationUser(userId: string, organizationId: number) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { officialEmail: true, officialEmailVerifiedAt: true },
  });
  if (!organization) return false;
  const emailGate = ensureOrganizationEmailVerified(organization, {
    reasonCode: "TOURNAMENTS_GENERATE",
    organizationId,
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
    organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!membership) return false;
  const access = await ensureMemberModuleAccess({
    organizationId,
    userId,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  return access.ok;
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) return fail(400, "INVALID_ID");

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return fail(401, "UNAUTHENTICATED");

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      id: true,
      eventId: true,
      format: true,
      config: true,
      inscriptionDeadlineAt: true,
      event: { select: { organizationId: true } },
    },
  });
  if (!tournament) return fail(404, "NOT_FOUND");

  if (!tournament.event.organizationId) {
    return fail(400, "NO_ORGANIZATION");
  }

  const authorized = await isOrganizationUser(data.user.id, tournament.event.organizationId);
  if (authorized !== true) {
    if (authorized && typeof authorized === "object" && "errorCode" in authorized) {
      return respondError(
        ctx,
        {
          errorCode: authorized.errorCode ?? "FORBIDDEN",
          message: authorized.message ?? authorized.errorCode ?? "Sem permissões.",
          retryable: false,
          details: authorized,
        },
        { status: authorized.status ?? 403 },
      );
    }
    return fail(403, "FORBIDDEN");
  }

  const body = await req.json().catch(() => ({}));
  const format = (body?.format as TournamentFormat | undefined) ?? tournament.format;
  const seed = typeof body?.seed === "string" ? body.seed : null;
  const forceGenerate = body?.forceGenerate === true;
  const source = typeof body?.source === "string" ? body.source : null;
  const bracketSize = Number.isFinite(body?.bracketSize) ? Number(body.bracketSize) : null;

  const config = (tournament.config as Record<string, unknown> | null) ?? {};
  const manualParticipants = Array.isArray(config.manualParticipants)
    ? (config.manualParticipants as Array<Record<string, unknown>>)
    : [];
  const manualEntries = manualParticipants
    .map((p) => {
      const id = Number.isFinite(p.id) ? Number(p.id) : null;
      const seed = Number.isFinite(p.seed) ? Number(p.seed) : null;
      return { id, seed };
    })
    .filter((p) => typeof p.id === "number" && p.id >= -2147483648 && p.id <= 2147483647);
  const manualIds = manualEntries.map((p) => p.id as number);
  const configBracketSize = Number.isFinite((config as any).bracketSize) ? Number((config as any).bracketSize) : null;

  let pairingIds: Array<number | null> = await getConfirmedPairings(tournament.eventId);
  const hasManual = manualIds.length > 0;
  let preserveOrder = false;
  if (source === "manual" || (hasManual && pairingIds.length === 0)) {
    preserveOrder = true;
    const targetSize = bracketSize ?? configBracketSize ?? null;
    if (targetSize && manualIds.length > targetSize) {
      return fail(400, "BRACKET_TOO_SMALL");
    }
    if (targetSize) {
      const slots = Array.from({ length: targetSize }, () => null as number | null);
      const unseeded: number[] = [];
      manualEntries.forEach((entry) => {
        if (typeof entry.seed === "number" && entry.seed >= 1 && entry.seed <= targetSize) {
          const idx = entry.seed - 1;
          if (slots[idx] === null) {
            slots[idx] = entry.id as number;
            return;
          }
        }
        unseeded.push(entry.id as number);
      });
      let cursor = 0;
      unseeded.forEach((id) => {
        while (cursor < slots.length && slots[cursor] !== null) cursor += 1;
        if (cursor < slots.length) {
          slots[cursor] = id;
          cursor += 1;
        }
      });
      pairingIds = slots;
    } else {
      pairingIds = manualIds;
    }
  }
  if (source === "manual" && manualIds.length === 0) {
    return fail(400, "NO_PARTICIPANTS");
  }

  await requestTournamentGeneration({
    organizationId: tournament.event.organizationId,
    tournamentId: tournament.id,
    eventId: tournament.eventId,
    actorUserId: data.user.id,
    payload: {
      tournamentId: tournament.id,
      format,
      pairings: pairingIds,
      seed,
      inscriptionDeadlineAt: tournament.inscriptionDeadlineAt?.toISOString() ?? null,
      forceGenerate,
      userId: data.user.id,
      targetSize: bracketSize ?? configBracketSize ?? null,
      preserveOrder,
    },
  });

  return respondOk(ctx, { queued: true }, { status: 202 });
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
