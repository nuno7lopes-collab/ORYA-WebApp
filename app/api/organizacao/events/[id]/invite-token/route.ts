import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
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
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const limiter = await rateLimit(req, { windowMs: 5 * 60 * 1000, max: 10, keyPrefix: "invite_token_issue" });
    if (!limiter.allowed) {
      return jsonWrap({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const resolved = await params;
    const eventId = Number(resolved.id);
    if (!Number.isFinite(eventId)) {
      return jsonWrap({ ok: false, error: "EVENT_ID_INVALID" }, { status: 400 });
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
      return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }
    if (event.organizationId == null) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }
    const organizationId = event.organizationId;

    const access = await ensureGroupMemberModuleAccess({
      organizationId,
      userId: user.id,
      moduleKey: OrganizationModule.EVENTOS,
      required: "EDIT",
    });
    if (!access.ok) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (event.organization) {
      const emailGate = ensureOrganizationEmailVerified(event.organization);
      if (!emailGate.ok) {
        return jsonWrap({ ok: false, error: emailGate.error }, { status: 403 });
      }
    }

    const body = (await req.json().catch(() => null)) as {
      email?: string;
      ticketTypeId?: number | null;
    } | null;

    const emailRaw = typeof body?.email === "string" ? body.email.trim() : "";
    const emailNormalized = normalizeEmail(emailRaw);
    if (!emailNormalized) {
      return jsonWrap({ ok: false, error: "INVITE_EMAIL_INVALID" }, { status: 400 });
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
        return jsonWrap({ ok: false, error: "INVITE_TICKET_TYPE_INVALID" }, { status: 400 });
      }
    }

    const accessDecision = await evaluateEventAccess({ eventId, userId: user.id, intent: "INVITE_TOKEN" });
    if (!accessDecision.allowed) {
      const reason = accessDecision.reasonCode;
      const status = reason === "INVITE_TOKEN_TTL_REQUIRED" ? 400 : 409;
      return jsonWrap({ ok: false, error: reason }, { status });
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

    return jsonWrap({ ok: true, token: issued.token, expiresAt: issued.expiresAt });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "";
    if (message === "INVITE_TOKEN_NOT_ALLOWED") {
      return jsonWrap({ ok: false, error: "INVITE_TOKEN_NOT_ALLOWED" }, { status: 409 });
    }
    if (message === "INVITE_TOKEN_TTL_REQUIRED") {
      return jsonWrap({ ok: false, error: "INVITE_TOKEN_TTL_REQUIRED" }, { status: 400 });
    }
    if (message === "INVITE_IDENTITY_MATCH_UNSUPPORTED") {
      return jsonWrap({ ok: false, error: "INVITE_IDENTITY_MATCH_UNSUPPORTED" }, { status: 409 });
    }
    console.error("[organizacao/eventos/invite-token][POST]", err);
    return jsonWrap({ ok: false, error: "UNKNOWN_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
