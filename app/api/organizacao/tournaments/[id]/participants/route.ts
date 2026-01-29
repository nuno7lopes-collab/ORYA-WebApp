import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { updateTournament } from "@/domain/tournaments/commands";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

type ParticipantInput = {
  id?: number;
  name?: string;
  email?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  seed?: number | null;
};

async function ensureOrganizationAccess(
  userId: string,
  eventId: number,
  options?: { requireVerifiedEmail?: boolean },
) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizationId: true,
      organization: { select: { officialEmail: true, officialEmailVerifiedAt: true } },
    },
  });
  if (!evt?.organizationId) return false;
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
  if (!access.ok) return false;
  if (options?.requireVerifiedEmail) {
    const emailGate = ensureOrganizationEmailVerified(evt.organization ?? {}, {
      reasonCode: "TOURNAMENTS_PARTICIPANTS",
    });
    if (!emailGate.ok) return { ...emailGate, status: 403 };
  }
  return true;
}

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0;
}

function normalizeParticipants(items: ParticipantInput[], bracketSize?: number | null) {
  const normalized: ParticipantInput[] = [];
  const seen = new Set<number>();
  const usedSeeds = new Set<number>();
  let nextId = -1;
  const minInt = -2147483648;
  const maxInt = 2147483647;

  const reserveId = (candidate?: number) => {
    let id = Number.isFinite(candidate) ? Math.trunc(candidate as number) : Number.NaN;
    const inRange = Number.isFinite(id) && id >= minInt && id <= maxInt && id < 0;
    if (!inRange || id === 0 || seen.has(id)) {
      while (seen.has(nextId)) nextId -= 1;
      id = nextId;
      nextId -= 1;
    }
    seen.add(id);
    return id;
  };

  for (const raw of items) {
    const name = typeof raw?.name === "string" ? raw.name.trim() : "";
    if (!name) continue;
    const id = reserveId(raw?.id);
    const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() || null : null;
    const username = typeof raw?.username === "string" ? raw.username.trim().replace(/^@/, "") || null : null;
    const avatarUrl = typeof raw?.avatarUrl === "string" ? raw.avatarUrl.trim() || null : null;
    const rawSeed = Number(raw?.seed);
    const seed =
      Number.isFinite(rawSeed) &&
      rawSeed >= 1 &&
      (typeof bracketSize !== "number" || rawSeed <= bracketSize) &&
      !usedSeeds.has(rawSeed)
        ? Math.trunc(rawSeed)
        : null;
    if (seed) usedSeeds.add(seed);
    normalized.push({ id, name, email, username, avatarUrl, seed });
  }

  return normalized;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return fail(401, "UNAUTHENTICATED");

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, eventId: true, config: true },
  });
  if (!tournament) return fail(404, "NOT_FOUND");

  const authorized = await ensureOrganizationAccess(authData.user.id, tournament.eventId);
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

  const config = (tournament.config as Record<string, unknown> | null) ?? {};
  const manualParticipants = Array.isArray(config.manualParticipants) ? config.manualParticipants : [];
  const bracketSize = Number.isFinite((config as any).bracketSize) ? Number((config as any).bracketSize) : null;

  const res = respondOk(
    ctx,
    {
      participants: manualParticipants,
      bracketSize,
    },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}

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
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) return fail(400, "INVALID_ID");

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return fail(401, "UNAUTHENTICATED");

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, eventId: true, config: true },
  });
  if (!tournament) return fail(404, "NOT_FOUND");

  const authorized = await ensureOrganizationAccess(authData.user.id, tournament.eventId, {
    requireVerifiedEmail: true,
  });
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
  const participants = Array.isArray(body?.participants) ? (body.participants as ParticipantInput[]) : [];

  const rawBracketSize = body?.bracketSize;
  const bracketSize = Number.isFinite(rawBracketSize) ? Number(rawBracketSize) : null;
  if (bracketSize !== null && !isPowerOfTwo(bracketSize)) {
    return fail(400, "INVALID_BRACKET_SIZE");
  }
  const normalized = normalizeParticipants(participants, bracketSize ?? undefined);

  const config = (tournament.config as Record<string, unknown> | null) ?? {};
  const nextConfig = {
    ...config,
    manualParticipants: normalized,
    ...(bracketSize ? { bracketSize } : {}),
  };

  const result = await updateTournament({
    tournamentId: tournament.id,
    data: { config: nextConfig },
    actorUserId: authData.user.id,
  });
  if (!result.ok) {
    if (result.error === "EVENT_NOT_PADEL") {
      return fail(400, "EVENT_NOT_PADEL");
    }
    return fail(404, "NOT_FOUND");
  }

  const res = respondOk(
    ctx,
    {
      participants: normalized,
      bracketSize:
        bracketSize ??
        (Number.isFinite((config as any).bracketSize) ? Number((config as any).bracketSize) : null),
    },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
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
