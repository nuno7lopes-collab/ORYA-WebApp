import { NextRequest } from "next/server";
import { GET as LegacyServicesGet, POST as LegacyServicesPost } from "@/app/api/org/[orgId]/servicos/route";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { resolveAcademyOrgAccess } from "@/lib/academy/apiAccess";
import {
  assertTrainerIdsBelongToEligibleTeamMembers,
  parseProfessionalIdsInput,
} from "@/lib/academy/trainerTeamGuards";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractItems(payload: unknown): unknown[] {
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (isRecord(payload.data) && Array.isArray(payload.data.items)) return payload.data.items;
  if (isRecord(payload.result) && Array.isArray(payload.result.items)) return payload.result.items;
  return [];
}

function withClassKindFilter(payload: unknown) {
  const items = extractItems(payload);
  const filtered = items.filter((item) => {
    if (!isRecord(item)) return false;
    const kind = typeof item.kind === "string" ? item.kind.trim().toUpperCase() : "";
    const vertical = typeof item.bookingVertical === "string" ? item.bookingVertical.trim().toUpperCase() : "";
    return kind === "CLASS" || vertical === "CLASS";
  });
  return { items: filtered };
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const legacyResponse = await LegacyServicesGet(req);
  if (!legacyResponse.ok) return legacyResponse;
  const payload = await legacyResponse.json().catch(() => null);
  if (isRecord(payload) && payload.ok === false) return legacyResponse;
  return respondOk(ctx, withClassKindFilter(payload));
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const body = await req.json().catch(() => null);
  if (!isRecord(body)) {
    return respondError(
      ctx,
      { errorCode: "BAD_REQUEST", message: "Payload inválido.", retryable: false },
      { status: 400 },
    );
  }

  const professionalIdsInput = parseProfessionalIdsInput(body);
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

  body.kind = "CLASS";

  const legacyUrl = new URL(req.url);
  legacyUrl.pathname = legacyUrl.pathname.replace(/\/academy\/classes\/?$/i, "/servicos");
  const legacyReq = new NextRequest(legacyUrl, {
    method: "POST",
    headers: new Headers({
      ...Object.fromEntries(req.headers.entries()),
      "x-orya-academy-bridge": "1",
    }),
    body: JSON.stringify(body),
  });
  return LegacyServicesPost(legacyReq);
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
