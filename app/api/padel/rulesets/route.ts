export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, OrganizationModule, padel_format } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
import { parsePadelFormat } from "@/domain/padel/formatCatalog";
import {
  isValidPointsTable,
  isValidTieBreakRules,
  PadelPointsTable,
  PadelTieBreakRule,
} from "@/lib/padel/validation";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function parseEnabledFormats(value: unknown): { formats: padel_format[] | undefined; invalid: boolean } {
  if (typeof value === "undefined") return { formats: undefined, invalid: false };
  if (!Array.isArray(value)) return { formats: undefined, invalid: true };

  const seen = new Set<padel_format>();
  const formats: padel_format[] = [];
  for (const item of value) {
    const parsed = parsePadelFormat(item);
    if (!parsed) return { formats: undefined, invalid: true };
    if (seen.has(parsed)) continue;
    seen.add(parsed);
    formats.push(parsed);
  }
  return { formats, invalid: false };
}

async function _GET(req: NextRequest) {
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
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

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
  const hasEnabledFormats = Object.prototype.hasOwnProperty.call(body, "enabledFormats");
  const parsedEnabledFormats = parseEnabledFormats(body.enabledFormats);
  const enabledFormats = parsedEnabledFormats.formats;
  const season = typeof body.season === "string" ? body.season.trim() : null;
  const year = typeof body.year === "number" ? body.year : null;
  const hasIdInput = Object.prototype.hasOwnProperty.call(body, "id");
  const idInput = hasIdInput ? body.id : undefined;
  const shouldCreate =
    !hasIdInput || idInput === null || (typeof idInput === "string" && idInput.trim() === "");
  const id = shouldCreate ? null : parsePositiveInt(idInput);

  if (!name) return jsonWrap({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });
  if (!shouldCreate && id == null) {
    return jsonWrap({ ok: false, error: "INVALID_RULESET_ID" }, { status: 400 });
  }
  if (parsedEnabledFormats.invalid) {
    return jsonWrap({ ok: false, error: "INVALID_ENABLED_FORMATS" }, { status: 400 });
  }

  if (!isValidTieBreakRules(tieBreakRulesRaw)) {
    return jsonWrap({ ok: false, error: "INVALID_TIE_BREAK_RULES" }, { status: 400 });
  }
  if (!isValidPointsTable(pointsTableRaw)) {
    return jsonWrap({ ok: false, error: "INVALID_POINTS_TABLE" }, { status: 400 });
  }

  const tieBreakRules = tieBreakRulesRaw as PadelTieBreakRule[];
  const pointsTable = pointsTableRaw as PadelPointsTable;

  try {
    if (id) {
      const existing = await prisma.padelRuleSet.findFirst({
        where: { id, organizationId: organization.id },
        select: { id: true },
      });
      if (!existing) {
        return jsonWrap({ ok: false, error: "RULESET_NOT_FOUND" }, { status: 404 });
      }
    }

    const ruleSet = id
      ? await prisma.padelRuleSet.update({
          where: { id },
          data: {
            name,
            tieBreakRules,
            pointsTable,
            ...(hasEnabledFormats ? { enabledFormats: enabledFormats ?? [] } : {}),
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
            ...(hasEnabledFormats ? { enabledFormats: enabledFormats ?? [] } : {}),
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
