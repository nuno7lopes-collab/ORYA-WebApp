import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { queueRefundCaseProcessing } from "@/lib/refunds/unifiedRefundCase";
import { requireOrganizationStepUp } from "@/lib/organizationStepUp";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
import { OrganizationModule, RefundCaseStatus } from "@prisma/client";

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function hasOverrideEvidence(evidence: unknown) {
  if (typeof evidence === "string") return evidence.trim().length > 0;
  if (Array.isArray(evidence)) return evidence.length > 0;
  if (evidence && typeof evidence === "object") {
    return Object.keys(evidence as Record<string, unknown>).length > 0;
  }
  return false;
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    errorCode: string,
    message: string,
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => respondError(ctx, { errorCode, message, retryable, ...(details ? { details } : {}) }, { status });

  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED", "Sessão inválida.", false);
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return fail(403, "FORBIDDEN", "Sem permissões.", false);
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.FINANCEIRO,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(403, "FORBIDDEN", "Sem permissões.", false);
    }

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      reasonCode?: string;
      evidence?: unknown;
      stepUpChallengeId?: unknown;
      stepUpCode?: unknown;
    };

    const stepUp = await requireOrganizationStepUp({
      organizationId: organization.id,
      userId: user.id,
      userEmail: user.email ?? null,
      action: "REFUND_OVERRIDE",
      challengeId: body?.stepUpChallengeId,
      code: body?.stepUpCode,
    });
    if (!stepUp.ok) {
      return fail(stepUp.status, stepUp.errorCode, stepUp.message, false, stepUp.details);
    }

    const resolved = await params;
    const refundCaseId = typeof resolved.id === "string" ? resolved.id.trim() : "";
    if (!refundCaseId) {
      return fail(400, "REFUND_CASE_ID_REQUIRED", "ID do caso de reembolso inválido.", false);
    }

    const actionRaw = typeof body?.action === "string" ? body.action.trim().toUpperCase() : "";
    const reasonCode = typeof body?.reasonCode === "string" ? body.reasonCode.trim() : "";
    if (!reasonCode) {
      return fail(400, "REASON_CODE_REQUIRED", "`reasonCode` é obrigatório.", false);
    }
    if (!hasOverrideEvidence(body?.evidence)) {
      return fail(400, "EVIDENCE_REQUIRED", "`evidence` é obrigatório para override.", false);
    }

    const existing = await prisma.refundCase.findFirst({
      where: { id: refundCaseId, organizationId: organization.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return fail(404, "REFUND_CASE_NOT_FOUND", "Caso de reembolso não encontrado.", false);
    }

    let nextStatus: RefundCaseStatus;
    if (actionRaw === "MARK_FAILED_FINAL") {
      nextStatus = RefundCaseStatus.FAILED_FINAL;
    } else if (actionRaw === "MARK_MANUAL_REVIEW") {
      nextStatus = RefundCaseStatus.MANUAL_REVIEW;
    } else {
      nextStatus = RefundCaseStatus.REQUESTED;
    }

    const now = new Date();
    const { ip, userAgent } = getRequestMeta(req);

    const updated = await prisma.refundCase.update({
      where: { id: refundCaseId },
      data: {
        status: nextStatus,
        reasonCode,
        overrideBy: user.id,
        overrideAt: now,
        overridePayload: {
          action: actionRaw || "RETRY",
          evidence: body?.evidence ?? null,
          previousStatus: existing.status,
          stepUpChallengeId: stepUp.challengeId,
        },
        lastError: nextStatus === RefundCaseStatus.REQUESTED ? null : undefined,
        nextRetryAt: nextStatus === RefundCaseStatus.REQUESTED ? now : null,
      },
    });

    if (nextStatus === RefundCaseStatus.REQUESTED) {
      await queueRefundCaseProcessing({
        refundCaseId: updated.id,
        forceRequeue: true,
      });
    }

    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: user.id,
      action: "REFUND_CASE_OVERRIDE",
      metadata: {
        refundCaseId: updated.id,
        previousStatus: existing.status,
        nextStatus,
        reasonCode,
        action: actionRaw || "RETRY",
        evidence: body?.evidence ?? null,
      },
      ip,
      userAgent,
    });

    return respondOk(
      ctx,
      {
        refundCaseId: updated.id,
        status: updated.status,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizacao/refunds/cases/override]", err);
    return fail(500, "INTERNAL_ERROR", "Erro interno.", true);
  }
}

export const POST = withApiEnvelope(_POST);
