import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { readNumericParam } from "@/lib/routeParams";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule, TournamentFormat } from "@prisma/client";
import { updateTournament } from "@/domain/tournaments/commands";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tournamentId = readNumericParam(params?.id, req, "tournaments");
  if (tournamentId === null) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      format: true,
      config: true,
      inscriptionDeadlineAt: true,
      event: { select: { id: true, organizationId: true, title: true, startsAt: true, endsAt: true } },
    },
  });
  if (!tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const { membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: tournament.event.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!membership) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const access = await ensureMemberModuleAccess({
    organizationId: tournament.event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!access.ok) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  return NextResponse.json({ ok: true, tournament }, { status: 200 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const tournamentId = readNumericParam(params?.id, req, "tournaments");
  if (tournamentId === null) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));

  const supabase = await createSupabaseServer();
  const user = await ensureAuthenticated(supabase);
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, event: { select: { organizationId: true } } },
  });
  if (!tournament) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const { membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: tournament.event.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!membership) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const access = await ensureMemberModuleAccess({
    organizationId: tournament.event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!access.ok) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const format = body?.format as TournamentFormat | undefined;
  const bracketSize = Number.isFinite(body?.bracketSize) ? Number(body.bracketSize) : null;
  const inscriptionDeadlineAt = body?.inscriptionDeadlineAt ? new Date(body.inscriptionDeadlineAt) : undefined;

  const data: Record<string, unknown> = {};
  if (format) data.format = format;
  if (bracketSize !== null) data.config = { bracketSize };
  if (inscriptionDeadlineAt) data.inscriptionDeadlineAt = inscriptionDeadlineAt;

  const result = await updateTournament({
    tournamentId,
    data,
    actorUserId: user.id,
  });
  if (!result.ok) {
    if (result.error === "EVENT_NOT_PADEL") {
      return NextResponse.json({ ok: false, error: "EVENT_NOT_PADEL" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
