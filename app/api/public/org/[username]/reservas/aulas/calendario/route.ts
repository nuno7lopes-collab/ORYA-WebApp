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

  const serviceId = parsePositiveInt(req.nextUrl.searchParams.get("serviceId"));
  if (!serviceId) {
    return jsonWrap({ ok: false, error: "INVALID_SERVICE" }, { status: 400 });
  }

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      organizationId: organization.id,
      isActive: true,
      kind: "CLASS",
    },
    select: { id: true },
  });

  if (!service) {
    return jsonWrap({ ok: false, error: "SERVICE_NOT_FOUND" }, { status: 404 });
  }

  const query = new URLSearchParams(req.nextUrl.searchParams);
  query.delete("serviceId");

  return proxyJsonToServiceApi({
    req,
    serviceId: service.id,
    pathnameSuffix: "calendario",
    method: "GET",
    query,
  });
}

export const GET = withApiEnvelope(_GET);
