import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { rebuildCrmCustomers } from "@/lib/crm/rebuild";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function _POST(req: NextRequest) {
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { organizationId?: unknown } | null;
    const orgParam = parseOrganizationId(req.nextUrl.searchParams.get("organizationId"));
    const organizationId =
      typeof body?.organizationId === "number" && Number.isFinite(body.organizationId)
        ? body.organizationId
        : orgParam;

    const result = await rebuildCrmCustomers({ organizationId: organizationId ?? null });

    return jsonWrap({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("POST /api/internal/crm/rebuild error:", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);