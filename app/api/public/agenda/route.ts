export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { listPublicAgenda } from "@/domain/publicApi/agenda";
import { SourceType } from "@prisma/client";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const parseDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function fail(ctx: RequestContext, status: number, message: string, errorCode = "INVALID_REQUEST") {
  const resolvedCode = /^[A-Z0-9_]+$/.test(message) ? message : errorCode;
  return respondError(ctx, { errorCode: resolvedCode, message, retryable: false }, { status });
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "public_agenda",
    max: 120,
  });
  if (rateLimited) return rateLimited;

  const orgIdParam = req.nextUrl.searchParams.get("organizationId");
  const orgId = orgIdParam ? Number(orgIdParam) : Number.NaN;
  if (!Number.isFinite(orgId)) {
    return fail(ctx, 400, "ORG_ID_REQUIRED");
  }

  const padelClubParam = req.nextUrl.searchParams.get("padelClubId");
  const courtParam = req.nextUrl.searchParams.get("courtId");
  const padelClubId = padelClubParam ? Number(padelClubParam) : null;
  const courtId = courtParam ? Number(courtParam) : null;
  if (padelClubParam && !Number.isFinite(padelClubId)) {
    return fail(ctx, 400, "INVALID_CLUB");
  }
  if (courtParam && !Number.isFinite(courtId)) {
    return fail(ctx, 400, "INVALID_COURT");
  }

  const from = parseDate(req.nextUrl.searchParams.get("from"));
  const to = parseDate(req.nextUrl.searchParams.get("to"));
  if (req.nextUrl.searchParams.has("from") && !from) {
    return fail(ctx, 400, "INVALID_FROM");
  }
  if (req.nextUrl.searchParams.has("to") && !to) {
    return fail(ctx, 400, "INVALID_TO");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true },
  });
  if (!organization) {
    return fail(ctx, 404, "ORG_NOT_FOUND");
  }

  let resolvedClubId: number | null = padelClubId && Number.isFinite(padelClubId) ? padelClubId : null;
  const resolvedCourtId: number | null = courtId && Number.isFinite(courtId) ? courtId : null;
  if (resolvedClubId) {
    const club = await prisma.padelClub.findFirst({
      where: { id: resolvedClubId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!club) return fail(ctx, 404, "CLUB_NOT_FOUND");
  }
  if (resolvedCourtId) {
    const court = await prisma.padelClubCourt.findFirst({
      where: { id: resolvedCourtId, club: { organizationId: orgId, deletedAt: null } },
      select: { id: true, padelClubId: true },
    });
    if (!court) return fail(ctx, 404, "COURT_NOT_FOUND");
    if (resolvedClubId && court.padelClubId !== resolvedClubId) {
      return fail(ctx, 400, "COURT_CLUB_MISMATCH");
    }
    if (!resolvedClubId) resolvedClubId = court.padelClubId;
  }

  const items = await listPublicAgenda({
    organizationId: orgId,
    from,
    to,
    padelClubId: resolvedClubId,
    courtId: resolvedCourtId,
    sourceTypes: [SourceType.EVENT, SourceType.TOURNAMENT],
  });

  return respondOk(ctx, { items }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
