import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { OrganizationStatus } from "@prisma/client";
import {
  getOrganizationDashboardHiddenToolIds,
  setOrganizationDashboardHiddenToolIds,
} from "@/lib/organizationDashboardToolVisibility";
import { NON_HIDEABLE_DASHBOARD_TOOL_IDS } from "@/lib/organizationDashboardTools";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const NON_HIDEABLE_TOOL_IDS = Array.from(NON_HIDEABLE_DASHBOARD_TOOL_IDS).sort();

const canEditDashboardVisibility = (role: string | null | undefined) =>
  role === "OWNER" || role === "CO_OWNER" || role === "ADMIN";
const canManageDashboardTools = (role: string | null | undefined) =>
  role === "OWNER" || role === "CO_OWNER" || role === "ADMIN";

async function resolveOrgAccess(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

  if (error || !user) {
    return { ok: false as const, status: 401, error: "UNAUTHENTICATED" };
  }

  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationId ?? undefined,
    allowFallback: false,
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });

  if (!organization || !membership) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }

  return { ok: true as const, userId: user.id, organizationId: organization.id, membershipRole: membership.role };
}

async function _GET(req: NextRequest) {
  try {
    const access = await resolveOrgAccess(req);
    if (!access.ok) {
      return jsonWrap({ ok: false, error: access.error }, { status: access.status });
    }

    const hiddenToolIds = await getOrganizationDashboardHiddenToolIds(access.organizationId);
    const canManageTools = canManageDashboardTools(access.membershipRole);
    return jsonWrap(
      {
        ok: true,
        hiddenToolIds,
        canEdit: canEditDashboardVisibility(access.membershipRole),
        canManageTools,
        membershipRole: access.membershipRole ?? null,
        nonHideableToolIds: NON_HIDEABLE_TOOL_IDS,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[org/dashboard/tools/visibility][GET]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _PATCH(req: NextRequest) {
  try {
    const access = await resolveOrgAccess(req);
    if (!access.ok) {
      return jsonWrap({ ok: false, error: access.error }, { status: access.status });
    }
    if (!canEditDashboardVisibility(access.membershipRole)) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const hiddenToolIds = await setOrganizationDashboardHiddenToolIds({
      organizationId: access.organizationId,
      actorUserId: access.userId,
      hiddenToolIds: body?.hiddenToolIds,
    });

    const canManageTools = canManageDashboardTools(access.membershipRole);
    return jsonWrap(
      {
        ok: true,
        hiddenToolIds,
        canEdit: true,
        canManageTools,
        membershipRole: access.membershipRole ?? null,
        nonHideableToolIds: NON_HIDEABLE_TOOL_IDS,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[org/dashboard/tools/visibility][PATCH]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
