import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { getSupportTicketDetail } from "@/lib/domain/supportTickets";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, message: string) {
  return respondError(
    ctx,
    {
      errorCode: status === 404 ? "NOT_FOUND" : status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR",
      message,
      retryable: status >= 500,
    },
    { status },
  );
}

async function _GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return fail(ctx, admin.status, admin.error);
    }

    const { id } = await context.params;
    const ticket = await getSupportTicketDetail(id);
    if (!ticket) {
      return fail(ctx, 404, "TICKET_NOT_FOUND");
    }

    return respondOk(
      ctx,
      {
        ticket: {
          ...ticket,
          ticketNumber: ticket.ticketNumber.toString(),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[admin/support/tickets/:id][GET]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export const GET = withApiEnvelope(_GET);
