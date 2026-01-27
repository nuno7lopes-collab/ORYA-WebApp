import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { TournamentFormat } from "@prisma/client";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { createTournamentForEvent } from "@/domain/tournaments/commands";

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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const eventId = Number(body?.eventId);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizationId: true, tournament: { select: { id: true } } },
  });
  if (!event) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (event.tournament?.id) {
    return NextResponse.json({ ok: true, tournamentId: event.tournament.id, created: false }, { status: 200 });
  }

  const authorized = await ensureOrganizationAccess(authData.user.id, event.id);
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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
    if (result.error === "INVALID_EVENT_ID") {
      return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
    }
    if (result.error === "EVENT_NOT_PADEL") {
      return NextResponse.json({ ok: false, error: "EVENT_NOT_PADEL" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const res = NextResponse.json(
    { ok: true, tournamentId: result.tournamentId, created: result.created },
    { status: 200 }
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}
