import { NextRequest } from "next/server";
import {
  PATCH as LegacySeriesPatch,
  DELETE as LegacySeriesDelete,
} from "@/app/api/org/[orgId]/servicos/[id]/class-series/[seriesId]/route";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";
import {
  assertTrainerIdsBelongToEligibleTeamMembers,
  parseProfessionalIdInput,
} from "@/lib/academy/trainerTeamGuards";

function mapParams(classId: string, seriesId: string) {
  return Promise.resolve({ id: classId, seriesId });
}

async function withBridgeHeader(req: NextRequest) {
  const body =
    req.method === "PATCH" || req.method === "POST" || req.method === "PUT"
      ? await req.text()
      : undefined;
  return new NextRequest(req.url, {
    method: req.method,
    headers: new Headers({
      ...Object.fromEntries(req.headers.entries()),
      "x-orya-academy-bridge": "1",
    }),
    ...(body ? { body } : {}),
  });
}

export async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string; seriesId: string }> },
) {
  const ctx = getRequestContext(req);
  const payload = await req.clone().json().catch(() => null);
  if (typeof payload !== "object" || payload == null) {
    return respondError(
      ctx,
      { errorCode: "BAD_REQUEST", message: "Payload inválido.", retryable: false },
      { status: 400 },
    );
  }

  const professionalIdInput = parseProfessionalIdInput(payload as Record<string, unknown>);
  if (!professionalIdInput.ok) {
    return respondError(
      ctx,
      {
        errorCode: professionalIdInput.errorCode,
        message: professionalIdInput.message,
        retryable: false,
      },
      { status: professionalIdInput.status },
    );
  }

  if (professionalIdInput.provided && professionalIdInput.professionalId != null) {
    const access = await resolveAcademyOrgAccess(req);
    if (!access.ok) return access.response;
    const trainerValidation = await assertTrainerIdsBelongToEligibleTeamMembers({
      organizationId: access.organization.id,
      professionalIds: [professionalIdInput.professionalId],
    });
    if (!trainerValidation.ok) {
      return respondError(
        ctx,
        {
          errorCode: "TRAINER_NOT_TEAM_MEMBER",
          message: "Treinador inválido: só membros ativos da Equipa podem ser associados a séries.",
          retryable: false,
          details: { invalidProfessionalIds: trainerValidation.invalidProfessionalIds },
        },
        { status: 409 },
      );
    }
  }

  const resolved = await params;
  const bridgeReq = await withBridgeHeader(req);
  return LegacySeriesPatch(bridgeReq, { params: mapParams(resolved.classId, resolved.seriesId) });
}

export async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string; seriesId: string }> },
) {
  const resolved = await params;
  const bridgeReq = await withBridgeHeader(req);
  return LegacySeriesDelete(bridgeReq, { params: mapParams(resolved.classId, resolved.seriesId) });
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
