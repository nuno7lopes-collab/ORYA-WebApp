import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const resolved = await params;
    const payoutId = Number(resolved.id);
    if (!Number.isFinite(payoutId)) {
      return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
    }

    const payout = await prisma.pendingPayout.findUnique({ where: { id: payoutId } });
    if (!payout) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const organization = payout.recipientConnectAccountId
      ? await prisma.organization.findFirst({
          where: { stripeAccountId: payout.recipientConnectAccountId },
          select: { id: true, publicName: true, username: true, status: true, stripeAccountId: true },
        })
      : null;

    const parsedSourceId = Number(payout.sourceId);
    let source: { title: string | null; href: string | null } = { title: null, href: null };
    if (Number.isFinite(parsedSourceId)) {
      if (payout.sourceType === "EVENT_TICKET") {
        const event = await prisma.event.findUnique({
          where: { id: parsedSourceId },
          select: { slug: true, title: true },
        });
        source = {
          title: event?.title ?? null,
          href: event?.slug ? `/eventos/${event.slug}` : null,
        };
      } else if (payout.sourceType === "SERVICE_BOOKING") {
        const booking = await prisma.booking.findUnique({
          where: { id: parsedSourceId },
          select: { service: { select: { title: true } } },
        });
        source = {
          title: booking?.service?.title ?? "Reserva",
          href: `/organizacao/reservas/${parsedSourceId}`,
        };
      } else if (payout.sourceType === "PADEL_PAIRING") {
        const pairing = await prisma.padelPairing.findUnique({
          where: { id: parsedSourceId },
          select: { event: { select: { slug: true, title: true } } },
        });
        source = {
          title: pairing?.event?.title ?? null,
          href: pairing?.event?.slug ? `/eventos/${pairing.event.slug}?pairingId=${parsedSourceId}` : null,
        };
      }
    }

    const auditRows = organization?.id
      ? await prisma.$queryRaw<
          Array<{
            id: string;
            action: string;
            actor_user_id: string | null;
            metadata: Prisma.JsonValue;
            created_at: Date | null;
          }>
        >(
          Prisma.sql`
          SELECT id, action, actor_user_id, metadata, created_at
          FROM app_v3.organization_audit_logs
          WHERE organization_id = ${organization.id}
            AND (metadata->>'payoutId') = ${String(payout.id)}
          ORDER BY created_at DESC
          LIMIT 25
        `,
        )
      : [];

    const actorIds = Array.from(new Set(auditRows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id))));
    const actors = actorIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, fullName: true, username: true },
        })
      : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    const auditItems = auditRows.map((row) => ({
      id: row.id,
      action: row.action,
      createdAt: row.created_at,
      metadata: row.metadata ?? null,
      actor: row.actor_user_id ? actorById.get(row.actor_user_id) ?? null : null,
    }));

    return jsonWrap(
      {
        ok: true,
        payout,
        organization,
        source,
        audit: auditItems,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[admin/payouts/detail]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);