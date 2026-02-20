import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { clearUsernameForOwner } from "@/lib/globalUsernames";
import { resolveGroupMemberForOrg, revokeGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";
import {
  getOrganizationSuspensionSnapshot,
  normalizeOrganizationDangerReasonCode,
  ORGANIZATION_SUSPENSION_WINDOW_DAYS,
} from "@/lib/organizationSuspension";
import { requireOrganizationStepUp } from "@/lib/organizationStepUp";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
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
async function _DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const { id } = await context.params;
    const organizationId = Number(id);
    if (!organizationId || Number.isNaN(organizationId)) {
      return fail(400, "INVALID_ORGANIZATION_ID");
    }

    const membership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!membership || membership.role !== "OWNER") {
      return fail(403, "ONLY_OWNER_CAN_DELETE");
    }

    const payload = (await req.json().catch(() => null)) as
      | {
          reasonCode?: unknown;
          stepUpChallengeId?: unknown;
          stepUpCode?: unknown;
        }
      | null;
    const reasonCode = normalizeOrganizationDangerReasonCode(payload?.reasonCode, "OWNER_DELETE");

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        officialEmail: true,
        officialEmailVerifiedAt: true,
      },
    });
    if (!organization) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, {
      reasonCode: "ORG_DELETE",
      organizationId,
    });
    if (!emailGate.ok) {
      const message =
        "message" in emailGate && typeof emailGate.message === "string"
          ? emailGate.message
          : emailGate.errorCode ?? "Sem permissões.";
      return respondError(
        ctx,
        { errorCode: emailGate.errorCode ?? "FORBIDDEN", message, retryable: false, details: emailGate },
        { status: 403 },
      );
    }
    if (organization.status !== "SUSPENDED") {
      return fail(409, "SUSPEND_REQUIRED_BEFORE_DELETE");
    }

    const suspension = await getOrganizationSuspensionSnapshot({
      organizationId,
      status: organization.status,
      updatedAt: organization.updatedAt ?? null,
    });
    if (suspension.reactivationWindowOpen) {
      return respondError(
        ctx,
        {
          errorCode: "REACTIVATION_WINDOW_OPEN",
          message: "A organização ainda está na janela de reativação.",
          retryable: false,
          details: {
            graceWindowDays: ORGANIZATION_SUSPENSION_WINDOW_DAYS,
            remainingWindowDays: suspension.remainingWindowDays,
            reactivationDeadlineAt: suspension.reactivationDeadlineAt,
          },
        },
        { status: 409 },
      );
    }

    const stepUp = await requireOrganizationStepUp({
      organizationId,
      userId: user.id,
      userEmail: user.email ?? null,
      action: "ORG_DELETE",
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

    // Bloquear se existir algum bilhete ativo/usado associado a eventos desta org
    const hasSales = await prisma.ticket.count({
      where: {
        status: { in: ["ACTIVE"] },
        event: { organizationId },
      },
    });
    if (hasSales > 0) {
      return fail(400, "Não é possível apagar: existem bilhetes vendidos nesta organização.");
    }

    // Soft delete definitivo pós-janela: manter histórico e remover acesso operativo.
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: { username: null },
      });
      const currentMembers = await listEffectiveOrganizationMembers({
        organizationId,
        client: tx,
      });
      for (const currentMember of currentMembers) {
        await revokeGroupMemberForOrg({
          organizationId,
          userId: currentMember.userId,
          client: tx,
          allowGovernanceBypass: true,
        });
      }
    });
    await recordOrganizationAuditSafe({
      organizationId,
      actorUserId: user.id,
      action: "ORGANIZATION_DELETED_FINAL",
      metadata: {
        source: "settings_danger_zone",
        reasonCode,
        graceWindowDays: ORGANIZATION_SUSPENSION_WINDOW_DAYS,
        suspendedAt: suspension.suspendedAt?.toISOString() ?? null,
        reactivationDeadlineAt: suspension.reactivationDeadlineAt?.toISOString() ?? null,
      },
    });
    await clearUsernameForOwner({ ownerType: "organization", ownerId: organizationId });

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("[organização/organizations/delete]", err);
    return fail(500, "INTERNAL_ERROR");
  }
}
export const DELETE = withApiEnvelope(_DELETE);
