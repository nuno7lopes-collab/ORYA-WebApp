import crypto from "crypto";
import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { ensureGroupMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule } from "@prisma/client";
import { enqueueNotification } from "@/domain/notifications/outbox";
import { queueImportantUpdateEmail } from "@/domain/notifications/email";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const MAX_TITLE_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 600;

async function ensureOrganizationAccess(userId: string, eventId: number) {
  const evt = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      organizationId: true,
      templateType: true,
      organization: { select: { officialEmail: true, officialEmailVerifiedAt: true } },
    },
  });
  if (!evt?.organizationId || evt.templateType !== "PADEL") return false;
  const emailGate = ensureOrganizationEmailVerified(evt.organization ?? {}, {
    reasonCode: "PADEL_BROADCAST",
    organizationId: evt.organizationId,
  });
  if (!emailGate.ok) return { ...emailGate, status: 403 };
  const access = await ensureGroupMemberModuleAccess({
    organizationId: evt.organizationId,
    userId,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  return access.ok;
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
    return respondError(
      ctx,
      { errorCode: resolvedCode, message: resolvedMessage, retryable },
      { status },
    );
  };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return fail(401, "UNAUTHENTICATED");

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail(400, "INVALID_BODY");

  const eventId = typeof body?.eventId === "number" ? body.eventId : Number(body?.eventId);
  if (!Number.isFinite(eventId)) return fail(400, "INVALID_EVENT");

  const audienceRaw = typeof body?.audience === "string" ? body.audience.toUpperCase() : "ALL";
  const audience = audienceRaw === "WAITLIST" ? "WAITLIST" : audienceRaw === "PLAYERS" ? "PLAYERS" : "ALL";

  const titleRaw = typeof body?.title === "string" ? body.title.trim() : "";
  const messageRaw = typeof body?.message === "string" ? body.message.trim() : "";
  if (!messageRaw) return fail(400, "MESSAGE_REQUIRED");
  if (messageRaw.length > MAX_MESSAGE_LENGTH) return fail(413, "MESSAGE_TOO_LONG");
  if (titleRaw.length > MAX_TITLE_LENGTH) return fail(413, "TITLE_TOO_LONG");

  const authorized = await ensureOrganizationAccess(data.user.id, eventId);
  if (authorized !== true) {
    if (authorized && typeof authorized === "object" && "errorCode" in authorized) {
      return respondError(
        ctx,
        {
          errorCode: authorized.errorCode ?? "FORBIDDEN",
          message: authorized.message ?? authorized.errorCode ?? "Sem permissões.",
          retryable: false,
          details: authorized,
        },
        { status: authorized.status ?? 403 },
      );
    }
    return fail(403, "FORBIDDEN");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, slug: true, organizationId: true },
  });
  if (!event?.organizationId) return fail(404, "EVENT_NOT_FOUND");

  const userIds = new Set<string>();
  if (audience === "ALL" || audience === "PLAYERS") {
    const slots = await prisma.padelPairingSlot.findMany({
      where: {
        pairing: { eventId },
        slotStatus: "FILLED",
        profileId: { not: null },
      },
      select: { profileId: true },
    });
    slots.forEach((slot) => {
      if (slot.profileId) userIds.add(slot.profileId);
    });
  }

  if (audience === "ALL" || audience === "WAITLIST") {
    const waitlist = await prisma.padelWaitlistEntry.findMany({
      where: { eventId, status: "PENDING" },
      select: { userId: true },
    });
    waitlist.forEach((entry) => userIds.add(entry.userId));
  }

  const recipients = Array.from(userIds);
  if (recipients.length === 0) {
    return fail(409, "NO_RECIPIENTS");
  }

  const resolvedTitle = titleRaw || (event.title ? `Atualização · ${event.title}` : "Atualização do torneio");
  const ctaUrl = event.slug ? `/eventos/${event.slug}` : "/eventos";
  const ctaLabel = "Abrir torneio";
  const hash = crypto
    .createHash("sha256")
    .update(`${resolvedTitle}|${messageRaw}|${eventId}`)
    .digest("hex")
    .slice(0, 12);

  await Promise.all(
    recipients.flatMap((userId) => [
      enqueueNotification({
        dedupeKey: `padel:broadcast:${eventId}:${hash}:${userId}`,
        userId,
        notificationType: "SYSTEM_ANNOUNCE",
        templateVersion: "v1",
        payload: {
          title: resolvedTitle,
          body: messageRaw,
          ctaUrl,
          ctaLabel,
          priority: "HIGH",
          organizationId: event.organizationId,
          eventId: event.id,
        },
      }),
      queueImportantUpdateEmail({
        dedupeKey: `email:padel:broadcast:${eventId}:${hash}:${userId}`,
        userId,
        eventTitle: event.title?.trim() || "Torneio Padel",
        message: messageRaw,
        ticketUrl: ctaUrl,
        correlations: {
          eventId: event.id,
          organizationId: event.organizationId,
        },
      }),
    ]),
  );

  await recordOrganizationAuditSafe({
    organizationId: event.organizationId,
    actorUserId: data.user.id,
    action: "PADEL_BROADCAST",
    entityType: "event",
    entityId: String(event.id),
    metadata: { audience, title: resolvedTitle, recipients: recipients.length },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return respondOk(ctx, { ok: true, recipients: recipients.length }, { status: 200 });
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
