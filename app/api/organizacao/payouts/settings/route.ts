export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { FeeMode } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureOrgOwner } from "@/lib/organizationPermissions";
import { respondError, respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function isValidFeeMode(value: string | null | undefined): value is FeeMode {
  if (!value) return false;
  return value === "INCLUDED";
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (errorCode: string, message: string, status: number) =>
    respondError(ctx, { errorCode, message }, { status });

  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail("UNAUTHENTICATED", "UNAUTHENTICATED", 401);
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER"],
    });

    const ownerCheck = membership ? ensureOrgOwner(membership.role) : { ok: false as const };
    if (!organization || !membership || !ownerCheck.ok) {
      return fail("APENAS_OWNER", "APENAS_OWNER", 403);
    }
    if (organization.status !== "ACTIVE") {
      return fail("ORGANIZATION_NOT_ACTIVE", "ORGANIZATION_NOT_ACTIVE", 403);
    }

    const body = (await req.json().catch(() => null)) as {
      feeMode?: string;
      platformFeeBps?: number;
      platformFeeFixedCents?: number;
    } | null;

    if (!body || typeof body !== "object") {
      return fail("INVALID_BODY", "INVALID_BODY", 400);
    }

    const updates: Partial<{ feeMode: FeeMode; platformFeeBps: number; platformFeeFixedCents: number }> = {};

    if (body.feeMode !== undefined) {
      if (!isValidFeeMode(body.feeMode)) {
        return fail("FEE_MODE_LOCKED", "FEE_MODE_LOCKED", 400);
      }
      updates.feeMode = body.feeMode;
    }

    if (body.platformFeeBps !== undefined) {
      const value = Number(body.platformFeeBps);
      if (!Number.isFinite(value) || value < 0 || value > 5000) {
        return fail("INVALID_FEE_BPS", "INVALID_FEE_BPS", 400);
      }
      updates.platformFeeBps = Math.floor(value);
    }

    if (body.platformFeeFixedCents !== undefined) {
      const value = Number(body.platformFeeFixedCents);
      if (!Number.isFinite(value) || value < 0 || value > 5000) {
        return fail("INVALID_FEE_FIXED", "INVALID_FEE_FIXED", 400);
      }
      updates.platformFeeFixedCents = Math.floor(value);
    }

    if (Object.keys(updates).length === 0) {
      return fail("NOTHING_TO_UPDATE", "NOTHING_TO_UPDATE", 400);
    }

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: updates,
    });

    return respondOk(
      ctx,
      {
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
    return fail("INTERNAL_ERROR", "INTERNAL_ERROR", 500);
  }
}
export const POST = withApiEnvelope(_POST);
