

// app/api/cron/reservations/cleanup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

/**
 * ⚠️ IMPORTANT
 * This route is designed to be triggered by Vercel Cron.
 * It must NOT be callable by the public internet.
 * We enforce a secret token header to protect it.
 *
 * Add this header in Vercel Cron:
 *   X-ORYA-CRON-SECRET: <your-secret>
 *
 * And set the env var:
 *   ORYA_CRON_SECRET="your-secret"
 */

async function _GET(req: NextRequest) {
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
    }

    const now = new Date();

    // 1) Expire all ACTIVE reservations older than now
    const expired = await prisma.ticketReservation.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });

    // 2) Optional cleanup: remove EXPIRED older than 24h
    const oldExpired = await prisma.ticketReservation.deleteMany({
      where: {
        status: "EXPIRED",
        expiresAt: {
          lt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      },
    });

    return jsonWrap({
      ok: true,
      expiredUpdated: expired.count,
      expiredDeleted: oldExpired.count,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[CRON CLEANUP ERROR]", err);
    return jsonWrap(
      { ok: false, error: "Internal cleanup error" },
      { status: 500 }
    );
  }
}
export const GET = withApiEnvelope(_GET);