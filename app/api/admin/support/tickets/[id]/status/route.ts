import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/audit";
import { supportTicketStatusUpdateSchema, updateSupportTicketStatus } from "@/lib/domain/supportTickets";

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  message: string,
  errorCode: string = status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : status === 422 ? "VALIDATION_FAILED" : "INTERNAL_ERROR",
) {
  return respondError(
    ctx,
    {
      errorCode,
      message,
      retryable: status >= 500,
    },
    { status },
  );
}

async function _POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return fail(ctx, admin.status, admin.error);
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const parsed = supportTicketStatusUpdateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return fail(ctx, 422, parsed.error.issues[0]?.message ?? "VALIDATION_FAILED", "VALIDATION_FAILED");
    }

    const updated = await updateSupportTicketStatus({
      id,
      status: parsed.data.status,
      adminUserId: admin.userId,
    });

    await auditAdminAction({
      action: "SUPPORT_TICKET_STATUS_UPDATE",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
      payload: {
        ticketId: id,
        status: parsed.data.status,
      },
    });

    return respondOk(
      ctx,
      {
        ticket: {
          id: updated.id,
          status: updated.status,
          closedAt: updated.closedAt,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "INTERNAL_ERROR";
    if (message === "TICKET_NOT_FOUND") {
      return fail(ctx, 404, message, "NOT_FOUND");
    }
    console.error("[admin/support/tickets/:id/status][POST]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export const POST = withApiEnvelope(_POST);
