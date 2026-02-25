export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { parsePositiveInt, proxyJsonToServiceApi, resolveOrganizationByUsername } from "../../_lib/helpers";

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const resolvedParams = await params;
  const organization = await resolveOrganizationByUsername(resolvedParams.username);
  if (!organization) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  if (organization.settings?.bookingAcceptNewReservations === false) {
    return jsonWrap({ ok: false, error: "RESERVAS_OPERATIONAL_OFF" }, { status: 409 });
  }

  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return jsonWrap({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const courtId = parsePositiveInt(String(payload.courtId ?? ""));
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

  const proxiedPayload = {
    ...payload,
    courtId,
  };
  delete (proxiedPayload as { serviceId?: unknown }).serviceId;

  return proxyJsonToServiceApi({
    req,
    serviceId: config.backingService.id,
    pathnameSuffix: "reservar",
    method: "POST",
    body: proxiedPayload,
  });
}

export const POST = withApiEnvelope(_POST);
