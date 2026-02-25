export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { parsePositiveInt, proxyJsonToServiceApi, resolveOrganizationByUsername } from "../../_lib/helpers";

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const resolvedParams = await params;
  const organization = await resolveOrganizationByUsername(resolvedParams.username);
  if (!organization) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const courtId = parsePositiveInt(req.nextUrl.searchParams.get("courtId"));
  if (!courtId) {
    return jsonWrap({ ok: false, error: "INVALID_COURT" }, { status: 400 });
  }

  const config = await prisma.courtBookingConfig.findFirst({
    where: {
      organizationId: organization.id,
      courtId,
    },
    select: {
      isActive: true,
      backingService: {
        select: {
          id: true,
          kind: true,
          isActive: true,
        },
      },
    },
  });

  if (!config || !config.isActive) {
    return jsonWrap({ ok: false, error: "COURT_CONFIG_MISSING" }, { status: 409 });
  }
  if (!config.backingService?.isActive || config.backingService.kind !== "COURT") {
    return jsonWrap({ ok: false, error: "SERVICE_NOT_FOUND" }, { status: 404 });
  }

  const query = new URLSearchParams(req.nextUrl.searchParams);
  query.delete("courtId");
  query.delete("serviceId");
  query.set("courtId", String(courtId));

  return proxyJsonToServiceApi({
    req,
    serviceId: config.backingService.id,
    pathnameSuffix: "calendario",
    method: "GET",
    query,
  });
}

export const GET = withApiEnvelope(_GET);
