import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { resolveActions } from "@/lib/entitlements/accessResolver";
import { buildDefaultCheckinWindow } from "@/lib/checkin/policy";
import { EntitlementStatus, EntitlementType, Prisma } from "@prisma/client";
import crypto from "crypto";
import { normalizeEmail } from "@/lib/utils/email";

const MAX_PAGE = 50;

type CursorPayload = { snapshotStartAt: string; entitlementId: string };

function parseCursor(cursor: string | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const obj = JSON.parse(json);
    if (typeof obj.snapshotStartAt === "string" && typeof obj.entitlementId === "string") {
      return obj;
    }
  } catch (_) {
    return null;
  }
  return null;
}

function buildCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = data.user.id;
    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { roles: true },
    });

    const roles = profile?.roles ?? [];
    const isAdmin = roles.includes("admin");

    const searchParams = req.nextUrl.searchParams;
    const filter = searchParams.getAll("filter");
    const cursor = parseCursor(searchParams.get("cursor"));
    const pageSizeRaw = Number(searchParams.get("pageSize"));
    const take = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(1, pageSizeRaw), MAX_PAGE) : 20;

    const statusFilter = filter
      .map((f) => f.split(":"))
      .filter(([k]) => k === "status")
      .map(([, v]) => v)
      .filter(Boolean) as EntitlementStatus[];

    const typeFilter = filter
      .map((f) => f.split(":"))
      .filter(([k]) => k === "type")
      .map(([, v]) => v)
      .filter(Boolean) as EntitlementType[];

    const hasUpcoming = filter.includes("upcoming");
    const hasPast = filter.includes("past");
    const now = new Date();

    const andFilters: Prisma.EntitlementWhereInput[] = [];
    const where: Prisma.EntitlementWhereInput = {
      AND: andFilters,
    };

    if (!isAdmin) {
      const identities = await prisma.emailIdentity.findMany({
        where: { userId },
        select: { id: true },
      });
      const identityIds = identities.map((identity) => identity.id);
      const normalizedEmail = normalizeEmail(data.user.email ?? null);
      const ownerClauses: Prisma.EntitlementWhereInput[] = [{ ownerUserId: userId }];
      if (identityIds.length) {
        ownerClauses.push({ ownerIdentityId: { in: identityIds } });
      }
      if (normalizedEmail) {
        ownerClauses.push({ ownerKey: `email:${normalizedEmail}` });
      }
      andFilters.push({ OR: ownerClauses });
    }

    if (statusFilter.length) {
      andFilters.push({ status: { in: statusFilter } });
    }

    if (typeFilter.length) {
      andFilters.push({ type: { in: typeFilter } });
    }

    if (hasUpcoming && !hasPast) {
      andFilters.push({ snapshotStartAt: { gte: now } });
    } else if (hasPast && !hasUpcoming) {
      andFilters.push({ snapshotStartAt: { lt: now } });
    }

    if (cursor?.snapshotStartAt) {
      const cursorDate = new Date(cursor.snapshotStartAt);
      andFilters.push({
        OR: [
          { snapshotStartAt: { lt: cursorDate } },
          {
            snapshotStartAt: cursorDate,
            id: { lt: cursor.entitlementId },
          },
        ],
      });
    }

    const items = await prisma.entitlement.findMany({
      where,
      orderBy: [
        { snapshotStartAt: "desc" },
        { id: "desc" },
      ],
      take: take + 1,
    });

    const pageItems = items.slice(0, take);
    const hasMore = items.length > take;
    const last = pageItems[pageItems.length - 1];
    const nextCursor =
      hasMore && last?.snapshotStartAt
        ? buildCursor({
            snapshotStartAt: last.snapshotStartAt.toISOString(),
            entitlementId: last.id,
          })
        : null;

    const eventIds = Array.from(
      new Set(pageItems.map((e) => e.eventId).filter((id): id is number => typeof id === "number")),
    ) as number[];
    const events =
      eventIds.length > 0
        ? await prisma.event.findMany({
            where: { id: { in: eventIds } },
            select: { id: true, startsAt: true, endsAt: true },
          })
        : [];
    const eventMap = new Map(events.map((event) => [event.id, event]));

    const responseItems = await Promise.all(
      pageItems.map(async (e) => {
        const eventInfo = e.eventId ? eventMap.get(e.eventId) ?? null : null;
        const checkinWindow = eventInfo
          ? buildDefaultCheckinWindow(eventInfo.startsAt, eventInfo.endsAt)
          : undefined;
        const outsideWindow = eventInfo ? undefined : true;

        const actions = resolveActions({
          type: e.type,
          status: e.status,
          isOwner: true,
          isOrganization: false,
          isAdmin,
          checkinWindow,
          outsideWindow,
          emailVerified: Boolean(data.user.email_confirmed_at),
          isGuestOwner: false,
        });

        let qrToken: string | null = null;
        if (actions.canShowQr) {
          // Limpa tokens antigos deste entitlement antes de gerar um novo, para evitar acumulação.
          await prisma.entitlementQrToken.deleteMany({ where: { entitlementId: e.id } });

          const token = crypto.randomUUID();
          const tokenHash = hashToken(token);
          const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1h
          await prisma.entitlementQrToken.create({
            data: {
              tokenHash,
              entitlementId: e.id,
              expiresAt,
            },
          });
          qrToken = token;
        }

        return {
          entitlementId: e.id,
          type: e.type,
          scope: { eventId: e.eventId, tournamentId: e.tournamentId, seasonId: e.seasonId },
          status: e.status,
          snapshot: {
            title: e.snapshotTitle,
            coverUrl: e.snapshotCoverUrl,
            venueName: e.snapshotVenueName,
            startAt: e.snapshotStartAt,
            timezone: e.snapshotTimezone,
          },
          actions,
          qrToken,
          updatedAt: e.updatedAt,
        };
      }),
    );

    return NextResponse.json({
      items: responseItems,
      nextCursor,
    });
  } catch (err: any) {
    console.error("[api/me/wallet] erro", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
