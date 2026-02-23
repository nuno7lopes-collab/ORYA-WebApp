export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import {
  buildPadelAnalyticsForEventContext,
  loadPadelAnalyticsEventContext,
} from "@/domain/padel/analyticsData";
import { OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
  if (!orgResolution.ok) {
    return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
  }
  const requestOrganizationId = orgResolution.organizationId;

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const event = await loadPadelAnalyticsEventContext(eventId);
  if (!event || event.organizationId !== requestOrganizationId) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: requestOrganizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId: requestOrganizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const analytics = await buildPadelAnalyticsForEventContext(event);

  return jsonWrap(
    {
      ok: true,
      ...analytics,
    },
    { status: 200 },
  );
}
export const GET = withApiEnvelope(_GET);
