import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { runPadelCleanup } from "@/domain/padel/cleanup";
import { prisma } from "@/lib/prisma";
import { rebuildPadelPlayerHistoryProjectionForEvent } from "@/domain/padel/playerHistoryProjection";

const parseBool = (value: string | null) => value === "true" || value === "1";
const parsePositiveInteger = (value: string | null) => {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const parseNonNegativeNumber = (value: string | null) => {
  if (value == null) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

async function _POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const limitParam = params.get("limit");
  const cursorParam = params.get("cursor");
  const eventIdParam = params.get("eventId");
  const orphanGraceHoursParam = params.get("orphanGraceHours");
  const limit = parsePositiveInteger(limitParam);
  const cursor = parsePositiveInteger(cursorParam);
  const eventId = parsePositiveInteger(eventIdParam);
  const orphanGraceHours = parseNonNegativeNumber(orphanGraceHoursParam);
  if (limitParam != null && limit == null) {
    return jsonWrap({ ok: false, error: "INVALID_LIMIT" }, { status: 400 });
  }
  if (cursorParam != null && cursor == null) {
    return jsonWrap({ ok: false, error: "INVALID_CURSOR" }, { status: 400 });
  }
  if (eventIdParam != null && eventId == null) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }
  if (orphanGraceHoursParam != null && orphanGraceHours == null) {
    return jsonWrap({ ok: false, error: "INVALID_ORPHAN_GRACE_HOURS" }, { status: 400 });
  }

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
    orphanGraceHours: orphanGraceHours ?? undefined,
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
