export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  isValidPointsTable,
  isValidTieBreakRules,
  PadelPointsTable,
  PadelTieBreakRule,
} from "@/lib/padel/validation";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const items = await prisma.padelRuleSet.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
  });

  return jsonWrap({ ok: true, items }, { status: 200 });
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const organizationIdParam = body.organizationId ?? resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const parsedOrgId = parseOrganizationId(organizationIdParam);
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
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const tieBreakRulesRaw = body.tieBreakRules as unknown;
  const pointsTableRaw = body.pointsTable as unknown;
  const enabledFormats = Array.isArray(body.enabledFormats)
    ? (body.enabledFormats as unknown[]).map((f) => String(f)).filter(Boolean)
    : undefined;
  const season = typeof body.season === "string" ? body.season.trim() : null;
  const year = typeof body.year === "number" ? body.year : null;
  const id = typeof body.id === "number" ? body.id : null;

  if (!name) return jsonWrap({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });

  if (!isValidTieBreakRules(tieBreakRulesRaw)) {
    return jsonWrap({ ok: false, error: "INVALID_TIE_BREAK_RULES" }, { status: 400 });
  }
  if (!isValidPointsTable(pointsTableRaw)) {
    return jsonWrap({ ok: false, error: "INVALID_POINTS_TABLE" }, { status: 400 });
  }

  const tieBreakRules = tieBreakRulesRaw as PadelTieBreakRule[];
  const pointsTable = pointsTableRaw as PadelPointsTable;

  try {
    const ruleSet = id
      ? await prisma.padelRuleSet.update({
          where: { id },
          data: {
            organizationId: organization.id,
            name,
            tieBreakRules,
            pointsTable,
            enabledFormats: enabledFormats ?? undefined,
            season: season || undefined,
            year: year || undefined,
          },
        })
      : await prisma.padelRuleSet.create({
          data: {
            organizationId: organization.id,
            name,
            tieBreakRules,
            pointsTable,
            enabledFormats: enabledFormats ?? undefined,
            season: season || undefined,
            year: year || undefined,
          },
        });

    return jsonWrap({ ok: true, ruleSet }, { status: id ? 200 : 201 });
  } catch (err) {
    console.error("[padel/rulesets][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
