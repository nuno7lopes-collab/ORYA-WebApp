import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationMemberRole } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { FIXED_SPLIT_CLOSE_BEFORE_EVENT_HOURS, FIXED_SPLIT_DEADLINE_HOURS } from "@/domain/padelDeadlines";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const PADEL_POLICY_GUARDRAILS = {
  splitDeadlineHours: FIXED_SPLIT_DEADLINE_HOURS,
  splitWindowCloseHoursBeforeStart: FIXED_SPLIT_CLOSE_BEFORE_EVENT_HOURS,
  pendingConfirmationWindowMin: 1,
  pendingConfirmationWindowMax: 240,
} as const;

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
    const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { id: true } });
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

    const legacyWhere = {
      organizationId: organization.id,
      event: { isDeleted: false },
      OR: [
        { splitDeadlineHours: null },
        { splitDeadlineHours: { not: FIXED_SPLIT_DEADLINE_HOURS } },
      ],
    };

    const [totalConfigs, legacyOverridesBefore] = await Promise.all([
      prisma.padelTournamentConfig.count({
        where: {
          organizationId: organization.id,
          event: { isDeleted: false },
        },
      }),
      prisma.padelTournamentConfig.count({ where: legacyWhere }),
    ]);

    if (legacyOverridesBefore > 0) {
      await prisma.padelTournamentConfig.updateMany({
        where: legacyWhere,
        data: { splitDeadlineHours: FIXED_SPLIT_DEADLINE_HOURS },
      });
    }

    const legacyOverrides = legacyOverridesBefore > 0 ? await prisma.padelTournamentConfig.count({ where: legacyWhere }) : 0;

    return respondOk(ctx, {
      policy: {
        scope: "GLOBAL_FIXED",
        customizableByOrganization: false,
        splitDeadlineHours: PADEL_POLICY_GUARDRAILS.splitDeadlineHours,
        splitWindowCloseHoursBeforeStart: PADEL_POLICY_GUARDRAILS.splitWindowCloseHoursBeforeStart,
        pendingConfirmationWindowMin: PADEL_POLICY_GUARDRAILS.pendingConfirmationWindowMin,
        pendingConfirmationWindowMax: PADEL_POLICY_GUARDRAILS.pendingConfirmationWindowMax,
      },
      adoption: {
        totalTournaments: totalConfigs,
        legacyOverrides,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Não autenticado.");
    }
    console.error("GET /api/org/[orgId]/policies/padel error:", err);
    return fail(500, "Erro ao carregar políticas de padel.");
  }
}

export const GET = withApiEnvelope(_GET);
