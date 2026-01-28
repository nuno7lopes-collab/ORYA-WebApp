import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getOrgTransferEnabled } from "@/lib/platformSettings";
import { setSoleOwner } from "@/lib/organizationRoles";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  try {
    const ownerTransferModel = (prisma as any).organizationOwnerTransfer;
    if (!ownerTransferModel?.findUnique) {
      return jsonWrap({ ok: false, error: "OWNER_TRANSFER_UNAVAILABLE" }, { status: 501 });
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const transferEnabled = await getOrgTransferEnabled();
    if (!transferEnabled) {
      return jsonWrap({ ok: false, error: "ORG_TRANSFER_DISABLED" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return jsonWrap({ ok: false, error: "INVALID_TOKEN" }, { status: 400 });
    }

    const transfer = await ownerTransferModel.findUnique({
      where: { token },
    });
    if (!transfer) {
      return jsonWrap({ ok: false, error: "TRANSFER_NOT_FOUND" }, { status: 404 });
    }

    if (transfer.status === "CONFIRMED") {
      return jsonWrap({ ok: true }, { status: 200 });
    }
    if (transfer.status !== "PENDING") {
      return jsonWrap({ ok: false, error: "TRANSFER_NOT_PENDING" }, { status: 400 });
    }

    if (transfer.toUserId !== user.id) {
      return jsonWrap({ ok: false, error: "TOKEN_USER_MISMATCH" }, { status: 403 });
    }

    const now = new Date();
    if (transfer.expiresAt && transfer.expiresAt.getTime() < now.getTime()) {
      await prisma.$transaction(async (tx) => {
        await ownerTransferModel.update({
          where: { id: transfer.id },
          data: { status: "EXPIRED", cancelledAt: now },
        });
        await recordOrganizationAudit(tx, {
          organizationId: transfer.organizationId,
          groupId: null,
          actorUserId: user.id,
          action: "OWNER_TRANSFER_EXPIRED",
          entityType: "organization_owner_transfer",
          entityId: transfer.id,
          correlationId: transfer.id,
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
          metadata: { transferId: transfer.id },
          ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
          userAgent: req.headers.get("user-agent"),
        });
        const outbox = await recordOutboxEvent(
          {
            eventType: "organization.owner_transfer.expired",
            payload: {
              transferId: transfer.id,
              organizationId: transfer.organizationId,
              fromUserId: transfer.fromUserId,
              toUserId: transfer.toUserId,
            },
            correlationId: transfer.id,
          },
          tx,
        );
        await appendEventLog(
          {
            eventId: outbox.eventId,
            organizationId: transfer.organizationId,
            eventType: "organization.owner_transfer.expired",
            idempotencyKey: outbox.eventId,
            payload: {
              transferId: transfer.id,
              fromUserId: transfer.fromUserId,
              toUserId: transfer.toUserId,
            },
            actorUserId: user.id,
            sourceId: String(transfer.organizationId),
            correlationId: transfer.id,
          },
          tx,
        );
      });
      return jsonWrap({ ok: false, error: "TRANSFER_EXPIRED" }, { status: 400 });
    }

    const fromMembership = await resolveGroupMemberForOrg({
      organizationId: transfer.organizationId,
      userId: transfer.fromUserId,
    });
    if (!fromMembership || fromMembership.role !== OrganizationMemberRole.OWNER) {
      await prisma.$transaction(async (tx) => {
        await ownerTransferModel.update({
          where: { id: transfer.id },
          data: { status: "CANCELLED", cancelledAt: now },
        });
        await recordOrganizationAudit(tx, {
          organizationId: transfer.organizationId,
          groupId: null,
          actorUserId: user.id,
          action: "OWNER_TRANSFER_CANCELLED",
          entityType: "organization_owner_transfer",
          entityId: transfer.id,
          correlationId: transfer.id,
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
          metadata: { transferId: transfer.id },
          ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
          userAgent: req.headers.get("user-agent"),
        });
        const outbox = await recordOutboxEvent(
          {
            eventType: "organization.owner_transfer.cancelled",
            payload: {
              transferId: transfer.id,
              organizationId: transfer.organizationId,
              fromUserId: transfer.fromUserId,
              toUserId: transfer.toUserId,
            },
            correlationId: transfer.id,
          },
          tx,
        );
        await appendEventLog(
          {
            eventId: outbox.eventId,
            organizationId: transfer.organizationId,
            eventType: "organization.owner_transfer.cancelled",
            idempotencyKey: outbox.eventId,
            payload: {
              transferId: transfer.id,
              fromUserId: transfer.fromUserId,
              toUserId: transfer.toUserId,
            },
            actorUserId: user.id,
            sourceId: String(transfer.organizationId),
            correlationId: transfer.id,
          },
          tx,
        );
      });
      return jsonWrap({ ok: false, error: "TRANSFER_NO_LONGER_VALID" }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: transfer.organizationId },
      select: { id: true, publicName: true, username: true, groupId: true },
    });
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;

    await prisma.$transaction(async (tx) => {
      await ownerTransferModel.update({
        where: { id: transfer.id },
        data: { status: "CONFIRMED", confirmedAt: now },
      });

      await setSoleOwner(tx, transfer.organizationId, transfer.toUserId, transfer.fromUserId);

      await recordOrganizationAudit(tx, {
        organizationId: transfer.organizationId,
        groupId: organization?.groupId ?? null,
        actorUserId: user.id,
        action: "OWNER_TRANSFER_CONFIRMED",
        entityType: "organization_owner_transfer",
        entityId: transfer.id,
        correlationId: transfer.id,
        fromUserId: transfer.fromUserId,
        toUserId: transfer.toUserId,
        metadata: { transferId: transfer.id },
        ip,
        userAgent: req.headers.get("user-agent"),
      });

      const outbox = await recordOutboxEvent(
        {
          eventType: "organization.owner_transfer.confirmed",
          payload: {
            transferId: transfer.id,
            organizationId: transfer.organizationId,
            fromUserId: transfer.fromUserId,
            toUserId: transfer.toUserId,
          },
          correlationId: transfer.id,
        },
        tx,
      );

      await appendEventLog(
        {
          eventId: outbox.eventId,
          organizationId: transfer.organizationId,
          eventType: "organization.owner_transfer.confirmed",
          idempotencyKey: outbox.eventId,
          payload: {
            transferId: transfer.id,
            fromUserId: transfer.fromUserId,
            toUserId: transfer.toUserId,
          },
          actorUserId: user.id,
          sourceId: String(transfer.organizationId),
          correlationId: transfer.id,
        },
        tx,
      );
    });

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[organization/owner/confirm][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);