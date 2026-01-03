export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { readNumericParam } from "@/lib/routeParams";

// Toggle public/open slot (MVP): capitão ou staff OWNER/ADMIN
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const pairingId = readNumericParam(params?.id, req, "pairings");
  if (pairingId === null) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const isPublicOpen = Boolean(body?.isPublicOpen);

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: { slots: true, event: { select: { organizationId: true } } },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const isCaptain = pairing.createdByUserId === user.id;
  let isStaff = false;
  if (!isCaptain) {
    const staff = await prisma.organizationMember.findFirst({
      where: {
        organizationId: pairing.organizationId,
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

  const pendingSlot = pairing.slots.find((s) => s.slotStatus === "PENDING");
  try {
    const updated = await prisma.padelPairing.update({
      where: { id: pairingId },
      data: {
        isPublicOpen,
        slots: pendingSlot
          ? {
              update: {
                where: { id: pendingSlot.id },
                data: { isPublicOpen },
              },
            }
          : undefined,
      },
      include: { slots: true },
    });
    return NextResponse.json({ ok: true, pairing: updated }, { status: 200 });
  } catch (err) {
    console.error("[padel/pairings][public][PATCH]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
