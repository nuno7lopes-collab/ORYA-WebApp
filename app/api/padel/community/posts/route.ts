export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { OrganizationMemberRole, PadelCommunityPostKind, PadelCommunityVisibility } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

function clampLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(1, Math.floor(parsed)), 50);
}

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

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: readRoles,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const clubIdRaw = req.nextUrl.searchParams.get("clubId");
  const hasClubIdParam = clubIdRaw != null;
  const clubId = hasClubIdParam ? parsePositiveInt(clubIdRaw) : null;
  if (hasClubIdParam && clubId == null) {
    return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });
  }
  const limit = clampLimit(req.nextUrl.searchParams.get("limit"));

  const posts = await prisma.padelCommunityPost.findMany({
    where: {
      organizationId: organization.id,
      ...(hasClubIdParam ? { padelClubId: clubId as number } : {}),
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      author: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });

  return jsonWrap(
    {
      ok: true,
      items: posts.map((post) => ({
        id: post.id,
        title: post.title ?? null,
        body: post.body,
        kind: post.kind,
        visibility: post.visibility,
        isPinned: post.isPinned,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        padelClubId: post.padelClubId ?? null,
        author: post.author,
        counts: {
          comments: post._count.comments,
          reactions: post._count.reactions,
        },
      })),
    },
    { status: 200 },
  );
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
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: writeRoles,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.body === "string" ? body.body.trim() : "";
  const hasPadelClubId = body.padelClubId != null;
  const padelClubId = hasPadelClubId ? parsePositiveInt(body.padelClubId) : null;
  const kindRaw = typeof body.kind === "string" ? body.kind.trim().toUpperCase() : "";
  const kind: PadelCommunityPostKind = Object.values(PadelCommunityPostKind).includes(kindRaw as PadelCommunityPostKind)
    ? (kindRaw as PadelCommunityPostKind)
    : "ANNOUNCEMENT";
  const visibilityRaw = typeof body.visibility === "string" ? body.visibility.trim().toUpperCase() : "";
  const visibility: PadelCommunityVisibility = Object.values(PadelCommunityVisibility).includes(
    visibilityRaw as PadelCommunityVisibility,
  )
    ? (visibilityRaw as PadelCommunityVisibility)
    : "CLUB_MEMBERS";
  const isPinned = typeof body.isPinned === "boolean" ? body.isPinned : false;

  if (!content) return jsonWrap({ ok: false, error: "BODY_REQUIRED" }, { status: 400 });
  if (hasPadelClubId && padelClubId == null) {
    return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });
  }

  if (padelClubId != null) {
    const club = await prisma.padelClub.findFirst({
      where: { id: padelClubId, organizationId: organization.id },
      select: { id: true },
    });
    if (!club) return jsonWrap({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });
  }

  const post = await prisma.padelCommunityPost.create({
    data: {
      organizationId: organization.id,
      padelClubId: padelClubId ?? null,
      authorUserId: user.id,
      title: title || null,
      body: content,
      kind,
      visibility,
      isPinned,
    },
    include: {
      author: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });

  return jsonWrap({ ok: true, item: post }, { status: 201 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
