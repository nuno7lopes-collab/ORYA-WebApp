import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { promoteNextPadelWaitlistEntry } from "@/domain/padelWaitlist";
import { checkPadelRegistrationWindow } from "@/domain/padelRegistration";
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
  const emailGate = ensureOrganizationEmailVerified(evt.organization ?? {}, { reasonCode: "PADEL_WAITLIST" });
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

async function ensurePadelPlayerProfile(params: { organizationId: number; userId: string }) {
  const { organizationId, userId } = params;
  const existing = await prisma.padelPlayerProfile.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (existing) return;
  const [profile, authUser] = await Promise.all([
    prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true, contactPhone: true } }),
    prisma.users.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const name = profile?.fullName?.trim() || "Jogador Padel";
  await prisma.padelPlayerProfile.create({
    data: {
      organizationId,
      userId,
      fullName: name,
      displayName: name,
      email: authUser?.email ?? undefined,
      phone: profile?.contactPhone ?? undefined,
    },
  });
}

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return fail(401, "UNAUTHENTICATED");

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const eventId = typeof body?.eventId === "number" ? body.eventId : Number(body?.eventId);
  const categoryIdRaw = typeof body?.categoryId === "number" ? body.categoryId : Number(body?.categoryId);
  const categoryId = Number.isFinite(categoryIdRaw) ? Number(categoryIdRaw) : null;
  if (!Number.isFinite(eventId)) return fail(400, "INVALID_EVENT");

  const authorized = await ensureOrganizationAccess(data.user.id, eventId);
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

  const [event, config] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { startsAt: true, status: true } }),
    prisma.padelTournamentConfig.findUnique({
      where: { eventId },
      select: { advancedSettings: true, splitDeadlineHours: true },
    }),
  ]);
  if (!event || !config) {
    return fail(404, "EVENT_NOT_FOUND");
  }

  const advanced = (config.advancedSettings || {}) as {
    waitlistEnabled?: boolean;
    registrationStartsAt?: string | null;
    registrationEndsAt?: string | null;
    maxEntriesTotal?: number | null;
    competitionState?: string | null;
  };
  if (advanced.waitlistEnabled !== true) {
    return fail(409, "WAITLIST_DISABLED");
  }
  const registrationStartsAt =
    advanced.registrationStartsAt && !Number.isNaN(new Date(advanced.registrationStartsAt).getTime())
      ? new Date(advanced.registrationStartsAt)
      : null;
  const registrationEndsAt =
    advanced.registrationEndsAt && !Number.isNaN(new Date(advanced.registrationEndsAt).getTime())
      ? new Date(advanced.registrationEndsAt)
      : null;
  const maxEntriesTotal =
    typeof advanced.maxEntriesTotal === "number" && Number.isFinite(advanced.maxEntriesTotal)
      ? Math.floor(advanced.maxEntriesTotal)
      : null;
  const registrationCheck = checkPadelRegistrationWindow({
    eventStatus: event.status,
    eventStartsAt: event.startsAt ?? null,
    registrationStartsAt,
    registrationEndsAt,
    competitionState: advanced.competitionState ?? null,
  });
  if (!registrationCheck.ok) {
    return fail(409, registrationCheck.code);
  }

  const result = await prisma.$transaction((tx) =>
    promoteNextPadelWaitlistEntry({
      tx,
      eventId,
      categoryId,
      eventStartsAt: event.startsAt ?? null,
      splitDeadlineHours: config.splitDeadlineHours ?? undefined,
      maxEntriesTotal,
    }),
  );

  if (!result.ok) {
    return fail(409, result.code);
  }

  await ensurePadelPlayerProfile({ organizationId: result.organizationId, userId: result.userId });
  return respondOk(
    ctx,
    { entryId: result.entryId, pairingId: result.pairingId },
    { status: 200 },
  );
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
