export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const parseDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function ensureOrganizer(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "UNAUTHENTICATED" as const, status: 401 };

  const organizerIdParam = req.nextUrl.searchParams.get("organizerId");
  const parsedOrgId = organizerIdParam ? Number(organizerIdParam) : null;
  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: allowedRoles,
  });
  if (!organizer) return { error: "NO_ORGANIZER" as const, status: 403 };
  return { organizer };
}

export async function GET(req: NextRequest) {
  const check = await ensureOrganizer(req);
  if ("error" in check) {
    return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
  }
  const { organizer } = check;

  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "EVENT_ID_REQUIRED" }, { status: 400 });
  }

  const [blocks, availabilities] = await Promise.all([
    prisma.padelCourtBlock.findMany({
      where: { organizerId: organizer.id, eventId },
      orderBy: [{ startAt: "asc" }],
    }),
    prisma.padelAvailability.findMany({
      where: { organizerId: organizer.id, eventId },
      orderBy: [{ startAt: "asc" }],
    }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      blocks,
      availabilities,
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  const check = await ensureOrganizer(req);
  if ("error" in check) {
    return NextResponse.json({ ok: false, error: check.error }, { status: check.status });
  }
  const { organizer } = check;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const type = typeof body.type === "string" ? body.type : null;
  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const startAt = parseDate(body.startAt);
  const endAt = parseDate(body.endAt);

  if (type !== "block" && type !== "availability") {
    return NextResponse.json({ ok: false, error: "INVALID_TYPE" }, { status: 400 });
  }
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "EVENT_ID_REQUIRED" }, { status: 400 });
  }
  if (!startAt || !endAt || endAt <= startAt) {
    return NextResponse.json({ ok: false, error: "INVALID_DATE_RANGE" }, { status: 400 });
  }

  // Confirm event belongs to organizer
  const event = await prisma.event.findFirst({
    where: { id: eventId as number, organizerId: organizer.id },
    select: { id: true, templateType: true },
  });
  if (!event) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  if (type === "block") {
    const padelClubId =
      typeof body.padelClubId === "number" ? body.padelClubId : typeof body.padelClubId === "string" ? Number(body.padelClubId) : null;
    const courtId =
      typeof body.courtId === "number" ? body.courtId : typeof body.courtId === "string" ? Number(body.courtId) : null;

    if (courtId) {
      const court = await prisma.padelClubCourt.findFirst({
        where: { id: courtId, club: { organizerId: organizer.id } },
        select: { id: true, padelClubId: true },
      });
      if (!court) return NextResponse.json({ ok: false, error: "COURT_NOT_FOUND" }, { status: 404 });
    }

    const block = await prisma.padelCourtBlock.create({
      data: {
        organizerId: organizer.id,
        eventId: event.id,
        padelClubId: padelClubId ?? null,
        courtId: courtId ?? null,
        startAt,
        endAt,
        label: typeof body.label === "string" ? body.label.trim() || null : null,
        kind: typeof body.kind === "string" ? body.kind : "BLOCK",
        note: typeof body.note === "string" ? body.note.trim() || null : null,
      },
    });

    return NextResponse.json({ ok: true, block }, { status: 201 });
  }

  const playerProfileId =
    typeof body.playerProfileId === "number"
      ? body.playerProfileId
      : typeof body.playerProfileId === "string"
        ? Number(body.playerProfileId)
        : null;

  if (playerProfileId) {
    const profile = await prisma.padelPlayerProfile.findFirst({
      where: { id: playerProfileId, organizerId: organizer.id },
      select: { id: true },
    });
    if (!profile) return NextResponse.json({ ok: false, error: "PLAYER_NOT_FOUND" }, { status: 404 });
  }

  const availability = await prisma.padelAvailability.create({
    data: {
      organizerId: organizer.id,
      eventId: event.id,
      playerProfileId: playerProfileId ?? null,
      playerName: typeof body.playerName === "string" ? body.playerName.trim() || null : null,
      playerEmail: typeof body.playerEmail === "string" ? body.playerEmail.trim() || null : null,
      startAt,
      endAt,
      note: typeof body.note === "string" ? body.note.trim() || null : null,
    },
  });

  return NextResponse.json({ ok: true, availability }, { status: 201 });
}
