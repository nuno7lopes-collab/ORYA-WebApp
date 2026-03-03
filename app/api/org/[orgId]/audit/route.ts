import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolveOrganizationIdStrict } from "@/lib/organizationId";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { isOrgAdminOrAbove } from "@/lib/organizationPermissions";
import { OrganizationModule } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

function resolveListLimit(raw: string | null, fallback = 200, max = 500) {
  if (typeof raw !== "string") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const orgResolution = resolveOrganizationIdStrict({ req, allowFallback: false });
    if (!orgResolution.ok) {
      if (orgResolution.reason === "CONFLICT") {
        return jsonWrap({ ok: false, error: "ORGANIZATION_ID_CONFLICT" }, { status: 400 });
      }
      return jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
    }
    const organizationId = orgResolution.organizationId;

    const membership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!membership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    if (!isOrgAdminOrAbove(membership.role)) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const access = await ensureMemberModuleAccess({
      organizationId,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.STAFF,
      required: "EDIT",
    });
    if (!access.ok) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = resolveListLimit(url.searchParams.get("limit"));

    const items = await prisma.organizationAuditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const userIds = Array.from(
      new Set(
        items
          .flatMap((entry) => [entry.actorUserId, entry.fromUserId, entry.toUserId])
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );
    const profiles = userIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: userIds }, isDeleted: false },
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        })
      : [];
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    const normalizedItems = items.map((entry) => ({
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt?.toISOString() ?? null,
      metadata: entry.metadata ?? null,
      actor: entry.actorUserId
        ? profileById.get(entry.actorUserId) ?? { id: entry.actorUserId, fullName: null, username: null, avatarUrl: null }
        : null,
      fromUser: entry.fromUserId
        ? profileById.get(entry.fromUserId) ?? { id: entry.fromUserId, fullName: null, username: null, avatarUrl: null }
        : null,
      toUser: entry.toUserId
        ? profileById.get(entry.toUserId) ?? { id: entry.toUserId, fullName: null, username: null, avatarUrl: null }
        : null,
    }));

    return jsonWrap({ ok: true, organizationId, items: normalizedItems }, { status: 200 });
  } catch (err) {
    console.error("[organização/audit][GET]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
