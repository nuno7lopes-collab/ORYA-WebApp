export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole, PadelFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

function roundRobinPairs(teamIds: number[]) {
  const matches: Array<{ a: number; b: number }> = [];
  for (let i = 0; i < teamIds.length; i += 1) {
    for (let j = i + 1; j < teamIds.length; j += 1) {
      matches.push({ a: teamIds[i], b: teamIds[j] });
    }
  }
  return matches;
}

function eliminationPairs(teamIds: number[]) {
  const matches: Array<{ a: number; b: number }> = [];
  const ids = [...teamIds];
  for (let i = 0; i < ids.length; i += 2) {
    if (i + 1 < ids.length) {
      matches.push({ a: ids[i], b: ids[i + 1] });
    }
  }
  return matches;
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const formatRaw = typeof body.format === "string" ? (body.format as PadelFormat) : "TODOS_CONTRA_TODOS";
  const format: PadelFormat =
    formatRaw === "QUADRO_ELIMINATORIO" ? "QUADRO_ELIMINATORIO" : "TODOS_CONTRA_TODOS";

  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizerId: true },
  });
  if (!event || !event.organizerId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId,
    roles: allowedRoles,
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { numberOfCourts: true, advancedSettings: true },
  });
  const advanced = (config?.advancedSettings || {}) as {
    courtsFromClubs?: Array<{ name?: string | null; clubName?: string | null; displayOrder?: number | null }>;
    staffFromClubs?: Array<{ email?: string | null; userId?: string | null; role?: string | null }>;
  };
  const courtsList =
    Array.isArray(advanced.courtsFromClubs) && advanced.courtsFromClubs.length > 0
      ? [...advanced.courtsFromClubs].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      : Array.from({ length: Math.max(1, config?.numberOfCourts || 1) }).map((_, idx) => ({
          name: `Court ${idx + 1}`,
          clubName: null,
          displayOrder: idx,
        }));
  const staffList = Array.isArray(advanced.staffFromClubs) ? advanced.staffFromClubs : [];

  const pairings = await prisma.padelPairing.findMany({
    where: {
      eventId,
      pairingStatus: "COMPLETE",
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const pairingIds = pairings.map((p) => p.id);
  if (pairingIds.length < 2) {
    return NextResponse.json({ ok: false, error: "NEED_PAIRINGS" }, { status: 400 });
  }

  const pairs = format === "QUADRO_ELIMINATORIO" ? eliminationPairs(pairingIds) : roundRobinPairs(pairingIds);

  await prisma.$transaction(async (tx) => {
    await tx.padelMatch.deleteMany({ where: { eventId } });
    await tx.padelMatch.createMany({
      data: pairs.map((p, idx) => {
        const court = courtsList[idx % courtsList.length];
        const staff = staffList.length > 0 ? staffList[idx % staffList.length] : null;
        const staffLabel = staff ? staff.email || staff.userId || staff.role || "Staff" : null;
        return {
          eventId,
          pairingAId: p.a,
          pairingBId: p.b,
          status: "PENDING",
          courtNumber: (idx % courtsList.length) + 1,
          courtName: court?.name || null,
          roundLabel: staffLabel ? `Staff: ${staffLabel}` : null,
        };
      }),
    });
  });

  const matches = await prisma.padelMatch.findMany({
    where: { eventId },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ ok: true, matches }, { status: 200 });
}
