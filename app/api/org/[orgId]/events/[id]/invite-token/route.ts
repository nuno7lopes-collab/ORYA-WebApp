import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { issueInviteToken } from "@/lib/invites/inviteTokens";
import { normalizeEmail } from "@/lib/utils/email";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { rateLimit } from "@/lib/auth/rateLimit";
import { evaluateEventAccess } from "@/domain/access/evaluateAccess";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
    details?: Record<string, unknown>,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
      { status },
    );
  };
  try {
    const limiter = await rateLimit(req, { windowMs: 5 * 60 * 1000, max: 10, keyPrefix: "invite_token_issue" });
    if (!limiter.allowed) {
      return fail(429, "RATE_LIMITED");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const resolved = await params;
    const eventId = Number(resolved.id);
    if (!Number.isFinite(eventId)) {
      return fail(400, "EVENT_ID_INVALID");
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizationId: true,
        organization: { select: { officialEmail: true, officialEmailVerifiedAt: true } },
      },
    });
    if (!event) {
      return fail(404, "EVENT_NOT_FOUND");
    }
    if (event.organizationId == null) {
      return fail(403, "FORBIDDEN");
    }
    const organizationId = event.organizationId;

    const access = await ensureGroupMemberModuleAccess({
      organizationId,
      userId: user.id,
      moduleKey: OrganizationModule.EVENTOS,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(403, "FORBIDDEN");
    }

    if (event.organization) {
      const emailGate = ensureOrganizationEmailVerified(event.organization, {
        reasonCode: "EVENTS_INVITE_TOKEN",
        organizationId,
      });
      if (!emailGate.ok) {
        return respondError(
          ctx,
          {
            errorCode: emailGate.errorCode ?? "FORBIDDEN",
            message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.",
            retryable: false,
            details: emailGate,
          },
          { status: 403 },
        );
      }
    }

    const body = (await req.json().catch(() => null)) as {
      email?: string;
      ticketTypeId?: number | null;
    } | null;

    const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
    const emailNormalized = normalizeEmail(emailRaw);
    if (!emailNormalized) {
      return fail(400, "INVITE_EMAIL_INVALID");
    }

    const ticketTypeId =
      typeof body?.ticketTypeId === "number" && Number.isFinite(body.ticketTypeId)
        ? body.ticketTypeId
        : null;

    if (ticketTypeId) {
      const ticketType = await prisma.ticketType.findUnique({
        where: { id: ticketTypeId },
        select: { id: true, eventId: true },
      });
      if (!ticketType || ticketType.eventId !== eventId) {
        return fail(400, "INVITE_TICKET_TYPE_INVALID");
      }
    }

    const accessDecision = await evaluateEventAccess({ eventId, userId: user.id, intent: "INVITE_TOKEN" });
    if (!accessDecision.allowed) {
      const reason = accessDecision.reasonCode;
      const status = reason === "INVITE_TOKEN_TTL_REQUIRED" ? 400 : 409;
      return fail(status, reason);
    }

    const issued = await prisma.$transaction(async (tx) => {
      const created = await issueInviteToken(
        {
          eventId,
          email: emailNormalized,
          ticketTypeId,
        },
        tx,
      );

      const outbox = await recordOutboxEvent(
        {
          eventType: "event.invite_token.created",
          dedupeKey: `event.invite_token.created:${created.inviteTokenId}`,
          payload: {
            inviteTokenId: created.inviteTokenId,
            eventId,
            ticketTypeId,
          },
          correlationId: created.inviteTokenId,
        },
        tx,
      );

      await appendEventLog(
        {
          eventId: outbox.eventId,
          organizationId,
          eventType: "event.invite_token.created",
          idempotencyKey: outbox.eventId,
          payload: {
            inviteTokenId: created.inviteTokenId,
            eventId,
            ticketTypeId,
          },
          actorUserId: user.id,
          sourceId: String(eventId),
          correlationId: created.inviteTokenId,
        },
        tx,
      );

      return created;
    });

    return respondOk(ctx, { token: issued.token, expiresAt: issued.expiresAt });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "";
    if (message === "INVITE_TOKEN_NOT_ALLOWED") {
      return fail(409, "INVITE_TOKEN_NOT_ALLOWED");
    }
    if (message === "INVITE_TOKEN_TTL_REQUIRED") {
      return fail(400, "INVITE_TOKEN_TTL_REQUIRED");
    }
    if (message === "INVITE_TOKEN_REQUIRES_EMAIL") {
      return fail(409, "INVITE_TOKEN_REQUIRES_EMAIL");
    }
    console.error("[organizacao/eventos/invite-token][POST]", err);
    return fail(500, "UNKNOWN_ERROR");
  }
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
