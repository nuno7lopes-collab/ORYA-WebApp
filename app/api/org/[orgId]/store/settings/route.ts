import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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

function gone(req: NextRequest) {
  const ctx = getRequestContext(req);
  const status = 410;
  return respondError(
    ctx,
    {
      errorCode: errorCodeForStatus(status),
      message:
        "As definicoes da loja foram movidas para /org/:orgId/policies?view=store (politicas) e /org/:orgId/settings (contactos).",
      retryable: false,
    },
    { status },
  );
}

async function _GET(req: NextRequest) {
  return gone(req);
}

async function _PATCH(req: NextRequest) {
  return gone(req);
}

export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
