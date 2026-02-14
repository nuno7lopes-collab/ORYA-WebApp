import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET() {
  return jsonWrap(
    {
      ok: false,
      error: "LEGACY_ROUTE_REMOVED",
      message: "Use /api/org-hub/invites.",
      endpoint: "/api/org-hub/invites",
    },
    { status: 410 },
  );
}

async function _POST(_req: NextRequest) {
  return jsonWrap(
    {
      ok: false,
      error: "LEGACY_ROUTE_REMOVED",
      message: "Use /api/org-hub/organizations/members/invites.",
      endpoint: "/api/org-hub/organizations/members/invites",
    },
    { status: 410 },
  );
}

async function _PATCH(_req: NextRequest) {
  return jsonWrap(
    {
      ok: false,
      error: "LEGACY_ROUTE_REMOVED",
      message: "Use /api/org-hub/organizations/members/invites.",
      endpoint: "/api/org-hub/organizations/members/invites",
    },
    { status: 410 },
  );
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
