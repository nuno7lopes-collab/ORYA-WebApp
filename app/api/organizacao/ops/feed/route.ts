import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { OrganizationMemberRole } from "@prisma/client";
import { resolveOrganizationIdStrict } from "@/lib/organizationId";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function parseLimit(value: string | null) {
  const raw = Number(value ?? "50");
  if (!Number.isFinite(raw)) return 50;
  return Math.min(Math.max(raw, 1), 200);
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const orgResolution = resolveOrganizationIdStrict({ req, allowFallback: false });
    if (!orgResolution.ok && orgResolution.reason === "CONFLICT") {
      return jsonWrap({ ok: false, error: "ORGANIZATION_ID_CONFLICT" }, { status: 400 });
    }
    if (!orgResolution.ok && orgResolution.reason === "INVALID") {
      return jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }
    const explicitOrganizationId = orgResolution.ok ? orgResolution.organizationId : null;

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      roles: [...ROLE_ALLOWLIST],
      organizationId: explicitOrganizationId,
      allowFallback: !explicitOrganizationId,
    });
    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const limit = parseLimit(params.get("limit"));
    const cursor = params.get("cursor");

    const items = await prisma.activityFeedItem.findMany({
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      where: { organizationId: organization.id },
      select: {
        id: true,
        eventId: true,
        eventType: true,
        createdAt: true,
        actorUserId: true,
        sourceType: true,
        sourceId: true,
        correlationId: true,
      },
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/ops/feed error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
