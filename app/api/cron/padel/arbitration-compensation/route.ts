export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";

const AGENDA_ARBITRATION_COMPENSATION_OPERATION = "AGENDA_ARBITRATION_COMPENSATION";
const AGENDA_ARBITRATION_COMP_MAX_ATTEMPTS = 3;
const AGENDA_ARBITRATION_COMP_SCHEDULE_MS = [0, 30 * 60 * 1000, 120 * 60 * 1000] as const;
const ARBITRATION_COMP_BATCH_LIMIT = Number(process.env.CRON_ARBITRATION_COMPENSATION_BATCH_LIMIT || "500");

type ArbitrationDecisionRow = {
  id: string;
  createdAt: Date;
  compensationStatus: string | null;
  resourceKey: string;
  authorityOrgId: number;
  priorityRuleVersion: string;
  correlationId: string | null;
  actorOrganizationId: number | null;
};

type ArbitrationAttemptRow = {
  attemptNo: number;
  status: string;
};

function resolveNextAttempt(attempts: ArbitrationAttemptRow[]) {
  if (attempts.some((attempt) => attempt.status === "SUCCEEDED" || attempt.status === "FAILED_FINAL")) {
    return null;
  }
  if (attempts.length === 0) return 1;

  const lastAttempt = [...attempts].sort((a, b) => b.attemptNo - a.attemptNo)[0];
  if (!lastAttempt) return 1;
  if (lastAttempt.status !== "FAILED_RETRYABLE") return null;
  if (lastAttempt.attemptNo >= AGENDA_ARBITRATION_COMP_MAX_ATTEMPTS) return null;
  return lastAttempt.attemptNo + 1;
}

async function _RUN(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const now = new Date();
    const decisions = await prisma.$queryRaw<ArbitrationDecisionRow[]>(
      Prisma.sql`
        SELECT
          id,
          created_at as "createdAt",
          compensation_status as "compensationStatus",
          resource_key as "resourceKey",
          authority_org_id as "authorityOrgId",
          priority_rule_version as "priorityRuleVersion",
          correlation_id as "correlationId",
          actor_organization_id as "actorOrganizationId"
        FROM app_v3.agenda_arbitration_decisions
        WHERE compensation_status IN ('OPEN', 'IN_PROGRESS')
        ORDER BY created_at ASC
        LIMIT ${ARBITRATION_COMP_BATCH_LIMIT}
      `,
    );

    let enqueued = 0;
    let skippedNotDue = 0;

    for (const decision of decisions) {
      const attempts = await prisma.$queryRaw<ArbitrationAttemptRow[]>(
        Prisma.sql`
          SELECT
            attempt_no as "attemptNo",
            status::text as "status"
          FROM app_v3.agenda_arbitration_compensation_attempts
          WHERE arbitration_decision_id = ${decision.id}::uuid
          ORDER BY attempt_no ASC
        `,
      );

      const nextAttemptNo = resolveNextAttempt(attempts);
      if (!nextAttemptNo) continue;
      if (nextAttemptNo < 1 || nextAttemptNo > AGENDA_ARBITRATION_COMP_MAX_ATTEMPTS) continue;

      const offsetMs = AGENDA_ARBITRATION_COMP_SCHEDULE_MS[nextAttemptNo - 1] ?? 0;
      const dueAt = new Date(decision.createdAt.getTime() + offsetMs);
      if (now.getTime() < dueAt.getTime()) {
        skippedNotDue += 1;
        continue;
      }

      const dedupeKey = `agenda_arbitration_comp:${decision.id}:${nextAttemptNo}`;
      await enqueueOperation({
        operationType: AGENDA_ARBITRATION_COMPENSATION_OPERATION,
        dedupeKey,
        payload: {
          arbitrationDecisionId: decision.id,
          attemptNo: nextAttemptNo,
          correlationId: decision.correlationId ?? `cron:${decision.id}`,
          resourceKey: decision.resourceKey,
          authorityOrgId: decision.authorityOrgId,
          priorityRuleVersion: decision.priorityRuleVersion,
        },
        correlations: {
          organizationId: decision.actorOrganizationId ?? null,
        },
      });
      enqueued += 1;

      if (decision.compensationStatus === "OPEN") {
        await prisma.$executeRaw(
          Prisma.sql`
            UPDATE app_v3.agenda_arbitration_decisions
            SET compensation_status = 'IN_PROGRESS'::app_v3."AgendaArbitrationCompensationStatus",
                updated_at = now()
            WHERE id = ${decision.id}::uuid
          `,
        );
      }
    }

    await recordCronHeartbeat("padel-arbitration-compensation", {
      status: "SUCCESS",
      startedAt,
      metadata: {
        scanned: decisions.length,
        enqueued,
        skippedNotDue,
      },
    });
    return jsonWrap({
      ok: true,
      scanned: decisions.length,
      enqueued,
      skippedNotDue,
      now: now.toISOString(),
    });
  } catch (err) {
    await recordCronHeartbeat("padel-arbitration-compensation", {
      status: "ERROR",
      startedAt,
      error: err,
    });
    return jsonWrap({ ok: false, error: "Internal cleanup error" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_RUN);
export const POST = withApiEnvelope(_RUN);
