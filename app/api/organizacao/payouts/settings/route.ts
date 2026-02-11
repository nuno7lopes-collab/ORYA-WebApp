export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { FeeMode } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { requireOfficialEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function isValidFeeMode(value: string | null | undefined): value is FeeMode {
  if (!value) return false;
  return value === "INCLUDED";
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return respondError(
        ctx,
        { errorCode: "UNAUTHENTICATED", message: "Sessão inválida.", retryable: false },
        { status: 401 },
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER"],
    });

    if (!organization || !membership) {
      return respondError(
        ctx,
        { errorCode: "APENAS_OWNER", message: "Apenas owner.", retryable: false },
        { status: 403 },
      );
    }
    if (organization.status !== "ACTIVE") {
      return respondError(
        ctx,
        { errorCode: "ORGANIZATION_NOT_ACTIVE", message: "Organização inativa.", retryable: false },
        { status: 403 },
      );
    }

    const emailGate = await requireOfficialEmailVerified({
      organizationId: organization.id,
      organization,
      reasonCode: "PAYOUTS_SETTINGS",
      actorUserId: user.id,
    });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.errorCode ?? "OFFICIAL_EMAIL_REQUIRED",
          message: emailGate.message ?? "Email oficial obrigatório.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => null)) as {
      feeMode?: string;
      platformFeeBps?: number;
      platformFeeFixedCents?: number;
    } | null;

    if (!body || typeof body !== "object") {
      return respondError(
        ctx,
        { errorCode: "INVALID_BODY", message: "Payload inválido.", retryable: false },
        { status: 400 },
      );
    }

    const updates: Partial<{ feeMode: FeeMode; platformFeeBps: number; platformFeeFixedCents: number }> = {};

    if (body.feeMode !== undefined) {
      if (!isValidFeeMode(body.feeMode)) {
        return respondError(
          ctx,
          { errorCode: "FEE_MODE_LOCKED", message: "Fee mode bloqueado.", retryable: false },
          { status: 400 },
        );
      }
      updates.feeMode = body.feeMode;
    }

    if (body.platformFeeBps !== undefined) {
      const value = Number(body.platformFeeBps);
      if (!Number.isFinite(value) || value < 0 || value > 5000) {
        return respondError(
          ctx,
          { errorCode: "INVALID_FEE_BPS", message: "Fee BPS inválida.", retryable: false },
          { status: 400 },
        );
      }
      updates.platformFeeBps = Math.floor(value);
    }

    if (body.platformFeeFixedCents !== undefined) {
      const value = Number(body.platformFeeFixedCents);
      if (!Number.isFinite(value) || value < 0 || value > 5000) {
        return respondError(
          ctx,
          { errorCode: "INVALID_FEE_FIXED", message: "Fee fixa inválida.", retryable: false },
          { status: 400 },
        );
      }
      updates.platformFeeFixedCents = Math.floor(value);
    }

    if (Object.keys(updates).length === 0) {
      return respondError(
        ctx,
        { errorCode: "NOTHING_TO_UPDATE", message: "Nada para atualizar.", retryable: false },
        { status: 400 },
      );
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
    logError("payouts.settings.error", err, { requestId: ctx.requestId });
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
