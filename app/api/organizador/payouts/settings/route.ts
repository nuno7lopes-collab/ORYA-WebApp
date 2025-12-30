export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { FeeMode } from "@prisma/client";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { isOrgOwner } from "@/lib/organizerPermissions";

function isValidFeeMode(value: string | null | undefined): value is FeeMode {
  if (!value) return false;
  return value === "ADDED" || value === "INCLUDED";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      organizerId: organizerId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organizer || !membership || !isOrgOwner(membership.role)) {
      return NextResponse.json({ ok: false, error: "APENAS_OWNER" }, { status: 403 });
    }
    if (organizer.status !== "ACTIVE") {
      return NextResponse.json({ ok: false, error: "ORGANIZER_NOT_ACTIVE" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      feeMode?: string;
      platformFeeBps?: number;
      platformFeeFixedCents?: number;
    } | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const updates: Partial<{ feeMode: FeeMode; platformFeeBps: number; platformFeeFixedCents: number }> = {};

    if (body.feeMode !== undefined) {
      if (!isValidFeeMode(body.feeMode)) {
        return NextResponse.json({ ok: false, error: "INVALID_FEE_MODE" }, { status: 400 });
      }
      updates.feeMode = body.feeMode;
    }

    if (body.platformFeeBps !== undefined) {
      const value = Number(body.platformFeeBps);
      if (!Number.isFinite(value) || value < 0 || value > 5000) {
        return NextResponse.json({ ok: false, error: "INVALID_FEE_BPS" }, { status: 400 });
      }
      updates.platformFeeBps = Math.floor(value);
    }

    if (body.platformFeeFixedCents !== undefined) {
      const value = Number(body.platformFeeFixedCents);
      if (!Number.isFinite(value) || value < 0 || value > 5000) {
        return NextResponse.json({ ok: false, error: "INVALID_FEE_FIXED" }, { status: 400 });
      }
      updates.platformFeeFixedCents = Math.floor(value);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: "NOTHING_TO_UPDATE" }, { status: 400 });
    }

    const updated = await prisma.organizer.update({
      where: { id: organizer.id },
      data: updates,
    });

    return NextResponse.json(
      {
        ok: true,
        organizer: {
          id: updated.id,
          feeMode: updated.feeMode,
          platformFeeBps: updated.platformFeeBps,
          platformFeeFixedCents: updated.platformFeeFixedCents,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizador/payouts/settings][POST] erro", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
