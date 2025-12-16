import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PadelMatchStatus } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { canMarkWalkover } from "@/domain/padel/pairingPolicy";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const matchId = Number(params?.id);
  if (!Number.isFinite(matchId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    select: { id: true, pairingAId: true, pairingBId: true, eventId: true, status: true },
  });
  if (!match) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (match.status === PadelMatchStatus.DONE) {
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

  // No RBAC profundo aqui; ideal seria OWNER/ADMIN

  const updated = await prisma.$transaction(async (tx) => {
    const updatedMatch = await tx.padelMatch.update({
      where: { id: matchId },
      data: { status: PadelMatchStatus.DONE, winnerPairingId, score: { walkover: true } },
    });
    return updatedMatch;
  });

  return NextResponse.json({ ok: true, match: updated }, { status: 200 });
}
