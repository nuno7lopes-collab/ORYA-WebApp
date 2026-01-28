export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { readNumericParam } from "@/lib/routeParams";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

// Toggle public/open slot (MVP): capitão ou staff OWNER/ADMIN
async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const isPublicOpen = Boolean(body?.isPublicOpen);

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: { slots: true, event: { select: { organizationId: true } } },
  });
  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const isCaptain = pairing.createdByUserId === user.id;
  let isStaff = false;
  if (!isCaptain) {
    const membership = await resolveGroupMemberForOrg({
      organizationId: pairing.organizationId,
      userId: user.id,
    });
    isStaff = Boolean(membership && ["OWNER", "CO_OWNER", "ADMIN"].includes(membership.role));
  }
  if (!isCaptain && !isStaff) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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
    return jsonWrap({ ok: true, pairing: updated }, { status: 200 });
  } catch (err) {
    console.error("[padel/pairings][public][PATCH]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);