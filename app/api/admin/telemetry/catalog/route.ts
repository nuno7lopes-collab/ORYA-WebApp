import { NextRequest } from "next/server";
import { listTelemetryCatalog } from "@/domain/telemetry/catalog";
import { requireAdminUser } from "@/lib/admin/auth";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeText(value: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status, req });
    }

    const owner = normalizeText(req.nextUrl.searchParams.get("owner"));
    const query = normalizeText(req.nextUrl.searchParams.get("q"));

    const items = listTelemetryCatalog().filter((item) => {
      if (owner && item.owner.toLowerCase() !== owner) return false;
      if (!query) return true;

      const searchTarget = [
        item.eventName,
        item.owner,
        item.description,
        ...(item.aliases ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return searchTarget.includes(query);
    });

    return jsonWrap(
      {
        ok: true,
        total: items.length,
        items,
      },
      { status: 200, req },
    );
  } catch (err) {
    logError("admin.telemetry.catalog_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);

