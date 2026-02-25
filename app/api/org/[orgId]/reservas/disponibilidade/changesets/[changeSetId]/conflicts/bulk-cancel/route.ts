import { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { mapChangesetError, resolveChangesetConflict, runChangesetPostActions } from "@/lib/reservas/availabilityChangesets";
import { ensureChangesetScopeAccess } from "@/lib/reservas/availabilityChangesetAccess";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

function fail(
  ctx: { requestId: string; correlationId: string },
  status: number,
  errorCode: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return respondError(
    ctx,
    { errorCode, message, retryable: status >= 500, ...(details ? { details } : {}) },
    { status },
  );
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ changeSetId: string }> },
) {
  const ctx = getRequestContext(req);
  const resolved = await params;
  const changeSetId = parseId(resolved.changeSetId);
  if (!changeSetId) {
    return fail(ctx, 400, "INVALID_ID", "ID inválido.");
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });

    if (!profile) {
      return fail(ctx, 403, "PROFILE_NOT_FOUND", "Perfil não encontrado.");
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN", "Sem permissões.");
    }

    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return fail(ctx, 403, "RESERVAS_UNAVAILABLE", reservasAccess.error ?? "Reservas indisponíveis.");
    }

    const scopeAccess = await ensureChangesetScopeAccess({
      organizationId: organization.id,
      changeSetId,
      role: membership.role,
      userId: profile.id,
    });
    if (!scopeAccess.ok) {
      return fail(ctx, scopeAccess.status, scopeAccess.errorCode, scopeAccess.message);
    }

    const payload = (await req.json().catch(() => ({}))) as {
      conflictIds?: unknown[];
      reason?: unknown;
    };
    const idsRaw: unknown[] = Array.isArray(payload.conflictIds) ? payload.conflictIds : [];
    const conflictIds: number[] = Array.from(
      new Set(
        idsRaw
          .map((item) => Number(item))
          .filter((value) => Number.isFinite(value) && value > 0)
          .map((value) => Math.floor(value)),
      ),
    );

    if (!conflictIds.length) {
      return fail(ctx, 400, "INVALID_CONFLICT_IDS", "Indica pelo menos um conflito válido em conflictIds[].");
    }

    const reason = typeof payload.reason === "string" ? payload.reason.trim().slice(0, 200) : null;
    const { ip, userAgent } = getRequestMeta(req);

    const succeeded: Array<{
      conflictId: number;
      alreadyResolved: boolean;
      conflictsOpen: number;
    }> = [];
    const failed: Array<{
      conflictId: number;
      errorCode: string;
      message: string;
      details?: Record<string, unknown>;
    }> = [];

    for (const conflictId of conflictIds) {
      try {
        const result = await prisma.$transaction(async (tx) =>
          resolveChangesetConflict({
            tx,
            organizationId: organization.id,
            changeSetId,
            conflictId,
            action: "CANCEL",
            actorUserId: profile.id,
            actorRole: membership.role,
            reason,
            ip,
            userAgent,
          }),
        );

        await runChangesetPostActions({
          prisma,
          postActions: result.postActions,
        });

        succeeded.push({
          conflictId,
          alreadyResolved: result.alreadyResolved,
          conflictsOpen: result.openCount,
        });
      } catch (error) {
        const mapped = mapChangesetError(error);
        failed.push({
          conflictId,
          errorCode: mapped.errorCode,
          message: mapped.message,
          ...(mapped.details ? { details: mapped.details } : {}),
        });
      }
    }

    console.info("[availability][conflict_bulk_cancel]", {
      organizationId: organization.id,
      changeSetId,
      processed: conflictIds.length,
      succeeded: succeeded.length,
      failed: failed.length,
    });

    return respondOk(ctx, {
      changeSetId,
      processed: conflictIds.length,
      succeeded,
      failed,
      successCount: succeeded.length,
      failureCount: failed.length,
    });
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return fail(ctx, 401, "UNAUTHENTICATED", "Não autenticado.");
    }

    const mapped = mapChangesetError(error);
    return fail(ctx, mapped.status, mapped.errorCode, mapped.message, mapped.details);
  }
}

export const POST = withApiEnvelope(_POST);
