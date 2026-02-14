import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { runPadelCleanup } from "@/domain/padel/cleanup";
import { prisma } from "@/lib/prisma";
import { rebuildPadelPlayerHistoryProjectionForEvent } from "@/domain/padel/playerHistoryProjection";

const parseBool = (value: string | null) => value === "true" || value === "1";
const parseNumber = (value: string | null) => {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

async function _POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const limit = parseNumber(params.get("limit"));
  const cursor = parseNumber(params.get("cursor"));
  const eventId = parseNumber(params.get("eventId"));

  const result = await runPadelCleanup({
    limit: limit ?? undefined,
    cursor: cursor ?? undefined,
    eventId: eventId ?? undefined,
    apply: parseBool(params.get("apply")),
    fixMissingRegistrations: params.get("fixMissingRegistrations")
      ? parseBool(params.get("fixMissingRegistrations"))
      : undefined,
    fixStatusMismatches: params.get("fixStatusMismatches")
      ? parseBool(params.get("fixStatusMismatches"))
      : undefined,
    fixPolicyVersions: params.get("fixPolicyVersions")
      ? parseBool(params.get("fixPolicyVersions"))
      : undefined,
    removeOrphanRegistrations: parseBool(params.get("removeOrphans")),
    orphanGraceHours: parseNumber(params.get("orphanGraceHours")) ?? undefined,
  });

  let historyProjectionRebuild: { ok: boolean; rows?: number; error?: string } | null = null;
  if (parseBool(params.get("rebuildHistoryProjection")) && eventId) {
    const event = await prisma.event.findUnique({
      where: { id: eventId, isDeleted: false },
      select: { organizationId: true, templateType: true },
    });
    if (!event?.organizationId || event.templateType !== "PADEL") {
      historyProjectionRebuild = { ok: false, error: "EVENT_NOT_FOUND" };
    } else {
      const rebuild = await prisma.$transaction((tx) =>
        rebuildPadelPlayerHistoryProjectionForEvent({
          tx,
          organizationId: event.organizationId!,
          eventId,
        }),
      );
      historyProjectionRebuild = rebuild.ok
        ? { ok: true, rows: rebuild.rows }
        : { ok: false, error: rebuild.error };
    }
  }

  return jsonWrap(
    {
      ...result,
      ...(historyProjectionRebuild ? { historyProjectionRebuild } : {}),
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
