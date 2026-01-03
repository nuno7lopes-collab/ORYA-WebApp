import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { resolveActions } from "@/lib/entitlements/accessResolver";
import { EntitlementStatus, OrganizationMemberRole } from "@prisma/client";
import { buildDefaultCheckinWindow } from "@/lib/checkin/policy";

const MAX_PAGE = 100;

function buildCursor(payload: { snapshotStartAt: string; entitlementId: string }) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function parseCursor(cursor: string | null) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (typeof obj.snapshotStartAt === "string" && typeof obj.entitlementId === "string") {
      return obj;
    }
  } catch {
    return null;
  }
  return null;
}

async function ensureOrganization(userId: string, eventId: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  if (!event) return { ok: false as const, reason: "EVENT_NOT_FOUND" };
  if (!event.organizationId) return { ok: false as const, reason: "FORBIDDEN_ATTENDEES_ACCESS" };

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  const roles = profile?.roles ?? [];
  const isAdmin = roles.includes("admin");
  if (isAdmin) return { ok: true as const, isAdmin };

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: event.organizationId, userId } },
    select: { id: true, role: true },
  });
  if (!membership) return { ok: false as const, reason: "FORBIDDEN_ATTENDEES_ACCESS" };
  if (
    !membership.role ||
    (membership.role !== OrganizationMemberRole.OWNER &&
      membership.role !== OrganizationMemberRole.CO_OWNER &&
      membership.role !== OrganizationMemberRole.ADMIN &&
      membership.role !== OrganizationMemberRole.STAFF)
  ) {
    return { ok: false as const, reason: "FORBIDDEN_ATTENDEES_ACCESS" };
  }
  return { ok: true as const, isAdmin };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = data.user.id;
  const eventId = Number(params.id);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "INVALID_EVENT" }, { status: 400 });
  }

  const access = await ensureOrganization(userId, eventId);
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: access.reason === "EVENT_NOT_FOUND" ? 404 : 403 });
  }
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startsAt: true, endsAt: true },
  });

  const searchParams = req.nextUrl.searchParams;
  const statusFilterRaw = searchParams.get("status");
  const statusFilter = statusFilterRaw
    ? statusFilterRaw.split(",").map((s) => s.trim()).filter(Boolean) as EntitlementStatus[]
    : [];
  const search = searchParams.get("search")?.trim();
  const cursor = parseCursor(searchParams.get("cursor"));
  const pageSizeRaw = Number(searchParams.get("pageSize"));
  const take = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(1, pageSizeRaw), MAX_PAGE) : 50;

  const where: any = {
    AND: [{ eventId }],
  };
  if (statusFilter.length) {
    where.AND.push({ status: { in: statusFilter } });
  }
  if (cursor) {
    where.AND.push({
      OR: [
        { snapshotStartAt: { lt: new Date(cursor.snapshotStartAt) } },
        { snapshotStartAt: new Date(cursor.snapshotStartAt), id: { lt: cursor.entitlementId } },
      ],
    });
  }

  // Optional search by ownerKey or snapshotTitle
  if (search) {
    where.AND.push({
      OR: [
        { ownerKey: { contains: search, mode: "insensitive" } },
        { snapshotTitle: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const entitlements = await prisma.entitlement.findMany({
    where,
    orderBy: [
      { snapshotStartAt: "desc" },
      { id: "desc" },
    ],
    take: take + 1,
  });

  const pageItems = entitlements.slice(0, take);
  const hasMore = entitlements.length > take;
  const nextCursor = hasMore
    ? buildCursor({
        snapshotStartAt: pageItems[pageItems.length - 1].snapshotStartAt.toISOString(),
        entitlementId: pageItems[pageItems.length - 1].id,
      })
    : null;

  const items = pageItems.map((e) => {
    const window = buildDefaultCheckinWindow(event?.startsAt ?? null, event?.endsAt ?? null);
    const actions = resolveActions({
      type: e.type,
      status: e.status,
      isOwner: false,
      isOrganization: true,
      isAdmin: Boolean(access.isAdmin),
      checkinWindow: window,
      emailVerified: true,
      isGuestOwner: false,
    });
    return {
      entitlementId: e.id,
      status: e.status,
      holderKey: e.ownerKey,
      snapshot: {
        title: e.snapshotTitle,
        startAt: e.snapshotStartAt,
        timezone: e.snapshotTimezone,
      },
      actions,
    };
  });

  return NextResponse.json({ items, nextCursor });
}
