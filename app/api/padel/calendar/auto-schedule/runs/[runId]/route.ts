export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

async function _GET(req: NextRequest, context: { params: Promise<{ runId: string }> }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const permission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const params = await context.params;
  const runId = typeof params.runId === "string" ? params.runId.trim() : "";
  if (!runId) return jsonWrap({ ok: false, error: "RUN_ID_REQUIRED" }, { status: 400 });

  const includeDecisions = req.nextUrl.searchParams.get("includeDecisions") === "1";

  const run = await prisma.padelScheduleRun.findFirst({
    where: { id: runId, organizationId: organization.id },
    select: {
      id: true,
      eventId: true,
      organizationId: true,
      status: true,
      strategy: true,
      partialMode: true,
      executionMode: true,
      dryRun: true,
      scheduledCount: true,
      skippedCount: true,
      unscheduledByReason: true,
      byCategory: true,
      warnings: true,
      errorCode: true,
      requestedByUserId: true,
      requestedAt: true,
      startedAt: true,
      finishedAt: true,
      applied: true,
      queued: true,
      outboxEventId: true,
      categoryIds: true,
      matchIds: true,
      requestMeta: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!run) return jsonWrap({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 });

  const decisions = includeDecisions
    ? await prisma.padelScheduleRunDecision.findMany({
        where: { runId: run.id },
        orderBy: [{ id: "asc" }],
        take: 1000,
      })
    : [];

  return jsonWrap(
    {
      ok: true,
      run,
      ...(includeDecisions ? { decisions } : {}),
    },
    { status: 200 },
  );
}

export const GET = withApiEnvelope(_GET);
