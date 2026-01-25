import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { promoteNextPadelWaitlistEntry } from "@/domain/padelWaitlist";
import { checkPadelRegistrationWindow } from "@/domain/padelRegistration";
import { ensureGroupMemberRole } from "@/lib/organizationGroupAccess";

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
  const access = await ensureGroupMemberRole({
    organizationId: evt.organizationId,
    userId,
    allowedRoles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
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
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const eventId = typeof body?.eventId === "number" ? body.eventId : Number(body?.eventId);
  const categoryIdRaw = typeof body?.categoryId === "number" ? body.categoryId : Number(body?.categoryId);
  const categoryId = Number.isFinite(categoryIdRaw) ? Number(categoryIdRaw) : null;
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const authorized = await ensureOrganizationAccess(data.user.id, eventId);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const [event, config] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { startsAt: true, status: true } }),
    prisma.padelTournamentConfig.findUnique({
      where: { eventId },
      select: { advancedSettings: true, splitDeadlineHours: true },
    }),
  ]);
  if (!event || !config) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const advanced = (config.advancedSettings || {}) as {
    waitlistEnabled?: boolean;
    registrationStartsAt?: string | null;
    registrationEndsAt?: string | null;
    maxEntriesTotal?: number | null;
    competitionState?: string | null;
  };
  if (advanced.waitlistEnabled !== true) {
    return NextResponse.json({ ok: false, error: "WAITLIST_DISABLED" }, { status: 409 });
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
    return NextResponse.json({ ok: false, error: registrationCheck.code }, { status: 409 });
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
    return NextResponse.json({ ok: false, error: result.code }, { status: 409 });
  }

  await ensurePadelPlayerProfile({ organizationId: result.organizationId, userId: result.userId });
  return NextResponse.json({ ok: true, entryId: result.entryId, pairingId: result.pairingId }, { status: 200 });
}
