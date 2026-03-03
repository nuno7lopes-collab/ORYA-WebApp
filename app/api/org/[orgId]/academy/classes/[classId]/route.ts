import { NextRequest } from "next/server";
import {
  GET as LegacyServiceGet,
  PATCH as LegacyServicePatch,
  DELETE as LegacyServiceDelete,
} from "@/app/api/org/[orgId]/servicos/[id]/route";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";
import {
  assertTrainerIdsBelongToEligibleTeamMembers,
  parseProfessionalIdsInput,
} from "@/lib/academy/trainerTeamGuards";

function mapParams(classId: string) {
  return Promise.resolve({ id: classId });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const resolved = await params;
  const ctx = getRequestContext(req);
  const legacyResponse = await LegacyServiceGet(req, { params: mapParams(resolved.classId) });
  if (!legacyResponse.ok) return legacyResponse;
  const payload = await legacyResponse.json().catch(() => null);
  const service = isRecord(payload) && isRecord(payload.service) ? payload.service : null;
  const kind =
    service && typeof service.kind === "string"
      ? service.kind.trim().toUpperCase()
      : "";
  const vertical =
    service && typeof service.bookingVertical === "string"
      ? service.bookingVertical.trim().toUpperCase()
      : "";
  if (kind !== "CLASS" && vertical !== "CLASS") {
    return respondError(
      ctx,
      { errorCode: "NOT_FOUND", message: "Aula não encontrada.", retryable: false },
      { status: 404 },
    );
  }
  const headers = new Headers(legacyResponse.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(payload), {
    status: legacyResponse.status,
    headers,
  });
}

export async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const ctx = getRequestContext(req);
  const payload = await req.clone().json().catch(() => null);
  if (!isRecord(payload)) {
    return respondError(
      ctx,
      { errorCode: "BAD_REQUEST", message: "Payload inválido.", retryable: false },
      { status: 400 },
    );
  }

  const professionalIdsInput = parseProfessionalIdsInput(payload);
  if (!professionalIdsInput.ok) {
    return respondError(
      ctx,
      {
        errorCode: professionalIdsInput.errorCode,
        message: professionalIdsInput.message,
        retryable: false,
      },
      { status: professionalIdsInput.status },
    );
  }

  if (professionalIdsInput.provided && professionalIdsInput.ids.length > 0) {
    const access = await resolveAcademyOrgAccess(req);
    if (!access.ok) return access.response;
    const trainerValidation = await assertTrainerIdsBelongToEligibleTeamMembers({
      organizationId: access.organization.id,
      professionalIds: professionalIdsInput.ids,
    });
    if (!trainerValidation.ok) {
      return respondError(
        ctx,
        {
          errorCode: "TRAINER_NOT_TEAM_MEMBER",
          message: "Treinadores inválidos: só membros ativos da Equipa podem ser associados a aulas.",
          retryable: false,
          details: { invalidProfessionalIds: trainerValidation.invalidProfessionalIds },
        },
        { status: 409 },
      );
    }
  }

  const resolved = await params;
  const bridgeReq = await withBridgeHeader(req);
  return LegacyServicePatch(bridgeReq, { params: mapParams(resolved.classId) });
}

export async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const resolved = await params;
  const bridgeReq = await withBridgeHeader(req);
  return LegacyServiceDelete(bridgeReq, { params: mapParams(resolved.classId) });
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
