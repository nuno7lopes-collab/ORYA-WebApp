import type { NextRequest } from "next/server";
import { OrganizationModule } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import type { ModuleAccessLevel } from "@/lib/organizationRbac";

export type OrgTelemetryAccess = {
  ok: true;
  organizationId: number;
  userId: string;
};

export async function requireOrgTelemetryAccess(
  req: NextRequest,
  options?: { required?: ModuleAccessLevel },
): Promise<OrgTelemetryAccess | { ok: false; response: Response }> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", {
    supabaseOverride: supabase,
  });

  if (!user) {
    return {
      ok: false,
      response: jsonWrap(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401, req },
      ),
    };
  }

  const requestedOrganizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: requestedOrganizationId ?? undefined,
  });

  if (!organization || !membership) {
    return {
      ok: false,
      response: jsonWrap({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403, req }),
    };
  }

  const access = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.ANALYTICS,
    required: options?.required ?? "VIEW",
  });

  if (!access.ok) {
    return {
      ok: false,
      response: jsonWrap(
        { ok: false, error: "NO_ANALYTICS_ACCESS" },
        { status: 403, req },
      ),
    };
  }

  return {
    ok: true,
    organizationId: organization.id,
    userId: user.id,
  };
}
