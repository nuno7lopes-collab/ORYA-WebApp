export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { prisma } from "@/lib/prisma";
import { buildPadelLiveReadModel } from "@/domain/padel/liveReadModel";

const parseDay = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-CA");
};

function fail(
  ctx: RequestContext,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_public_calendar",
    max: 120,
  });
  if (rateLimited) return rateLimited;

  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const slug = req.nextUrl.searchParams.get("slug");
  const eventId = eventIdParam ? Number(eventIdParam) : null;
  if (!eventId && !slug) {
    return fail(ctx, 400, "EVENT_REQUIRED");
  }

  const eventRef = await prisma.event.findUnique({
    where: eventId ? { id: eventId, isDeleted: false } : { slug: slug!, isDeleted: false },
    select: { id: true },
  });
  if (!eventRef?.id) return fail(ctx, 404, "EVENT_NOT_FOUND");

  const live = await buildPadelLiveReadModel({ eventId: eventRef.id, visibility: "public" });
  if (!live) return fail(ctx, 404, "EVENT_NOT_FOUND");
  if (!live.event.isPublicEvent) return fail(ctx, 403, "FORBIDDEN");

  const dayFilter = parseDay(req.nextUrl.searchParams.get("date"));
  const days = dayFilter ? live.calendar_days.filter((day) => day.date === dayFilter) : live.calendar_days;

  return respondOk(
    ctx,
    {
      event: {
        id: live.event.id,
        slug: live.event.slug,
        title: live.event.title,
        timezone: live.event.timezone,
      },
      days,
    },
    { status: 200 },
  );
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

export const GET = withApiEnvelope(_GET);
