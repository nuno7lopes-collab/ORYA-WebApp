import { NextRequest } from "next/server";
import { getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ERROR_CODE = "EVENT_INVITES_DEPRECATED_USE_TICKET_INVITES";
const ERROR_MESSAGE =
  "Convites por evento foram descontinuados. Usa convites por bilhete através de /events/[id]/invite-token.";

function deprecatedResponse(ctx: RequestContext) {
  return respondError(
    ctx,
    {
      errorCode: ERROR_CODE,
      message: ERROR_MESSAGE,
      retryable: false,
    },
    { status: 410 },
  );
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  return deprecatedResponse(ctx);
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  return deprecatedResponse(ctx);
}

async function _DELETE(req: NextRequest) {
  const ctx = getRequestContext(req);
  return deprecatedResponse(ctx);
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
