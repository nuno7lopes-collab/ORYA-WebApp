import { NextRequest } from "next/server";
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
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const DEFAULT_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 3; // 3 dias
const isUniquePendingError = (err: unknown) =>
  typeof err === "object" &&
  err !== null &&
  "code" in err &&
  (err as { code?: string }).code === "P2002";

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
    if (!ownerTransferModel?.create) {
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
    const organizationId = parseOrganizationId(body?.organizationId);
    const targetRaw = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : null;

    if (!organizationId || !targetRaw) {
      return fail(400, "INVALID_PAYLOAD");
    }

    const callerMembership = await resolveGroupMemberForOrg({ organizationId, userId: user.id });
    if (!callerMembership || callerMembership.role !== OrganizationMemberRole.OWNER) {
      return fail(403, "ONLY_OWNER_CAN_TRANSFER");
    }
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { officialEmail: true, officialEmailVerifiedAt: true },
    });
    if (!organization) {
      return fail(404, "ORGANIZATION_NOT_FOUND");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, {
      reasonCode: "ORG_OWNER_TRANSFER",
      organizationId,
    });
    if (!emailGate.ok) {
      return respondError(ctx, { errorCode: emailGate.errorCode ?? "FORBIDDEN", message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.", retryable: false, details: emailGate }, { status: 403 });
    }

    const resolved = await resolveUserIdentifier(targetRaw);
    const targetUserId = resolved?.userId ?? null;
    if (!targetUserId) {
      return fail(404, "TARGET_NOT_FOUND");
    }
    if (targetUserId === user.id) {
      return fail(400, "CANNOT_TRANSFER_TO_SELF");
    }

    const now = Date.now();
    const expiresAt = new Date(now + DEFAULT_EXPIRATION_MS);
    const token = randomUUID();

    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null;
    let transfer;
    try {
      transfer = await prisma.$transaction(async (tx) => {
        const ownerTransferTx = (tx as any).organizationOwnerTransfer;
        if (!ownerTransferTx?.create) {
          throw new Error("OWNER_TRANSFER_UNAVAILABLE");
        }
        // Cancela pedidos pendentes anteriores
        await ownerTransferTx.updateMany({
          where: { organizationId, status: "PENDING" },
          data: { status: "CANCELLED", cancelledAt: new Date(now) },
        });

        const created = await ownerTransferTx.create({
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
            dedupeKey: `owner_transfer.requested:${created.id}`,
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
        return fail(409, "OWNER_TRANSFER_PENDING_EXISTS");
      }
      throw err;
    }

    return respondOk(ctx, { transfer: {
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
    return fail(500, "INTERNAL_ERROR");
  }
}
export const POST = withApiEnvelope(_POST);
