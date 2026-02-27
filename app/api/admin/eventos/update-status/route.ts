// app/api/admin/eventos/update-status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { refundKey } from "@/lib/stripe/idempotency";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { auditAdminAction } from "@/lib/admin/audit";
import { logError } from "@/lib/observability/logger";
import { getClientIp } from "@/lib/auth/requestValidation";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

/**
 * 6.14 – Update de estado de evento (admin)
 *
 * Body esperado (POST JSON):
 * {
 *   "eventId"?: number | string,
 *   "slug"?: string,
 *   "status": string  // ex: "PUBLISHED", "CANCELLED", "BLOCKED"...
 * }
 *
 * Regras:
 *  - Só utilizadores com role "admin" podem chamar.
 *  - É possível identificar evento por eventId OU por slug.
 */
async function _POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent");

    const body = (await req.json().catch(() => null)) as
      | {
          eventId?: number | string;
          slug?: string;
          status?: string;
        }
      | null;

    if (!body || typeof body !== "object") {
      return jsonWrap(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { eventId, slug, status } = body;

    if (!status || typeof status !== "string") {
      return jsonWrap(
        { ok: false, error: "MISSING_STATUS" },
        { status: 400 }
      );
    }
    const nextStatus = status.trim().toUpperCase();
    if (!nextStatus) {
      return jsonWrap(
        { ok: false, error: "STATUS_INVALID" },
        { status: 400 }
      );
    }
    if (nextStatus !== "PUBLISHED" && nextStatus !== "CANCELLED") {
      return jsonWrap(
        { ok: false, error: "UNSUPPORTED_EVENT_STATUS_TRANSITION" },
        { status: 400 }
      );
    }

    // Construir o "where" dinamicamente: por id OU por slug
    let whereClause:
      | {
          id: number;
        }
      | {
          slug: string;
        }
      | null = null;

    if (typeof eventId === "number") {
      whereClause = { id: eventId };
    } else if (typeof eventId === "string") {
      const parsed = Number(eventId);
      if (!Number.isNaN(parsed)) {
        whereClause = { id: parsed };
      }
    } else if (typeof slug === "string" && slug.trim() !== "") {
      whereClause = { slug: slug.trim() };
    }

    if (!whereClause) {
      return jsonWrap(
        { ok: false, error: "MISSING_EVENT_IDENTIFIER" },
        { status: 400 }
      );
    }

    // Atualizar evento
    try {
      const existing = await prisma.event.findUnique({
        where: "id" in whereClause ? { id: whereClause.id } : { slug: whereClause.slug },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          type: true,
          organizationId: true,
          startsAt: true,
          endsAt: true,
        },
      });
      if (!existing) {
        return jsonWrap(
          { ok: false, error: "EVENT_NOT_FOUND" },
          { status: 404 }
        );
      }
      const eventEndsAt = existing.endsAt ? new Date(existing.endsAt) : null;
      const endedByDate =
        eventEndsAt && Number.isFinite(eventEndsAt.getTime())
          ? eventEndsAt.getTime() < Date.now()
          : false;
      if (String(existing.status) === "CANCELLED") {
        return jsonWrap(
          { ok: false, error: "EVENT_CANCELLED_TERMINAL" },
          { status: 409 }
        );
      }
      if (String(existing.status) === "FINISHED" || endedByDate) {
        return jsonWrap(
          { ok: false, error: "EVENT_ALREADY_FINISHED" },
          { status: 409 }
        );
      }

      const updated = await prisma.event.update({
        where: { id: existing.id },
        data: {
          status: nextStatus as any,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          type: true,
          organizationId: true,
          startsAt: true,
          updatedAt: true,
        },
      });

      if (existing.status !== updated.status && updated.organizationId != null) {
        await recordOrganizationAuditSafe({
          organizationId: updated.organizationId,
          actorUserId: admin.userId,
          action: "admin_event_status_change",
          metadata: {
            eventId: updated.id,
            slug: updated.slug,
            title: updated.title,
            fromStatus: existing.status,
            toStatus: updated.status,
          },
          ip,
          userAgent,
        });
      }

      const shouldAutoRefund =
        String(existing.status) !== "CANCELLED" && String(updated.status) === "CANCELLED";

      if (shouldAutoRefund) {
        // Disparar refunds base-only para todas as compras deste evento (idempotente por dedupeKey)
        const summaries = await prisma.saleSummary.findMany({
          where: { eventId: updated.id, status: "PAID" },
          select: { purchaseId: true, paymentIntentId: true },
        });
        await Promise.all(
          summaries.map((s) =>
            enqueueOperation({
              operationType: "PROCESS_REFUND_UNIFIED",
              dedupeKey: refundKey(s.purchaseId ?? s.paymentIntentId ?? "unknown"),
              correlations: { eventId: updated.id, purchaseId: s.purchaseId ?? s.paymentIntentId ?? null, paymentIntentId: s.paymentIntentId ?? null },
              payload: {
                eventId: updated.id,
                purchaseId: s.purchaseId ?? s.paymentIntentId ?? null,
                paymentIntentId: s.paymentIntentId ?? null,
                reason: "CANCELLED",
                policyCause: "EVENT_CANCELLED",
                sourceType: "TICKET_ORDER",
                refundedBy: admin.userId,
              },
            }),
          ),
        );
      }

      await auditAdminAction({
        action: "EVENT_STATUS_UPDATE",
        actorUserId: admin.userId,
        payload: {
          eventId: updated.id,
          slug: updated.slug,
          title: updated.title,
          fromStatus: existing.status,
          toStatus: updated.status,
          autoRefundQueued: shouldAutoRefund,
        },
      });

      return jsonWrap(
        {
          ok: true,
          event: updated,
        },
        { status: 200 }
      );
    } catch (err) {
      // P2025 = record not found
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2025"
      ) {
        return jsonWrap(
          { ok: false, error: "EVENT_NOT_FOUND" },
          { status: 404 }
        );
      }

      logError("admin.eventos.update_status_failed", err);
      return jsonWrap(
        { ok: false, error: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  } catch (err) {
    logError("admin.eventos.update_status_unexpected", err);
    return jsonWrap(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
export const POST = withApiEnvelope(_POST);
