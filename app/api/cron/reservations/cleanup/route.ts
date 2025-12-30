

// app/api/cron/reservations/cleanup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("X-ORYA-CRON-SECRET");

    if (!secret || secret !== process.env.ORYA_CRON_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized cron call." },
        { status: 401 }
      );
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

    return NextResponse.json({
      ok: true,
      expiredUpdated: expired.count,
      expiredDeleted: oldExpired.count,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error("[CRON CLEANUP ERROR]", err);
    return NextResponse.json(
      { ok: false, error: "Internal cleanup error" },
      { status: 500 }
    );
  }
}