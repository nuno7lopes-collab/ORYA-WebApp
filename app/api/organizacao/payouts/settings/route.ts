export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { FeeMode } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { isOrgOwner } from "@/lib/organizationPermissions";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function isValidFeeMode(value: string | null | undefined): value is FeeMode {
  if (!value) return false;
  return value === "INCLUDED";
}

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organization || !membership || !hasOrgOwnerAccess(membership.role)) {
      return jsonWrap({ ok: false, error: "APENAS_OWNER" }, { status: 403 });
    }
    if (organization.status !== "ACTIVE") {
      return jsonWrap({ ok: false, error: "ORGANIZATION_NOT_ACTIVE" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      feeMode?: string;
      platformFeeBps?: number;
      platformFeeFixedCents?: number;
    } | null;

    if (!body || typeof body !== "object") {
      return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const updates: Partial<{ feeMode: FeeMode; platformFeeBps: number; platformFeeFixedCents: number }> = {};

    if (body.feeMode !== undefined) {
      if (!isValidFeeMode(body.feeMode)) {
        return jsonWrap({ ok: false, error: "FEE_MODE_LOCKED" }, { status: 400 });
      }
      updates.feeMode = body.feeMode;
    }

    if (body.platformFeeBps !== undefined) {
      const value = Number(body.platformFeeBps);
      if (!Number.isFinite(value) || value < 0 || value > 5000) {
        return jsonWrap({ ok: false, error: "INVALID_FEE_BPS" }, { status: 400 });
      }
      updates.platformFeeBps = Math.floor(value);
    }

    if (body.platformFeeFixedCents !== undefined) {
      const value = Number(body.platformFeeFixedCents);
      if (!Number.isFinite(value) || value < 0 || value > 5000) {
        return jsonWrap({ ok: false, error: "INVALID_FEE_FIXED" }, { status: 400 });
      }
      updates.platformFeeFixedCents = Math.floor(value);
    }

    if (Object.keys(updates).length === 0) {
      return jsonWrap({ ok: false, error: "NOTHING_TO_UPDATE" }, { status: 400 });
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: updates,
    });

    return jsonWrap(
      {
        ok: true,
        organization: {
          id: updated.id,
          feeMode: updated.feeMode,
          platformFeeBps: updated.platformFeeBps,
          platformFeeFixedCents: updated.platformFeeFixedCents,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organização/payouts/settings][POST] erro", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);