export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import crypto from "crypto";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { resolveActions } from "@/lib/entitlements/accessResolver";
import { buildDefaultCheckinWindow } from "@/lib/checkin/policy";
import { getUserIdentityIds } from "@/lib/ownership/identity";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildWalletPass, isWalletPassEnabled } from "@/lib/wallet/pass";
import { signTicketToORYA2 } from "@/lib/qr";

type Params = { entitlementId: string };

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function _GET(_: Request, context: { params: Params | Promise<Params> }) {
  const { entitlementId } = await context.params;
  if (!entitlementId || typeof entitlementId !== "string") {
    return jsonWrap({ error: "INVALID_ENTITLEMENT_ID" }, { status: 400 });
  }

  if (!isWalletPassEnabled()) {
    return jsonWrap({ error: "PASS_NOT_CONFIGURED" }, { status: 501 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return jsonWrap({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = data.user.id;

  const ent = await prisma.entitlement.findUnique({
    where: { id: entitlementId },
  });
  if (!ent) {
    return jsonWrap({ error: "Not found" }, { status: 404 });
  }

  const entCheckins = await prisma.entitlementCheckin.findMany({
    where: { entitlementId: ent.id },
    select: { resultCode: true, checkedInAt: true },
    orderBy: { checkedInAt: "desc" },
    take: 1,
  });
  const consumedAt = entCheckins[0]?.checkedInAt ?? null;

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { roles: true, username: true },
  });
  const roles = profile?.roles ?? [];
  const isAdmin = roles.includes("admin");

  if (!isAdmin) {
    const identityIds = await getUserIdentityIds(userId);
    const isOwner =
      identityIds.length > 0 && ent.ownerIdentityId && identityIds.includes(ent.ownerIdentityId);
    if (!isOwner) {
      return jsonWrap({ error: "FORBIDDEN_WALLET_ACCESS" }, { status: 403 });
    }
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
    checkins: entCheckins,
    checkinWindow,
    outsideWindow,
    emailVerified: Boolean(data.user.email_confirmed_at),
    isGuestOwner: false,
  });

  const isEligible =
    ent.type === "EVENT_TICKET" &&
    actions.canShowQr &&
    ent.status.toUpperCase() === "ACTIVE" &&
    !consumedAt;

  if (!isEligible) {
    return jsonWrap({ error: "PASS_NOT_AVAILABLE" }, { status: 400 });
  }

  await prisma.entitlementQrToken.deleteMany({ where: { entitlementId: ent.id } });
  const token = crypto.randomUUID();
  const tokenHash = hashToken(token);
  const expiresAt = checkinWindow?.end ?? new Date(Date.now() + 1000 * 60 * 60);
  await prisma.entitlementQrToken.create({
    data: { tokenHash, entitlementId: ent.id, expiresAt },
  });

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = Math.floor(expiresAt.getTime() / 1000);
    const barcodeMessage =
      typeof ent.eventId === "number"
        ? signTicketToORYA2({
            qrToken: token,
            ticketId: ent.id,
            eventId: ent.eventId,
            userId: ent.ownerUserId ?? null,
            issuedAtSec: nowSec,
            expSec,
          })
        : token;

    const passBuffer = await buildWalletPass({
      serialNumber: ent.id,
      title: ent.snapshotTitle ?? "Bilhete ORYA",
      subtitle: ent.snapshotVenueName ?? null,
      venue: ent.snapshotVenueName ?? null,
      startAt: ent.snapshotStartAt ? ent.snapshotStartAt.toISOString() : null,
      barcodeMessage,
    });

    // Copy into a non-shared ArrayBuffer (BodyInit doesn't accept SharedArrayBuffer).
    const body = new Uint8Array(passBuffer);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename=\"orya-${ent.id}.pkpass\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonWrap({ error: "PASS_GENERATION_FAILED" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
