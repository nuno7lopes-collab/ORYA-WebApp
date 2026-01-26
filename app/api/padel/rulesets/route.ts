export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import {
  isValidPointsTable,
  isValidTieBreakRules,
  PadelPointsTable,
  PadelTieBreakRule,
} from "@/lib/padel/validation";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const items = await prisma.padelRuleSet.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, items }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const organizationIdParam = body.organizationId ?? resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const parsedOrgId = parseOrganizationId(organizationIdParam);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const tieBreakRulesRaw = body.tieBreakRules as unknown;
  const pointsTableRaw = body.pointsTable as unknown;
  const enabledFormats = Array.isArray(body.enabledFormats)
    ? (body.enabledFormats as unknown[]).map((f) => String(f)).filter(Boolean)
    : undefined;
  const season = typeof body.season === "string" ? body.season.trim() : null;
  const year = typeof body.year === "number" ? body.year : null;
  const id = typeof body.id === "number" ? body.id : null;

  if (!name) return NextResponse.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });

  if (!isValidTieBreakRules(tieBreakRulesRaw)) {
    return NextResponse.json({ ok: false, error: "INVALID_TIE_BREAK_RULES" }, { status: 400 });
  }
  if (!isValidPointsTable(pointsTableRaw)) {
    return NextResponse.json({ ok: false, error: "INVALID_POINTS_TABLE" }, { status: 400 });
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

    return NextResponse.json({ ok: true, ruleSet }, { status: id ? 200 : 201 });
  } catch (err) {
    console.error("[padel/rulesets][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
