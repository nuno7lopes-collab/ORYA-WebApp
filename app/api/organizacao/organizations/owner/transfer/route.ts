import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { randomUUID } from "crypto";
import { OrganizationMemberRole } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { getOrgTransferEnabled } from "@/lib/platformSettings";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { parseOrganizationId } from "@/lib/organizationId";
import { resolveGroupMemberForOrg } from "@/lib/organizationGroupAccess";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const DEFAULT_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 3; // 3 dias
const isUniquePendingError = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  (err as { code?: string }).code === "P2002";

async function _POST(req: NextRequest) {
  try {
    const ownerTransferModel = (prisma as any).organizationOwnerTransfer;
    if (!ownerTransferModel?.create) {
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
    const organizationId = parseOrganizationId(body?.organizationId);
    const targetRaw = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : null;

    if (!organizationId || !targetRaw) {
      return jsonWrap({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership || callerMembership.role !== OrganizationMemberRole.OWNER) {
      return jsonWrap({ ok: false, error: "ONLY_OWNER_CAN_TRANSFER" }, { status: 403 });
    }

    const resolved = await resolveUserIdentifier(targetRaw);
    const targetUserId = resolved?.userId ?? null;
    if (!targetUserId) {
      return jsonWrap({ ok: false, error: "TARGET_NOT_FOUND" }, { status: 404 });
    }
    if (targetUserId === user.id) {
      return jsonWrap({ ok: false, error: "CANNOT_TRANSFER_TO_SELF" }, { status: 400 });
    }

    const now = Date.now();
    const expiresAt = new Date(now + DEFAULT_EXPIRATION_MS);
    const token = randomUUID();

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    let transfer;
    try {
      transfer = await prisma.$transaction(async (tx) => {
        // Cancela pedidos pendentes anteriores
        await ownerTransferModel.updateMany({
          where: { organizationId, status: "PENDING" },
          data: { status: "CANCELLED", cancelledAt: new Date(now) },
        });

        const created = await ownerTransferModel.create({
          data: {
            organizationId,
            fromUserId: user.id,
            toUserId: targetUserId,
            status: "PENDING",
            token,
            expiresAt,
          },
        });

        await recordOrganizationAudit(tx, {
          organizationId,
          groupId: callerMembership.groupId,
          actorUserId: user.id,
          action: "OWNER_TRANSFER_REQUESTED",
          entityType: "organization_owner_transfer",
          entityId: created.id,
          correlationId: created.id,
          fromUserId: user.id,
          toUserId: targetUserId,
          metadata: { transferId: created.id },
          ip,
          userAgent: req.headers.get("user-agent"),
        });

        const outbox = await recordOutboxEvent(
          {
            eventType: "organization.owner_transfer.requested",
            payload: {
              transferId: created.id,
              organizationId,
              fromUserId: user.id,
              toUserId: targetUserId,
              expiresAt: created.expiresAt,
            },
            correlationId: created.id,
          },
          tx,
        );

        await appendEventLog(
          {
            eventId: outbox.eventId,
            organizationId,
            eventType: "organization.owner_transfer.requested",
            idempotencyKey: outbox.eventId,
            payload: {
              transferId: created.id,
              fromUserId: user.id,
              toUserId: targetUserId,
              expiresAt: created.expiresAt,
            },
            actorUserId: user.id,
            sourceType: null,
            sourceId: null,
            correlationId: created.id,
          },
          tx,
        );

        return created;
      });
    } catch (err) {
      if (isUniquePendingError(err)) {
        return jsonWrap({ ok: false, error: "OWNER_TRANSFER_PENDING_EXISTS" }, { status: 409 });
      }
      throw err;
    }

    return jsonWrap(
      {
        ok: true,
        transfer: {
          id: transfer.id,
          status: transfer.status,
          token: transfer.token,
          expiresAt: transfer.expiresAt,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organization/owner/transfer][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);