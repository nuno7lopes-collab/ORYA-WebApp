import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { resolveActions } from "@/lib/entitlements/accessResolver";
import { EntitlementStatus, OrganizationMemberRole, Prisma, TicketStatus } from "@prisma/client";
import { buildDefaultCheckinWindow } from "@/lib/checkin/policy";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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
  if (!event) return { ok: false as const, status: 404, error: "EVENT_NOT_FOUND" };
  if (!event.organizationId) {
    return { ok: false as const, status: 403, error: "FORBIDDEN_ATTENDEES_ACCESS" };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true, onboardingDone: true, fullName: true, username: true },
  });
  if (!profile) {
    return {
      ok: false as const,
      status: 403,
      error: "Perfil não encontrado. Completa o onboarding de utilizador.",
    };
  }
  const hasUserOnboarding =
    profile.onboardingDone ||
    (Boolean(profile.fullName?.trim()) && Boolean(profile.username?.trim()));
  if (!hasUserOnboarding) {
    return {
      ok: false as const,
      status: 403,
      error:
        "Completa o onboarding de utilizador (nome e username) antes de gerires eventos de organização.",
    };
  }

  const roles = profile.roles ?? [];
  const isAdmin = roles.includes("admin");
  if (isAdmin) return { ok: true as const, isAdmin };

  const membership = await resolveGroupMemberForOrg({
    organizationId: event.organizationId,
    userId,
  });
  if (!membership) {
    return { ok: false as const, status: 403, error: "FORBIDDEN_ATTENDEES_ACCESS" };
  }
  if (
    !membership.role ||
    (membership.role !== OrganizationMemberRole.OWNER &&
      membership.role !== OrganizationMemberRole.CO_OWNER &&
      membership.role !== OrganizationMemberRole.ADMIN &&
      membership.role !== OrganizationMemberRole.STAFF)
  ) {
    return { ok: false as const, status: 403, error: "FORBIDDEN_ATTENDEES_ACCESS" };
  }
  return { ok: true as const, isAdmin };
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return jsonWrap({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = data.user.id;
  const resolved = await params;
  const eventId = Number(resolved.id);
  if (!Number.isFinite(eventId)) {
    return jsonWrap({ error: "INVALID_EVENT" }, { status: 400 });
  }

  const access = await ensureOrganization(userId, eventId);
  if (!access.ok) {
    return jsonWrap({ error: access.error }, { status: access.status });
  }
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startsAt: true, endsAt: true },
  });

  const searchParams = req.nextUrl.searchParams;
  const statusFilterRaw = searchParams.get("status");
  const statusFilter = statusFilterRaw
    ? statusFilterRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const wantsCheckedIn = statusFilter.includes("CHECKED_IN");
  const wantsChargebackLost = statusFilter.includes("CHARGEBACK_LOST");
  const entitlementStatusFilter = statusFilter.filter(
    (s) => s !== "CHECKED_IN" && s !== "CHARGEBACK_LOST",
  ) as EntitlementStatus[];
  const search = searchParams.get("search")?.trim();
  const cursor = parseCursor(searchParams.get("cursor"));
  const pageSizeRaw = Number(searchParams.get("pageSize"));
  const take = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(1, pageSizeRaw), MAX_PAGE) : 50;

  const where: any = {
    AND: [{ eventId }],
  };
  if (statusFilter.length) {
    const statusClauses: Prisma.EntitlementWhereInput[] = [];
    if (entitlementStatusFilter.length) {
      statusClauses.push({ status: { in: entitlementStatusFilter } });
    }
    if (wantsCheckedIn) {
      statusClauses.push({ checkins: { some: {} } });
    }
    if (wantsChargebackLost) {
      statusClauses.push({ ticket: { status: TicketStatus.CHARGEBACK_LOST } });
    }
    if (statusClauses.length) {
      where.AND.push({ OR: statusClauses });
    }
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
    select: {
      id: true,
      status: true,
      type: true,
      ownerKey: true,
      ownerUserId: true,
      ownerIdentityId: true,
      purchaseId: true,
      ticketId: true,
      snapshotTitle: true,
      snapshotStartAt: true,
      snapshotTimezone: true,
      ticket: {
        select: {
          id: true,
          status: true,
          guestLink: { select: { guestName: true, guestEmail: true } },
        },
      },
      checkins: {
        select: { checkedInAt: true, resultCode: true },
        orderBy: { checkedInAt: "desc" },
        take: 1,
      },
    },
  });

  const pageItems = entitlements.slice(0, take);
  const hasMore = entitlements.length > take;
  const nextCursor = hasMore
    ? buildCursor({
        snapshotStartAt: pageItems[pageItems.length - 1].snapshotStartAt.toISOString(),
        entitlementId: pageItems[pageItems.length - 1].id,
      })
    : null;

  const ownerIds = new Set(pageItems.map((item) => item.ownerUserId).filter(Boolean) as string[]);
  const identityIds = Array.from(
    new Set(pageItems.map((item) => item.ownerIdentityId).filter(Boolean) as string[]),
  );
  const identities = identityIds.length
    ? await prisma.emailIdentity.findMany({
        where: { id: { in: identityIds } },
        select: { id: true, userId: true, emailNormalized: true },
      })
    : [];
  for (const identity of identities) {
    if (identity.userId) ownerIds.add(identity.userId);
  }
  const profileIds = Array.from(ownerIds);
  const profiles = profileIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: profileIds } },
        select: { id: true, fullName: true, username: true, users: { select: { email: true } } },
      })
    : [];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const identityMap = new Map(identities.map((identity) => [identity.id, identity]));
  const purchaseIds = Array.from(
    new Set(pageItems.map((item) => item.purchaseId).filter(Boolean) as string[]),
  );
  const refunds = purchaseIds.length
    ? await prisma.refund.findMany({
        where: { purchaseId: { in: purchaseIds } },
        select: { purchaseId: true, refundedAt: true },
      })
    : [];
  const refundMap = new Map(refunds.map((refund) => [refund.purchaseId ?? "", refund.refundedAt ?? null]));

  const items = pageItems.map((e) => {
    const window = buildDefaultCheckinWindow(event?.startsAt ?? null, event?.endsAt ?? null);
    const actions = resolveActions({
      type: e.type,
      status: e.status,
      isOwner: false,
      isOrganization: true,
      isAdmin: Boolean(access.isAdmin),
      checkins: e.checkins ?? undefined,
      checkinWindow: window,
      emailVerified: true,
      isGuestOwner: false,
    });
    const identity = e.ownerIdentityId ? identityMap.get(e.ownerIdentityId) : null;
    const resolvedProfileId = e.ownerUserId ?? identity?.userId ?? null;
    const profile = resolvedProfileId ? profileMap.get(resolvedProfileId) : null;
    const guestName = e.ticket?.guestLink?.guestName?.trim();
    const guestEmail = e.ticket?.guestLink?.guestEmail?.trim();
    const identityEmail = identity?.emailNormalized ?? null;
    const holderName =
      profile?.fullName?.trim() ||
      profile?.username?.trim() ||
      profile?.users?.email?.trim() ||
      guestName ||
      guestEmail ||
      identityEmail ||
      (e.ownerKey.startsWith("email:") ? e.ownerKey.replace("email:", "") : null) ||
      "Participante";
    const holderEmail =
      profile?.users?.email?.trim() ||
      guestEmail ||
      identityEmail ||
      (e.ownerKey.startsWith("email:") ? e.ownerKey.replace("email:", "") : null);

    const consumedAt = e.checkins?.[0]?.checkedInAt ?? null;
    const ticketStatus = e.ticket?.status ?? null;
    const displayStatus =
      ticketStatus === TicketStatus.CHARGEBACK_LOST
        ? "CHARGEBACK_LOST"
        : consumedAt && e.status === "ACTIVE"
          ? "CHECKED_IN"
          : e.status;

    return {
      entitlementId: e.id,
      status: displayStatus,
      holderKey: e.ownerKey,
      holder: {
        name: holderName,
        email: holderEmail,
        type: profile ? "USER" : guestName || guestEmail ? "GUEST" : "UNKNOWN",
      },
      purchaseId: e.purchaseId,
      ticketId: e.ticketId,
      checkedInAt: consumedAt,
      refundedAt: refundMap.get(e.purchaseId) ?? null,
      snapshot: {
        title: e.snapshotTitle,
        startAt: e.snapshotStartAt,
        timezone: e.snapshotTimezone,
      },
      actions,
    };
  });

  return jsonWrap({ items, nextCursor });
}
export const GET = withApiEnvelope(_GET);
