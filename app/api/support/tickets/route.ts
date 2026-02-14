import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { rateLimit } from "@/lib/auth/rateLimit";
import { createSupportTicket, createSupportTicketSchema } from "@/lib/domain/supportTickets";

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  message: string,
  errorCode: string = status === 429 ? "THROTTLED" : status === 422 ? "VALIDATION_FAILED" : status === 400 ? "BAD_REQUEST" : "INTERNAL_ERROR",
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

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const body = await req.json().catch(() => null);
    const parsed = createSupportTicketSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return fail(ctx, 422, parsed.error.issues[0]?.message ?? "VALIDATION_FAILED");
    }

    const limiter = await rateLimit(req, {
      keyPrefix: "support_ticket_create",
      windowMs: 60 * 1000,
      max: 5,
      identifier: parsed.data.email,
    });
    if (!limiter.allowed) {
      return respondError(
        ctx,
        {
          errorCode: "THROTTLED",
          message: "RATE_LIMITED",
          retryable: false,
          details: { retryAfter: limiter.retryAfter },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfter),
          },
        },
      );
    }

    const ticket = await createSupportTicket(parsed.data);
    return respondOk(
      ctx,
      {
        ticket: {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber.toString(),
          status: ticket.status,
          subject: ticket.subject,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[support/tickets][POST]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export const POST = withApiEnvelope(_POST);
