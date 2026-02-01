export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { OrganizationMemberRole, PadelTeamMemberStatus, PadelTeamRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

type ResolveTeamResult =
  | { organization: { id: number }; userId: string; team: { id: number; organizationId: number } }
  | { error: Response };

async function resolveTeam(
  req: NextRequest,
  teamId: number,
  roles: OrganizationMemberRole[],
): Promise<ResolveTeamResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 }) ?? new Response(null, { status: 401 }),
    };
  }

  const team = await prisma.padelTeam.findUnique({
    where: { id: teamId },
    select: { id: true, organizationId: true },
  });
  if (!team) {
    return { error: jsonWrap({ ok: false, error: "TEAM_NOT_FOUND" }, { status: 404 }) ?? new Response(null, { status: 404 }) };
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: team.organizationId,
    roles,
  });
  if (!organization) {
    return { error: jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 }) ?? new Response(null, { status: 403 }) };
  }

  return { organization, userId: user.id, team };
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const resolved = await params;
  const teamId = Number(resolved?.id);
  if (!Number.isFinite(teamId)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const ctx = await resolveTeam(req, teamId, readRoles);
  if ("error" in ctx) return ctx.error;

  const members = await prisma.padelTeamMember.findMany({
    where: { teamId },
    include: {
      user: {
        select: { id: true, fullName: true, username: true, avatarUrl: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return jsonWrap({ ok: true, items: members }, { status: 200 });
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const resolved = await params;
  const teamId = Number(resolved?.id);
  if (!Number.isFinite(teamId)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const ctx = await resolveTeam(req, teamId, writeRoles);
  if ("error" in ctx) return ctx.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  let userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const username = typeof body.username === "string" ? body.username.trim() : "";

  if (!userId && email) {
    const user = await prisma.users.findFirst({ where: { email }, select: { id: true } });
    userId = user?.id ?? "";
  }
  if (!userId && username) {
    const profile = await prisma.profile.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true },
    });
    userId = profile?.id ?? "";
  }

  if (!userId) return jsonWrap({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });

  const roleRaw = typeof body.role === "string" ? body.role.trim().toUpperCase() : "";
  const role: PadelTeamRole = Object.values(PadelTeamRole).includes(roleRaw as PadelTeamRole)
    ? (roleRaw as PadelTeamRole)
    : "PLAYER";
  const statusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const status: PadelTeamMemberStatus = Object.values(PadelTeamMemberStatus).includes(
    statusRaw as PadelTeamMemberStatus,
  )
    ? (statusRaw as PadelTeamMemberStatus)
    : "ACTIVE";

  const member = await prisma.padelTeamMember.upsert({
    where: { teamId_userId: { teamId, userId } },
    update: {
      role,
      status,
      joinedAt: new Date(),
    },
    create: {
      teamId,
      userId,
      role,
      status,
      joinedAt: new Date(),
    },
    include: {
      user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
    },
  });

  return jsonWrap({ ok: true, item: member }, { status: 200 });
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const resolved = await params;
  const teamId = Number(resolved?.id);
  if (!Number.isFinite(teamId)) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const ctx = await resolveTeam(req, teamId, writeRoles);
  if ("error" in ctx) return ctx.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  if (!userId) return jsonWrap({ ok: false, error: "USER_ID_REQUIRED" }, { status: 400 });

  await prisma.padelTeamMember.deleteMany({ where: { teamId, userId } });
  return jsonWrap({ ok: true }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
