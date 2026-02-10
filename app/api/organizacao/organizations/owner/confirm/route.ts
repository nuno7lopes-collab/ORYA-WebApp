import { NextRequest } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getOrgTransferEnabled } from "@/lib/platformSettings";
import { setSoleOwner } from "@/lib/organizationRoles";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    const ownerTransferModel = (prisma as any).organizationOwnerTransfer;
    if (!ownerTransferModel?.findUnique) {
      return fail(501, "OWNER_TRANSFER_UNAVAILABLE");
    }

    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(401, "UNAUTHENTICATED");
    }

    const transferEnabled = await getOrgTransferEnabled();
    if (!transferEnabled) {
      return fail(403, "ORG_TRANSFER_DISABLED");
    }

    const body = await req.json().catch(() => null);
    const token = typeof body?.token === "string" ? body.token.trim() : null;
    if (!token) {
      return fail(400, "INVALID_TOKEN");
    }

    const transfer = await ownerTransferModel.findUnique({
      where: { token },
    });
    if (!transfer) {
      return fail(404, "TRANSFER_NOT_FOUND");
    }
    const organizationForEmail = await prisma.organization.findUnique({
      where: { id: transfer.organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    });
    if (!organizationForEmail) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }
    const emailGate = ensureOrganizationEmailVerified(organizationForEmail, {
      reasonCode: "ORG_OWNER_CONFIRM",
      organizationId: transfer.organizationId,
    });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.error ?? "FORBIDDEN", message: emailGate.message ?? emailGate.error ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
    }

    if (transfer.status === "CONFIRMED") {
      return respondOk(ctx, {}, { status: 200 });
    }
    if (transfer.status !== "PENDING") {
      return fail(400, "TRANSFER_NOT_PENDING");
    }

    if (transfer.toUserId !== user.id) {
      return fail(403, "TOKEN_USER_MISMATCH");
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
            dedupeKey: `owner_transfer.expired:${transfer.id}`,
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
      return fail(400, "TRANSFER_EXPIRED");
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
            dedupeKey: `owner_transfer.cancelled:${transfer.id}`,
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
      return fail(400, "TRANSFER_NO_LONGER_VALID");
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
          dedupeKey: `owner_transfer.confirmed:${transfer.id}`,
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

    return respondOk(ctx, {}, { status: 200 });
  } catch (err) {
    console.error("[organization/owner/confirm][POST]", err);
    return fail(500, "INTERNAL_ERROR");
  }
}
export const POST = withApiEnvelope(_POST);
