import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole, padel_match_status } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { canMarkWalkover } from "@/domain/padel/pairingPolicy";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { readNumericParam } from "@/lib/routeParams";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const matchId = readNumericParam(params?.id, req, "matches");
  if (matchId === null) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      pairingAId: true,
      pairingBId: true,
      eventId: true,
      status: true,
      event: { select: { organizationId: true } },
    },
  });
  if (!match) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (!match.event?.organizationId) {
    return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }
  if (match.status === padel_match_status.DONE) {
    return NextResponse.json({ ok: false, error: "ALREADY_DONE" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const winner = body?.winner as "A" | "B";
  if (winner !== "A" && winner !== "B") {
    return NextResponse.json({ ok: false, error: "INVALID_WINNER" }, { status: 400 });
  }

  const winnerPairingId = winner === "A" ? match.pairingAId : match.pairingBId;
  if (!winnerPairingId) {
    return NextResponse.json({ ok: false, error: "MISSING_PAIRINGS" }, { status: 400 });
  }

  const { organization } = await getActiveOrganizationForUser(authData.user.id, {
    organizationId: match.event.organizationId,
    roles: allowedRoles,
  });
  if (!organization) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const winnerPairing = await prisma.padelPairing.findUnique({
    where: { id: winnerPairingId },
    select: { lifecycleStatus: true },
  });
  if (!winnerPairing || !canMarkWalkover(winnerPairing.lifecycleStatus)) {
    return NextResponse.json({ ok: false, error: "PAIRING_NOT_CONFIRMED" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedMatch = await tx.padelMatch.update({
      where: { id: matchId },
      data: { status: padel_match_status.DONE, winnerPairingId, score: { walkover: true } },
    });
    return updatedMatch;
  });

  return NextResponse.json({ ok: true, match: updated }, { status: 200 });
}
