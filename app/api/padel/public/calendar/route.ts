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
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return normalized;
};

const STATUS_FILTERS = new Set([
  "ALL",
  "IN_PROGRESS",
  "PENDING_CONFIRMATION",
  "PENDING_REVIEW_EXPIRED",
  "DISPUTED",
  "RESULT_SUBMITTED",
  "OFFICIAL",
]);

type StatusFilter =
  | "ALL"
  | "IN_PROGRESS"
  | "PENDING_CONFIRMATION"
  | "PENDING_REVIEW_EXPIRED"
  | "DISPUTED"
  | "RESULT_SUBMITTED"
  | "OFFICIAL";

const parseStatusFilter = (value: string | null): StatusFilter => {
  if (!value) return "ALL";
  const normalized = value.trim().toUpperCase();
  return STATUS_FILTERS.has(normalized) ? (normalized as StatusFilter) : "ALL";
};

const parseCourtFilter = (value: string | null) => {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const isOfficialStatus = (status: string) => status === "OFFICIAL" || status === "WALKOVER" || status === "RETIRED";

const matchStatusMatchesFilter = (status: string, filter: StatusFilter) => {
  if (filter === "ALL") return true;
  if (filter === "OFFICIAL") return isOfficialStatus(status);
  return status === filter;
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
  const statusFilter = parseStatusFilter(req.nextUrl.searchParams.get("status"));
  const courtFilter = parseCourtFilter(req.nextUrl.searchParams.get("court"));
  const days = live.calendar_days
    .map((day) => ({
      date: day.date,
      courts: day.courts
        .map((court) => ({
          courtId: court.courtId,
          courtLabel: court.courtLabel,
          matches: court.matches.filter(
            (match) =>
              matchStatusMatchesFilter(match.status, statusFilter) &&
              (!courtFilter || court.courtLabel === courtFilter),
          ),
        }))
        .filter((court) => court.matches.length > 0),
    }))
    .filter((day) => day.courts.length > 0)
    .filter((day) => (dayFilter ? day.date === dayFilter : true));

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
      filters: {
        date: dayFilter,
        status: statusFilter,
        court: courtFilter,
      },
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
