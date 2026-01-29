import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { Prisma } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return respondError(
        ctx,
        { errorCode: admin.error, message: admin.error, retryable: false },
        { status: admin.status },
      );
    }

    const resolved = await params;
    const payoutId = Number(resolved.id);
    if (!Number.isFinite(payoutId)) {
      return respondError(
        ctx,
        { errorCode: "INVALID_ID", message: "ID inválido.", retryable: false },
        { status: 400 },
      );
    }

    const payout = await prisma.pendingPayout.findUnique({ where: { id: payoutId } });
    if (!payout) {
      return respondError(
        ctx,
        { errorCode: "NOT_FOUND", message: "Payout não encontrado.", retryable: false },
        { status: 404 },
      );
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

    const actorIds = Array.from(
      new Set(auditRows.map((row) => row.actor_user_id).filter((id): id is string => Boolean(id))),
    );
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

    return respondOk(
      ctx,
      {
        payout,
        organization,
        source,
        audit: auditItems,
      },
      { status: 200 },
    );
  } catch (err) {
    logError("admin.payouts.detail_failed", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
