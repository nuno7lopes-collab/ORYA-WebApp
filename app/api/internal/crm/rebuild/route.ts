import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { rebuildCrmContacts } from "@/lib/crm/rebuild";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { parseOrganizationId, requireOrganizationIdFromPayload } from "@/lib/organizationId";
import { logError } from "@/lib/observability/logger";

async function _POST(req: NextRequest) {
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { organizationId?: unknown } | null;
    const orgParam = parseOrganizationId(req.nextUrl.searchParams.get("organizationId"));
    const rawOrganizationId =
      typeof body?.organizationId === "number" && Number.isFinite(body.organizationId)
        ? body.organizationId
        : orgParam;

    const orgResult = requireOrganizationIdFromPayload({
      payload: { organizationId: rawOrganizationId ?? null },
      jobName: "crm-rebuild",
      requestId:
        req.headers.get("x-request-id") ||
        req.headers.get("x-correlation-id") ||
        req.headers.get("x-amzn-trace-id") ||
        null,
    });
    if (!orgResult.ok) {
      return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
    }

    const result = await rebuildCrmContacts({ organizationId: orgResult.organizationId });

    return jsonWrap({
      ok: true,
      ...result,
    });
  } catch (err) {
    logError("internal.crm.rebuild_error", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
