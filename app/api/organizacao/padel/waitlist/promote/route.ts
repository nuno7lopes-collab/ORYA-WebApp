import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { promoteNextPadelWaitlistEntry } from "@/domain/padelWaitlist";
import { checkPadelRegistrationWindow } from "@/domain/padelRegistration";
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

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const eventId = typeof body?.eventId === "number" ? body.eventId : Number(body?.eventId);
  const categoryIdRaw = typeof body?.categoryId === "number" ? body.categoryId : Number(body?.categoryId);
  const categoryId = Number.isFinite(categoryIdRaw) ? Number(categoryIdRaw) : null;
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const authorized = await ensureOrganizationAccess(data.user.id, eventId);
  if (!authorized) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const [event, config] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { startsAt: true, status: true } }),
    prisma.padelTournamentConfig.findUnique({
      where: { eventId },
      select: { advancedSettings: true, splitDeadlineHours: true },
    }),
  ]);
  if (!event || !config) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const advanced = (config.advancedSettings || {}) as {
    waitlistEnabled?: boolean;
    registrationStartsAt?: string | null;
    registrationEndsAt?: string | null;
    maxEntriesTotal?: number | null;
    competitionState?: string | null;
  };
  if (advanced.waitlistEnabled !== true) {
    return jsonWrap({ ok: false, error: "WAITLIST_DISABLED" }, { status: 409 });
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
    return jsonWrap({ ok: false, error: registrationCheck.code }, { status: 409 });
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
    return jsonWrap({ ok: false, error: result.code }, { status: 409 });
  }

  await ensurePadelPlayerProfile({ organizationId: result.organizationId, userId: result.userId });
  return jsonWrap({ ok: true, entryId: result.entryId, pairingId: result.pairingId }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
