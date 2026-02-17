import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/audit";
import {
  getPadelRankingFormatWeights,
  normalizePadelRankingFormatWeights,
  setPadelRankingFormatWeights,
} from "@/lib/platformSettings";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

async function _GET(_req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const rankingWeights = await getPadelRankingFormatWeights();
    return jsonWrap({ ok: true, rankingWeights }, { status: 200 });
  } catch (err) {
    logError("admin.padel.settings.get_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

async function _POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as { rankingWeights?: unknown } | null;
    if (!body || !body.rankingWeights || typeof body.rankingWeights !== "object") {
      return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const normalized = normalizePadelRankingFormatWeights(body.rankingWeights);
    const before = await getPadelRankingFormatWeights();
    const rankingWeights = await setPadelRankingFormatWeights(normalized);

    await auditAdminAction({
      action: "PADEL_RANKING_WEIGHTS_UPDATE",
      actorUserId: admin.userId,
      payload: {
        before,
        after: rankingWeights,
      },
    });

    return jsonWrap({ ok: true, rankingWeights }, { status: 200 });
  } catch (err) {
    logError("admin.padel.settings.post_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
