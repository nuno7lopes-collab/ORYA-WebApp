import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { resolveActions } from "@/lib/entitlements/accessResolver";
import { buildDefaultCheckinWindow } from "@/lib/checkin/policy";
import crypto from "crypto";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

type Params = { entitlementId: string };

export async function GET(_: Request, context: { params: Params | Promise<Params> }) {
  const { entitlementId } = await context.params;
  if (!entitlementId || typeof entitlementId !== "string") {
    return NextResponse.json({ error: "INVALID_ENTITLEMENT_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = data.user.id;

  const ent = await prisma.entitlement.findUnique({
    where: { id: entitlementId },
  });

  if (!ent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true },
  });
  const roles = profile?.roles ?? [];
  const isAdmin = roles.includes("admin");

  if (!isAdmin && ent.ownerUserId !== userId) {
    return NextResponse.json({ error: "FORBIDDEN_WALLET_ACCESS" }, { status: 403 });
  }

  const event =
    ent.eventId
      ? await prisma.event.findUnique({
          where: { id: ent.eventId },
          select: {
            id: true,
            slug: true,
            startsAt: true,
            endsAt: true,
            organization: {
              select: {
                username: true,
                publicName: true,
                businessName: true,
              },
            },
          },
        })
      : null;

  const checkinWindow = event ? buildDefaultCheckinWindow(event.startsAt, event.endsAt) : undefined;
  const outsideWindow = event ? undefined : true;

  const actions = resolveActions({
    type: ent.type,
    status: ent.status,
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
    await prisma.entitlementQrToken.deleteMany({ where: { entitlementId: ent.id } });

    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
    await prisma.entitlementQrToken.create({
      data: { tokenHash, entitlementId: ent.id, expiresAt },
    });
    qrToken = token;
  }

  const organizationName = event?.organization?.publicName || event?.organization?.businessName || null;

  return NextResponse.json({
    entitlementId: ent.id,
    type: ent.type,
    scope: { eventId: ent.eventId, tournamentId: ent.tournamentId, seasonId: ent.seasonId },
    status: ent.status,
    snapshot: {
      title: ent.snapshotTitle,
      coverUrl: ent.snapshotCoverUrl,
      venueName: ent.snapshotVenueName,
      startAt: ent.snapshotStartAt,
      timezone: ent.snapshotTimezone,
    },
    actions,
    qrToken,
    event: event?.slug
      ? {
          id: event.id,
          slug: event.slug,
          organizationName,
          organizationUsername: event.organization?.username ?? null,
        }
      : null,
    audit: {
      updatedAt: ent.updatedAt,
      createdAt: ent.createdAt,
    },
  });
}
