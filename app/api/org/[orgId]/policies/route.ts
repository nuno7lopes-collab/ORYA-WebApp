import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureDefaultPolicies } from "@/lib/organizationPolicies";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import {
  BOOKING_POLICY_WINDOW_MINUTES_MAX,
  BOOKING_POLICY_WINDOW_MINUTES_MIN,
  ORG_RESCHEDULE_WINDOW_MINUTES_MAX,
  ORG_RESCHEDULE_WINDOW_MINUTES_MIN,
  clampBookingPolicyWindowMinutes,
  clampOrgRescheduleWindowMinutes,
  validateOrgRescheduleWindowMinutes,
} from "@/lib/policies/bookingPolicyGuardrails";
import { OrganizationMemberRole, Prisma } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolveConnectStatus } from "@/domain/finance/stripeConnectStatus";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
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
async function _GET(req: NextRequest) {
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
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return fail(403, "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }
    await ensureDefaultPolicies(prisma, organization.id);

    const items = await prisma.organizationPolicy.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        policyType: true,
        allowCancellation: true,
        cancellationWindowMinutes: true,
        cancellationPenaltyBps: true,
        allowReschedule: true,
        rescheduleWindowMinutes: true,
        guestBookingAllowed: true,
        createdAt: true,
      },
    });

    const organizationSnapshot = await prisma.organization.findUnique({
      where: { id: organization.id },
      select: {
        orgRescheduleWindowMinutes: true,
        orgType: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        feeMode: true,
        platformFeeBps: true,
        platformFeeFixedCents: true,
      },
    });
    const paymentsMode = organizationSnapshot?.orgType === "PLATFORM" ? "PLATFORM" : "CONNECT";
    const connectStatus =
      paymentsMode === "PLATFORM"
        ? "NOT_REQUIRED"
        : resolveConnectStatus(
            organizationSnapshot?.stripeAccountId ?? null,
            organizationSnapshot?.stripeChargesEnabled ?? false,
            organizationSnapshot?.stripePayoutsEnabled ?? false,
          );
    const isPaymentsReady = connectStatus === "READY" || connectStatus === "NOT_REQUIRED";

    const canonicalPolicy = items.find((item) => item.policyType === "MODERATE") ?? items[0] ?? null;
    const normalizedItems = canonicalPolicy ? [canonicalPolicy] : [];

    return respondOk(ctx, {
      items: normalizedItems.map((item) => ({
        ...item,
        cancellationWindowMinutes: clampBookingPolicyWindowMinutes(item.cancellationWindowMinutes),
        rescheduleWindowMinutes: clampBookingPolicyWindowMinutes(item.rescheduleWindowMinutes),
        cancellationPenaltyBps: 0,
        noShowFeeCents: 0,
      })),
      organizationPolicy: {
        orgRescheduleWindowMinutes: clampOrgRescheduleWindowMinutes(
          organizationSnapshot?.orgRescheduleWindowMinutes ?? null,
        ),
      },
      guardrails: {
        bookingWindowMinutes: {
          min: BOOKING_POLICY_WINDOW_MINUTES_MIN,
          max: BOOKING_POLICY_WINDOW_MINUTES_MAX,
        },
        orgRescheduleWindowMinutes: {
          min: ORG_RESCHEDULE_WINDOW_MINUTES_MIN,
          max: ORG_RESCHEDULE_WINDOW_MINUTES_MAX,
        },
      },
      financePolicy: {
        paymentsMode,
        paymentsAccount: {
          status: connectStatus,
          ready: isPaymentsReady,
          hasStripeAccount: Boolean(organizationSnapshot?.stripeAccountId),
          chargesEnabled: Boolean(organizationSnapshot?.stripeChargesEnabled),
          payoutsEnabled: Boolean(organizationSnapshot?.stripePayoutsEnabled),
        },
        fees: {
          processingSource: "STRIPE_AUTOMATIC",
          processingPayer: "ORGANIZATION",
          feeMode: organizationSnapshot?.feeMode ?? "ADDED",
          platformFeeBps: organizationSnapshot?.platformFeeBps ?? 0,
          platformFeeFixedCents: organizationSnapshot?.platformFeeFixedCents ?? 0,
          managePath: `/org/${organization.id}/finance?view=payouts`,
        },
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/policies error:", err);
    return fail(500, "Erro ao carregar políticas.");
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return fail(403, "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }
    return fail(
      403,
      "Existe apenas uma política default de reservas. Para alterar, edita a política atual.",
      "BOOKING_POLICY_SINGLE_DEFAULT",
      false,
    );
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("POST /api/org/[orgId]/policies error:", err);
    return fail(500, "Erro ao criar política.");
  }
}

async function _PATCH(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });
    if (!profile) {
      return fail(403, "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissões.");
    }
    const payloadRaw = await req.json().catch(() => ({}));
    const payload =
      payloadRaw && typeof payloadRaw === "object"
        ? (payloadRaw as Record<string, unknown>)
        : {};
    if (!Object.prototype.hasOwnProperty.call(payload, "orgRescheduleWindowMinutes")) {
      return fail(400, "Sem alterações.");
    }
    const orgRescheduleWindowValidation = validateOrgRescheduleWindowMinutes(payload.orgRescheduleWindowMinutes);
    if (!orgRescheduleWindowValidation.ok) {
      return fail(
        422,
        orgRescheduleWindowValidation.message,
        orgRescheduleWindowValidation.errorCode,
        false,
        orgRescheduleWindowValidation.details,
      );
    }
    const orgRescheduleWindowMinutes = orgRescheduleWindowValidation.value;

    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: { orgRescheduleWindowMinutes },
      select: { id: true, orgRescheduleWindowMinutes: true },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "ORG_RESCHEDULE_POLICY_UPDATED",
      metadata: {
        orgRescheduleWindowMinutes: updated.orgRescheduleWindowMinutes,
      },
      ip,
      userAgent,
    });

    return respondOk(ctx, {
      organizationPolicy: {
        orgRescheduleWindowMinutes: updated.orgRescheduleWindowMinutes,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2020") {
      return fail(
        422,
        "Valor fora do guardrail para janela global de reagendamento. Usa um valor entre 0 e 10080 minutos.",
        "ORG_RESCHEDULE_WINDOW_OUT_OF_RANGE",
        false,
        {
          field: "orgRescheduleWindowMinutes",
          min: ORG_RESCHEDULE_WINDOW_MINUTES_MIN,
          max: ORG_RESCHEDULE_WINDOW_MINUTES_MAX,
        },
      );
    }
    console.error("PATCH /api/org/[orgId]/policies error:", err);
    return fail(500, "Erro ao atualizar política global.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
