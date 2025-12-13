export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { randomUUID } from "crypto";

// Regenera token de convite para um pairing (v2). Apenas capitão ou staff OWNER/ADMIN.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pairingId = Number(params?.id);
  if (!Number.isFinite(pairingId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const expiresHours = typeof body?.expiresHours === "number" ? Math.max(1, Math.min(168, body!.expiresHours)) : 48;

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: { event: { select: { organizerId: true } } },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (!pairing.inviteToken) {
    // se não existe, seguimos para criar mesmo assim
  }

  const isCaptain = pairing.createdByUserId === user.id;
  let isStaff = false;
  if (!isCaptain) {
    const staff = await prisma.organizerMember.findFirst({
      where: {
        organizerId: pairing.organizerId,
        userId: user.id,
        role: { in: ["OWNER", "CO_OWNER", "ADMIN"] },
      },
      select: { id: true },
    });
    isStaff = Boolean(staff);
  }
  if (!isCaptain && !isStaff) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

  const updated = await prisma.padelPairing.update({
    where: { id: pairingId },
    data: {
      inviteToken: token,
      inviteExpiresAt: expiresAt,
    },
    select: { id: true, inviteToken: true, inviteExpiresAt: true },
  });

  return NextResponse.json({ ok: true, invite: updated }, { status: 200 });
}
