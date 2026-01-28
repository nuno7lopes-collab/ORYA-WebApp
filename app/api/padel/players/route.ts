export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, PadelPreferredSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const players = await prisma.padelPlayerProfile.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ createdAt: "desc" }],
  });

  return jsonWrap({ ok: true, items: players }, { status: 200 });
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
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : fullName;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const gender = typeof body.gender === "string" ? body.gender.trim() : null;
  const level = typeof body.level === "string" ? body.level.trim() : null;
  const preferredSideRaw = typeof body.preferredSide === "string" ? body.preferredSide.trim().toUpperCase() : null;
  const preferredSide =
    preferredSideRaw && Object.values(PadelPreferredSide).includes(preferredSideRaw as PadelPreferredSide)
      ? (preferredSideRaw as PadelPreferredSide)
      : null;
  const clubName = typeof body.clubName === "string" ? body.clubName.trim() : null;
  const birthDate = typeof body.birthDate === "string" && body.birthDate.trim() ? new Date(body.birthDate) : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;

  if (!fullName) return jsonWrap({ ok: false, error: "FULLNAME_REQUIRED" }, { status: 400 });

  try {
    const player = email
      ? await (async () => {
          const existing = await prisma.padelPlayerProfile.findFirst({
            where: { organizationId: organization.id, email },
            select: { id: true },
          });
          if (existing?.id) {
            return prisma.padelPlayerProfile.update({
              where: { id: existing.id },
              data: {
                fullName,
                displayName: displayName || fullName,
                phone,
                gender,
                level,
                isActive,
                notes: notes || undefined,
                preferredSide: preferredSide || undefined,
                clubName: clubName || undefined,
                birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : undefined,
              },
            });
          }
          return prisma.padelPlayerProfile.create({
            data: {
              organizationId: organization.id,
              fullName,
              displayName: displayName || fullName,
              email,
              phone,
              gender,
              level,
              isActive,
              notes: notes || undefined,
              preferredSide: preferredSide || undefined,
              clubName: clubName || undefined,
              birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : undefined,
            },
          });
        })()
      : await prisma.padelPlayerProfile.create({
          data: {
            organizationId: organization.id,
            fullName,
            displayName: displayName || fullName,
            phone,
            gender,
            level,
            isActive,
            notes: notes || undefined,
            preferredSide: preferredSide || undefined,
            clubName: clubName || undefined,
            birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : undefined,
          },
        });

    return jsonWrap({ ok: true, player }, { status: 201 });
  } catch (err) {
    console.error("[padel/players][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);