export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

async function ensureEventAndOrganizer(eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizerId: true, templateType: true },
  });
  if (!event || !event.organizerId) return null;
  return event;
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await ensureEventAndOrganizer(eventId);
  if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId,
    roles: allowedRoles,
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  const teams = await prisma.padelTeam.findMany({
    where: { eventId },
    include: {
      player1: true,
      player2: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, items: teams }, { status: 200 });
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
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await ensureEventAndOrganizer(eventId);
  if (!event) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: event.organizerId!,
    roles: allowedRoles,
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  const player1Name = typeof body.player1Name === "string" ? body.player1Name.trim() : "";
  const player2Name = typeof body.player2Name === "string" ? body.player2Name.trim() : "";
  const player1IdBody = typeof body.player1Id === "number" ? body.player1Id : Number(body.player1Id);
  const player2IdBody = typeof body.player2Id === "number" ? body.player2Id : Number(body.player2Id);

  const player1Id = Number.isFinite(player1IdBody) ? player1IdBody : null;
  const player2Id = Number.isFinite(player2IdBody) ? player2IdBody : null;

  const createPlayer = async (fullName: string) => {
    if (!fullName.trim()) return null;
    const p = await prisma.padelPlayerProfile.create({
      data: {
        organizerId: organizer.id,
        fullName,
        isActive: true,
      },
    });
    return p.id;
  };

  const p1 = player1Id || (player1Name ? await createPlayer(player1Name) : null);
  const p2 = player2Id || (player2Name ? await createPlayer(player2Name) : null);

  const team = await prisma.padelTeam.create({
    data: {
      eventId: event.id,
      player1Id: p1 ?? undefined,
      player2Id: p2 ?? undefined,
      isFromMatchmaking: false,
    },
    include: {
      player1: true,
      player2: true,
    },
  });

  return NextResponse.json({ ok: true, team }, { status: 201 });
}
