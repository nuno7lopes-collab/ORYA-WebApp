import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const LEGACY_GONE_MESSAGE =
  "ACADEMY_LEGACY_GONE: usa /api/org/[orgId]/academy/trainers.";

function legacyGone(req: NextRequest) {
  const ctx = getRequestContext(req);
  return respondError(
    ctx,
    {
      errorCode: "ACADEMY_LEGACY_GONE",
      message: LEGACY_GONE_MESSAGE,
      retryable: false,
    },
    { status: 410 },
  );
}

async function _GET(req: NextRequest) {
  return legacyGone(req);
}

async function _POST(req: NextRequest) {
  return legacyGone(req);
}

async function _DELETE(req: NextRequest) {
  return legacyGone(req);
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
