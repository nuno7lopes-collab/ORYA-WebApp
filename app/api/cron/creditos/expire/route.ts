import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

export async function GET(req: NextRequest) {
  try {
    if (!requireInternalSecret(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
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

    return NextResponse.json({ ok: true, expiredCount });
  } catch (err) {
    console.error("[CRON CREDITS EXPIRE]", err);
    return NextResponse.json({ ok: false, error: "Internal expire error" }, { status: 500 });
  }
}
