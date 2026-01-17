import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";

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
  const member = await prisma.organizationMember.findFirst({
    where: {
      organizationId: evt.organizationId,
      userId,
      role: { in: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"] },
    },
    select: { id: true },
  });
  if (!member) return false;
  if (options?.requireVerifiedEmail) {
    const emailGate = ensureOrganizationEmailVerified(evt.organization ?? {});
    if (!emailGate.ok) return false;
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, eventId: true, config: true },
  });
  if (!tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const authorized = await ensureOrganizationAccess(authData.user.id, tournament.eventId);
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const config = (tournament.config as Record<string, unknown> | null) ?? {};
  const manualParticipants = Array.isArray(config.manualParticipants) ? config.manualParticipants : [];
  const bracketSize = Number.isFinite((config as any).bracketSize) ? Number((config as any).bracketSize) : null;

  const res = NextResponse.json(
    {
      ok: true,
      participants: manualParticipants,
      bracketSize,
    },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const id = Number(resolved?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, eventId: true, config: true },
  });
  if (!tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const authorized = await ensureOrganizationAccess(authData.user.id, tournament.eventId, {
    requireVerifiedEmail: true,
  });
  if (!authorized) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const participants = Array.isArray(body?.participants) ? (body.participants as ParticipantInput[]) : [];

  const rawBracketSize = body?.bracketSize;
  const bracketSize = Number.isFinite(rawBracketSize) ? Number(rawBracketSize) : null;
  if (bracketSize !== null && !isPowerOfTwo(bracketSize)) {
    return NextResponse.json({ ok: false, error: "INVALID_BRACKET_SIZE" }, { status: 400 });
  }
  const normalized = normalizeParticipants(participants, bracketSize ?? undefined);

  const config = (tournament.config as Record<string, unknown> | null) ?? {};
  const nextConfig = {
    ...config,
    manualParticipants: normalized,
    ...(bracketSize ? { bracketSize } : {}),
  };

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: { config: nextConfig },
  });

  const res = NextResponse.json(
    {
      ok: true,
      participants: normalized,
      bracketSize: bracketSize ?? (Number.isFinite((config as any).bracketSize) ? Number((config as any).bracketSize) : null),
    },
    { status: 200 },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}
