import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";

async function _GET(req: NextRequest) {
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
    }

    const now = new Date();
    const expiredBalances = await prisma.serviceCreditBalance.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: now },
      },
      select: { id: true, userId: true, serviceId: true, remainingUnits: true, expiresAt: true },
    });

    let expiredCount = 0;

    for (const balance of expiredBalances) {
      if (balance.remainingUnits <= 0) {
        await prisma.serviceCreditBalance.update({
          where: { id: balance.id },
          data: { status: "EXPIRED", remainingUnits: 0 },
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.serviceCreditBalance.update({
          where: { id: balance.id },
          data: { status: "EXPIRED", remainingUnits: 0 },
        });
        await tx.serviceCreditLedger.create({
          data: {
            userId: balance.userId,
            serviceId: balance.serviceId,
            changeUnits: -balance.remainingUnits,
            type: "EXPIRE",
            expiresAt: balance.expiresAt ?? undefined,
            metadata: { reason: "AUTO_EXPIRE" },
          },
        });
      });
      expiredCount += 1;
    }

    return jsonWrap({ ok: true, expiredCount });
  } catch (err) {
    logError("cron.credits.expire_error", err);
    return jsonWrap({ ok: false, error: "Internal expire error" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
