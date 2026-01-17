import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";

type SponsorSlot = {
  label?: string | null;
  logoUrl?: string | null;
  url?: string | null;
};

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
  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId: evt.organizationId,
      userId,
      role: { in: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"] },
    },
    select: { id: true },
  });
  return Boolean(member);
}

function normalizeSlot(input: SponsorSlot | null | undefined) {
  if (!input) return null;
  const label = typeof input.label === "string" ? input.label.trim() : "";
  const logoUrl = typeof input.logoUrl === "string" ? input.logoUrl.trim() : "";
  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!label && !logoUrl) return null;
  return {
    label: label || null,
    logoUrl: logoUrl || null,
    url: url || null,
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const tournamentId = Number(resolved?.id);
  if (!Number.isFinite(tournamentId)) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, eventId: true, config: true },
  });
  if (!tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const authorized = await ensureOrganizationAccess(authData.user.id, tournament.eventId);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const hero = normalizeSlot(body?.hero ?? null);
  const sideA = normalizeSlot(body?.sideA ?? null);
  const sideB = normalizeSlot(body?.sideB ?? null);
  const nowPlaying = normalizeSlot(body?.nowPlaying ?? null);

  const config = (tournament.config as Record<string, unknown> | null) ?? {};
  const nextConfig = {
    ...config,
    liveSponsors: {
      hero,
      sideA,
      sideB,
      nowPlaying,
    },
  };

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { config: nextConfig },
  });

  const res = NextResponse.json(
    {
      ok: true,
      sponsors: {
        hero,
        sideA,
        sideB,
        nowPlaying,
      },
    },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}
