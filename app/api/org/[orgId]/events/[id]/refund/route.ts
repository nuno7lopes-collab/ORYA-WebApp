import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { requestUnifiedRefundCase } from "@/lib/refunds/unifiedRefundCase";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { OrganizationModule, RefundCasePolicyCause, RefundReason } from "@prisma/client";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";
import { requireOrganizationStepUp } from "@/lib/organizationStepUp";

const ALLOWED_REASONS: RefundReason[] = ["CANCELLED", "DELETED", "DATE_CHANGED"];

function parseReason(value: unknown): RefundReason {
  if (typeof value !== "string") return "CANCELLED";
  const normalized = value.trim().toUpperCase();
  return (ALLOWED_REASONS as string[]).includes(normalized) ? (normalized as RefundReason) : "CANCELLED";
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  const resolved = await params;
  const eventId = Number(resolved.id);
  if (!Number.isFinite(eventId)) {
    return fail(400, "EVENT_INVALID");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
    if (!orgResolution.ok) {
      return fail(400, "ORG_ID_REQUIRED");
    }
    const requestOrganizationId = orgResolution.organizationId;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true, title: true },
    });
    if (event?.organizationId && event.organizationId !== requestOrganizationId) {
      return fail(404, "EVENT_NOT_FOUND");
    }
    if (!event?.organizationId) {
      return fail(404, "EVENT_NOT_FOUND");
    }

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: event.organizationId,
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "EVENTS_REFUND" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.errorCode ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
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
      return fail(403, "Sem permissões.");
    }

    const payload = await req.json().catch(() => ({}));
    const purchaseId = typeof payload?.purchaseId === "string" ? payload.purchaseId.trim() : "";
    if (!purchaseId) {
      return fail(400, "PURCHASE_ID_REQUIRED");
    }

    const saleSummary = await prisma.saleSummary.findUnique({
      where: { purchaseId },
      select: { paymentIntentId: true, eventId: true },
    });
    if (!saleSummary || saleSummary.eventId !== eventId) {
      return fail(404, "PURCHASE_NOT_FOUND");
    }

    const reason = parseReason(payload?.reason);
    const stepUp = await requireOrganizationStepUp({
      organizationId: organization.id,
      userId: user.id,
      userEmail: user.email ?? null,
      action: "REFUND_EXECUTE",
      challengeId: payload?.stepUpChallengeId,
      code: payload?.stepUpCode,
    });
    if (!stepUp.ok) {
      return respondError(
        ctx,
        {
          errorCode: stepUp.errorCode,
          message: stepUp.message,
          retryable: false,
          details: stepUp.details,
        },
        { status: stepUp.status },
      );
    }

    const { ip, userAgent } = getRequestMeta(req);
    const policyCause =
      reason === "DELETED"
        ? RefundCasePolicyCause.EVENT_DELETED
        : reason === "DATE_CHANGED"
          ? RefundCasePolicyCause.EVENT_DATE_CHANGED
          : RefundCasePolicyCause.EVENT_CANCELLED;

    const refundCase = await requestUnifiedRefundCase({
      policyCause,
      paymentId: purchaseId,
      paymentIntentId: saleSummary.paymentIntentId,
      requestedBy: user.id,
      reasonCode: reason,
      idempotencyKey: `refund_case:TICKET_ORDER:${purchaseId}:${reason}`,
      auditPayload: {
        source: "ORG_PANEL",
        eventTitle: event.title,
        actorRole: membership.role,
        stepUpChallengeId: stepUp.challengeId,
      },
    });

    await recordOrganizationAudit(prisma, {
      organizationId: event.organizationId,
      actorUserId: user.id,
      action: "EVENT_REFUND_CREATED",
      metadata: {
        eventId,
        purchaseId,
        reason,
        refundCaseId: refundCase?.id ?? null,
        refundStatus: refundCase?.status ?? null,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, {
      refundCaseId: refundCase?.id ?? null,
      refundStatus: refundCase?.status ?? "QUEUED",
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/events/[id]/refund error:", err);
    return fail(500, "Erro ao reembolsar compra.");
  }
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
export const POST = withApiEnvelope(_POST);
