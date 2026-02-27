import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";
import { rateLimit } from "@/lib/auth/rateLimit";
import { resolveInviteTokenGrant } from "@/lib/invites/inviteTokens";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolveEventOperationalBlockReason } from "@/domain/events/lifecycle";

async function _POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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
  const limiter = await rateLimit(req, { windowMs: 5 * 60 * 1000, max: 10, keyPrefix: "invite_token" });
  if (!limiter.allowed) {
    return fail(429, "RATE_LIMITED");
  }

  const resolved = await params;
  const body = (await req.json().catch(() => null)) as {
    token?: string;
    email?: string;
    ticketTypeId?: number | null;
  } | null;

  const inviteToken = typeof body?.token === "string" ? body.token.trim() : "";
  const emailNormalized = normalizeEmail(typeof body?.email === "string" ? body.email.trim() : "");
  const ticketTypeId =
    typeof body?.ticketTypeId === "number" && Number.isFinite(body.ticketTypeId)
      ? body.ticketTypeId
      : null;

  if (!inviteToken) {
    return respondOk(ctx, { allow: false, reason: "INVITE_TOKEN_REQUIRED" });
  }

  const event = await prisma.event.findUnique({
    where: { slug: resolved.slug },
    select: { id: true, status: true, endsAt: true, isDeleted: true },
  });
  if (!event) {
    return respondOk(ctx, { allow: false, reason: "EVENT_NOT_FOUND" });
  }
  const blockReason = resolveEventOperationalBlockReason({
    status: event.status,
    isDeleted: event.isDeleted,
    endsAt: event.endsAt,
  });
  if (blockReason) {
    return respondOk(ctx, { allow: false, reason: blockReason });
  }

  const grantResult = await resolveInviteTokenGrant(
    {
      eventId: event.id,
      token: inviteToken,
      emailNormalized: emailNormalized || undefined,
      ticketTypeId,
    },
    prisma,
  );
  if (!grantResult.ok) {
    return respondOk(ctx, { allow: false, reason: grantResult.reason });
  }
  const grantedTicketTypeId =
    typeof grantResult.grant.ticketTypeId === "number" && Number.isFinite(grantResult.grant.ticketTypeId)
      ? grantResult.grant.ticketTypeId
      : null;
  if (!grantedTicketTypeId) {
    return respondOk(ctx, { allow: false, reason: "INVITE_TICKET_TYPE_REQUIRED" });
  }

  return respondOk(ctx, {
    allow: true,
    normalized: grantResult.grant.emailNormalized,
    expiresAt: grantResult.grant.expiresAt,
    ticketTypeId: grantedTicketTypeId,
  });
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  if (status === 429) return "RATE_LIMITED";
  return "INTERNAL_ERROR";
}
export const POST = withApiEnvelope(_POST);
