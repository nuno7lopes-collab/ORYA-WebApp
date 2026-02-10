import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";
import { resolveInviteTokenGrant } from "@/lib/invites/inviteTokens";
import { evaluateEventAccess } from "@/domain/access/evaluateAccess";
import { validateUsername } from "@/lib/username";
import { resolveUserIdentifier } from "@/lib/userResolver";
import { getLatestPolicyForEvent } from "@/lib/checkin/accessPolicy";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type CheckResult =
  | { ok: true; normalized: string; type: "email" | "username" }
  | { ok: false; error: string };

function normalizeIdentifier(raw: string): CheckResult {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Identificador vazio." };

  const explicitUsername = value.startsWith("@") && !value.slice(1).includes("@");
  if (explicitUsername) {
    const validation = validateUsername(value.slice(1), { skipReservedCheck: true });
    if (!validation.valid) return { ok: false, error: validation.error };
    return { ok: true, normalized: validation.normalized, type: "username" };
  }

  if (value.includes("@")) {
    if (!EMAIL_REGEX.test(value)) {
      return { ok: false, error: "Email inválido." };
    }
    const normalized = normalizeEmail(value);
    if (!normalized) return { ok: false, error: "Email inválido." };
    return { ok: true, normalized, type: "email" };
  }

  const validation = validateUsername(value, { skipReservedCheck: true });
  if (!validation.valid) return { ok: false, error: validation.error };
  return { ok: true, normalized: validation.normalized, type: "username" };
}

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
  try {
    const resolved = await params;
    const slug = resolved.slug;
    if (!slug) {
      return fail(400, "SLUG_REQUIRED");
    }

    let body: { identifier?: string; scope?: string; token?: string; ticketTypeId?: number | null } | null = null;
    try {
      body = (await req.json()) as { identifier?: string; scope?: string; token?: string; ticketTypeId?: number | null };
    } catch {
      return fail(400, "BODY_INVALID");
    }

    const scopeRaw = typeof body?.scope === "string" ? body.scope.trim().toUpperCase() : "";
    const scope = scopeRaw === "PARTICIPANT" ? "PARTICIPANT" : "PUBLIC";
    const inviteToken = typeof body?.token === "string" ? body.token.trim() : "";
    const ticketTypeId =
      typeof body?.ticketTypeId === "number" && Number.isFinite(body.ticketTypeId)
        ? body.ticketTypeId
        : null;

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, ownerUserId: true },
    });
    if (!event) {
      return fail(404, "EVENT_NOT_FOUND");
    }
    const accessPolicy = await getLatestPolicyForEvent(event.id, prisma);
    const inviteIdentityMatch = accessPolicy?.inviteIdentityMatch ?? "BOTH";
    const allowEmail = inviteIdentityMatch === "EMAIL" || inviteIdentityMatch === "BOTH";
    const allowUsername = inviteIdentityMatch === "USERNAME" || inviteIdentityMatch === "BOTH";

    if (inviteToken) {
      const accessDecision = await evaluateEventAccess({ eventId: event.id, intent: "INVITE_TOKEN" });
      if (!accessDecision.allowed) {
        return respondOk(ctx, {
          invited: false,
          reason: accessDecision.reasonCode ?? "INVITE_TOKEN_NOT_ALLOWED",
        });
      }

      const grantResult = await resolveInviteTokenGrant(
        {
          eventId: event.id,
          token: inviteToken,
          ticketTypeId,
        },
        prisma,
      );
      if (!grantResult.ok) {
        return respondOk(ctx, { invited: false, reason: grantResult.reason });
      }

      if (!event.ownerUserId) {
        return respondError(
          ctx,
          { errorCode: "EVENT_OWNER_REQUIRED", message: "EVENT_OWNER_REQUIRED", retryable: false },
          { status: 500 },
        );
      }

      const invite = await prisma.eventInvite.findFirst({
        where: { eventId: event.id, targetIdentifier: grantResult.grant.emailNormalized, scope },
        select: { id: true },
      });
      const ensuredInvite =
        invite ??
        (await prisma.eventInvite.create({
          data: {
            eventId: event.id,
            invitedByUserId: event.ownerUserId,
            targetIdentifier: grantResult.grant.emailNormalized,
            scope,
          },
          select: { id: true },
        }));

      return respondOk(ctx, {
        invited: true,
        type: "email",
        normalized: grantResult.grant.emailNormalized,
        eventInviteId: ensuredInvite.id,
        expiresAt: grantResult.grant.expiresAt,
        ticketTypeId: grantResult.grant.ticketTypeId ?? undefined,
      });
    }

    const identifier = typeof body?.identifier === "string" ? body.identifier : "";
    const normalized = normalizeIdentifier(identifier);
    if (!normalized.ok) {
      return fail(400, normalized.error);
    }
    if (normalized.type === "email" && !allowEmail) {
      return respondOk(ctx, { invited: false, reason: "INVITE_IDENTITY_MATCH_REQUIRED" });
    }
    if (normalized.type === "username" && !allowUsername) {
      return respondOk(ctx, { invited: false, reason: "INVITE_IDENTITY_MATCH_REQUIRED" });
    }
    if (normalized.type === "username") {
      const resolvedUser = await resolveUserIdentifier(normalized.normalized).catch(() => null);
      if (!resolvedUser?.userId) {
        return respondOk(ctx, { invited: false, reason: "USERNAME_NOT_FOUND" });
      }
    }

    const invite = await prisma.eventInvite.findFirst({
      where: { eventId: event.id, targetIdentifier: normalized.normalized, scope },
      select: { id: true },
    });

    return respondOk(ctx, {
      invited: Boolean(invite),
      type: normalized.type,
      normalized: normalized.normalized,
    });
  } catch (err) {
    console.error("[eventos/invites/check]", err);
    return fail(500, "Erro ao validar convite.");
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
  return "INTERNAL_ERROR";
}
export const POST = withApiEnvelope(_POST);
